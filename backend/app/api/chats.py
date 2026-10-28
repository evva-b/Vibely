import json
import base64
import binascii
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api._transactions import commit_session, utc_naive_timestamp_after
from app.db.session import get_db_session
from app.dependencies.brands import CurrentUserAIRequest, CurrentUserPost
from app.models import AIRequest, Post, SocialNetwork, Topic, ToneOfVoice
from app.schemas.ai import GeneratedPostContent
from app.schemas.ai_request import AIRequestRead
from app.schemas.chat import (
    ChatFeedbackRead,
    ChatFeedbackUpdate,
    ChatMessageRead,
    PostChatContextRead,
    PostChatContextUpdate,
    PostChatMessageCreate,
    PostChatRead,
)
from app.schemas.post import PostRead
from app.services.ai_conversations import (
    ensure_post_chat,
    get_chat_messages,
    new_chat_message,
    parse_response_payload,
    save_chat_response,
)
from app.services.ai_generation import generate_json, parse_output
from app.services.ai_prompts import build_post_generation_prompt
from app.services.llm import LLMProvider, get_llm_provider

router = APIRouter(tags=["post chats"])
DbSession = Annotated[Session, Depends(get_db_session)]
LLMService = Annotated[LLMProvider, Depends(get_llm_provider)]


def _read_chat(
    post: Post,
    request: AIRequest,
    messages: list[dict[str, object]],
) -> PostChatRead:
    safe_messages: list[ChatMessageRead] = []
    for item in messages:
        message_id = item.get("id")
        role = item.get("role")
        content = item.get("content")
        if not isinstance(message_id, str) or not isinstance(role, str) or not isinstance(content, str):
            continue
        try:
            UUID(message_id)
        except ValueError:
            continue
        safe_messages.append(
            ChatMessageRead(
                id=message_id,
                role=role,
                content=content,
                created_at=item.get("created_at", request.created_at),
                kind=item.get("kind", "post"),
                platform=item.get("platform"),
                feedback=item.get("feedback"),
                image_data=item.get("image_data"),
                image_type=item.get("image_type"),
            )
        )
    stored_context = parse_response_payload(request).get("chat_context")
    if not isinstance(stored_context, dict):
        stored_context = {}
    try:
        context_network_id = (
            UUID(str(stored_context["social_network_id"]))
            if stored_context.get("social_network_id")
            else None
        )
    except (ValueError, TypeError):
        context_network_id = None
    return PostChatRead(
        post=PostRead.model_validate(post),
        request=AIRequestRead.model_validate(request),
        messages=safe_messages,
        context=PostChatContextRead(
            social_network_id=context_network_id,
            social_network=(
                stored_context.get("social_network")
                if isinstance(stored_context.get("social_network"), str)
                else None
            ),
            style=(
                stored_context.get("style")
                if isinstance(stored_context.get("style"), str)
                else None
            ),
        ),
    )


@router.post(
    "/api/posts/{post_id}/chat",
    response_model=PostChatRead,
)
def open_post_chat(
    post: CurrentUserPost,
    session: DbSession,
    provider: LLMService,
) -> PostChatRead:
    try:
        request, messages, changed = ensure_post_chat(
            session,
            post,
            provider.model_name,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The post's AI conversation is inconsistent.",
        ) from exc
    if changed:
        commit_session(session)
        session.refresh(post)
        session.refresh(request)
    return _read_chat(post, request, messages)


@router.patch(
    "/api/posts/{post_id}/chat/context",
    response_model=PostChatRead,
)
def update_post_chat_context(
    payload: PostChatContextUpdate,
    post: CurrentUserPost,
    session: DbSession,
    provider: LLMService,
) -> PostChatRead:
    network = session.get(SocialNetwork, payload.social_network_id)
    if network is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Social network not found",
        )
    try:
        request, messages, _ = ensure_post_chat(session, post, provider.model_name)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The post's AI conversation is inconsistent.",
        ) from exc
    save_chat_response(
        request,
        messages,
        chat_context={
            "social_network_id": str(network.id),
            "social_network": network.name,
            "style": payload.style,
        },
    )
    commit_session(session)
    session.refresh(post)
    session.refresh(request)
    return _read_chat(post, request, messages)


@router.post(
    "/api/posts/{post_id}/chat/messages",
    response_model=PostChatRead,
)
def send_post_chat_message(
    payload: PostChatMessageCreate,
    post: CurrentUserPost,
    session: DbSession,
    provider: LLMService,
) -> PostChatRead:
    try:
        request, messages, _ = ensure_post_chat(session, post, provider.model_name)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The post's AI conversation is inconsistent.",
        ) from exc

    brand = post.brand
    tone = session.scalar(select(ToneOfVoice).where(ToneOfVoice.brand_id == brand.id))
    topics = list(
        session.scalars(select(Topic.name).where(Topic.brand_id == brand.id)).all()
    )
    stored_payload = parse_response_payload(request)
    stored_context = stored_payload.get("chat_context")
    if not isinstance(stored_context, dict):
        stored_context = {}
    if not messages and (
        payload.social_network_id is None or payload.style is None
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Choose a social network and style before starting this chat.",
        )
    network_id = payload.social_network_id
    if network_id is None and stored_context.get("social_network_id"):
        try:
            network_id = UUID(str(stored_context["social_network_id"]))
        except (ValueError, TypeError):
            network_id = None
    style = payload.style or (
        stored_context.get("style")
        if isinstance(stored_context.get("style"), str)
        else None
    )
    network = (
        session.get(SocialNetwork, network_id)
        if network_id is not None
        else None
    )
    if network_id is not None and network is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Social network not found",
        )
    if payload.image_data is not None:
        try:
            image_bytes = base64.b64decode(payload.image_data, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="The attached image could not be decoded.",
            ) from exc
        image_header = (
            payload.image_type == "image/jpeg" and image_bytes.startswith(b"\xff\xd8\xff")
        ) or (
            payload.image_type == "image/png"
            and image_bytes.startswith(b"\x89PNG\r\n\x1a\n")
        ) or (
            payload.image_type == "image/webp"
            and image_bytes.startswith(b"RIFF")
            and image_bytes[8:12] == b"WEBP"
        )
        if not image_header:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="The attached file is not a valid supported image.",
            )
        images = [image_bytes]
    else:
        image_bytes = None
        images = []
    response_data = {}
    response_data = stored_payload
    previous_content = {
        "title": str(response_data.get("title") or post.title),
        "text": str(response_data.get("text") or post.text),
    }
    prompt = build_post_generation_prompt(
        brand,
        tone,
        topics,
        None,
        network,
        style,
        payload.prompt,
        previous_content,
        image_attached=bool(images),
    )
    generated = parse_output(
        GeneratedPostContent,
        generate_json(
            provider,
            prompt,
            images=images,
            output_schema=GeneratedPostContent,
        ),
    )

    messages.extend(
        [
            new_chat_message(
                "user",
                payload.prompt,
                image_data=payload.image_data,
                image_type=payload.image_type,
            ),
            new_chat_message(
                "assistant",
                json.dumps(generated.model_dump(), ensure_ascii=False),
                platform=network.name if network is not None else None,
            ),
        ]
    )
    post.title = generated.title
    post.text = generated.text
    post.updated_at = utc_naive_timestamp_after(post.updated_at)
    request.prompt = payload.prompt
    request.request_type = "post_chat"
    stored_payload["chat_context"] = {
        "social_network_id": str(network.id) if network else None,
        "social_network": network.name if network else None,
        "style": style,
    }
    save_chat_response(
        request,
        messages,
        chat_context=stored_payload["chat_context"],
        title=generated.title,
        text=generated.text,
        why_it_works=generated.why_it_works,
    )
    commit_session(session)
    session.refresh(post)
    session.refresh(request)
    return _read_chat(post, request, messages)


@router.patch(
    "/api/ai-requests/{ai_request_id}/messages/{message_id}/feedback",
    response_model=ChatFeedbackRead,
)
def set_message_feedback(
    payload: ChatFeedbackUpdate,
    ai_request: CurrentUserAIRequest,
    message_id: UUID,
    session: DbSession,
) -> ChatFeedbackRead:
    messages = get_chat_messages(ai_request)
    message = next(
        (
            item
            for item in messages
            if item.get("id") == str(message_id)
            and item.get("role") == "assistant"
        ),
        None,
    )
    if message is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI response not found",
        )
    message["feedback"] = payload.rating
    save_chat_response(ai_request, messages)
    commit_session(session)
    session.refresh(ai_request)
    return ChatFeedbackRead(message_id=message_id, rating=payload.rating)
