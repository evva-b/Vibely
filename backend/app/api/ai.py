from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api._transactions import commit_session
from app.db.session import get_db_session
from app.dependencies.brands import (
    CurrentUserAIRequest,
    CurrentUserBrand,
    CurrentUserPost,
)
from app.models import (
    AIRequest,
    AdaptedContent,
    Brand,
    BoardStatus,
    Post,
    SocialNetwork,
    Template,
    Topic,
    ToneOfVoice,
)
from app.schemas.adapted_content import AdaptedContentRead
from app.schemas.ai import (
    AdaptationGenerateRequest,
    GeneratedAdaptationContent,
    GeneratedAdaptationRead,
    GeneratedPostContent,
    GeneratedStructureContent,
    GeneratedPostRead,
    PostGenerateRequest,
    StructureSuggestionRead,
    StructureSuggestionRequest,
)
from app.schemas.ai_request import AIRequestRead
from app.schemas.post import PostRead
from app.services.ai_prompts import (
    build_adaptation_prompt,
    build_post_generation_prompt,
    build_structure_suggestion_prompt,
)
from app.services.ai_generation import (
    generate_json as _generate_json,
    parse_output as _parse_output,
)
from app.services.ai_conversations import (
    ensure_post_chat,
    new_chat_message,
    save_chat_response,
)
from app.services.llm import LLMProvider, get_llm_provider

router = APIRouter(tags=["AI"])
DbSession = Annotated[Session, Depends(get_db_session)]
LLMService = Annotated[LLMProvider, Depends(get_llm_provider)]


@router.post(
    "/api/brands/{brand_id}/generate-post",
    response_model=GeneratedPostRead,
    status_code=status.HTTP_201_CREATED,
)
def generate_post(
    payload: PostGenerateRequest,
    brand: CurrentUserBrand,
    session: DbSession,
    provider: LLMService,
) -> GeneratedPostRead:
    template = None
    if payload.template_id is not None:
        template = session.scalar(
            select(Template).where(
                Template.id == payload.template_id,
                Template.brand_id == brand.id,
            )
        )
        if template is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found",
            )

    tone = session.scalar(
        select(ToneOfVoice).where(ToneOfVoice.brand_id == brand.id)
    )
    board_status = (
        session.get(BoardStatus, payload.board_status_id)
        if payload.board_status_id is not None
        else session.scalar(
            select(BoardStatus).order_by(BoardStatus.position, BoardStatus.id).limit(1)
        )
    )
    if board_status is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid board status is available for the generated post.",
        )

    social_network = (
        session.get(SocialNetwork, payload.social_network_id)
        if payload.social_network_id is not None
        else None
    )
    if payload.social_network_id is not None and social_network is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Social network not found",
        )
    topics = list(
        session.scalars(select(Topic.name).where(Topic.brand_id == brand.id)).all()
    )
    prompt = build_post_generation_prompt(
        brand,
        tone,
        topics,
        template,
        social_network,
        payload.style,
        payload.prompt,
    )
    generated_json = _generate_json(
        provider,
        prompt,
        output_schema=GeneratedPostContent,
    )
    generated = _parse_output(GeneratedPostContent, generated_json)

    ai_request_id = uuid4()
    ai_request = AIRequest(
        id=ai_request_id,
        brand_id=brand.id,
        template_id=template.id if template else None,
        request_type="post_generation",
        prompt=payload.prompt,
        response=None,
        model=provider.model_name,
    )
    post = Post(
        id=uuid4(),
        ai_request_id=ai_request_id,
        board_status_id=board_status.id,
        brand_id=brand.id,
        title=generated.title,
        text=generated.text,
    )
    messages = [
        new_chat_message("user", payload.prompt),
        new_chat_message("assistant", generated_json),
    ]
    save_chat_response(
        ai_request,
        messages,
        title=generated.title,
        text=generated.text,
        why_it_works=generated.why_it_works,
    )
    session.add_all([ai_request, post])
    commit_session(session)
    session.refresh(post)
    return GeneratedPostRead(
        post=PostRead.model_validate(post),
        ai_request_id=ai_request_id,
    )


@router.get(
    "/api/brands/{brand_id}/ai-requests",
    response_model=list[AIRequestRead],
)
def list_ai_requests(brand: CurrentUserBrand, session: DbSession) -> list[AIRequest]:
    return list(
        session.scalars(
            select(AIRequest)
            .where(AIRequest.brand_id == brand.id)
            .order_by(AIRequest.created_at.desc(), AIRequest.id)
        ).all()
    )


@router.get(
    "/api/ai-requests/{ai_request_id}",
    response_model=AIRequestRead,
)
def get_ai_request(ai_request: CurrentUserAIRequest) -> AIRequest:
    return ai_request


@router.post(
    "/api/posts/{post_id}/generate-adaptation",
    response_model=GeneratedAdaptationRead,
    status_code=status.HTTP_201_CREATED,
)
def generate_adaptation(
    payload: AdaptationGenerateRequest,
    post: CurrentUserPost,
    session: DbSession,
    provider: LLMService,
) -> GeneratedAdaptationRead:
    social_network = session.get(SocialNetwork, payload.social_network_id)
    if social_network is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Social network not found",
        )
    brand = session.get(Brand, post.brand_id)
    if brand is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found",
        )
    tone = session.scalar(
        select(ToneOfVoice).where(ToneOfVoice.brand_id == brand.id)
    )
    topics = list(
        session.scalars(select(Topic.name).where(Topic.brand_id == brand.id)).all()
    )
    prompt = build_adaptation_prompt(
        brand,
        tone,
        topics,
        social_network,
        payload.style,
        post.text,
    )
    generated_json = _generate_json(
        provider,
        prompt,
        output_schema=GeneratedAdaptationContent,
    )
    generated = _parse_output(GeneratedAdaptationContent, generated_json)

    try:
        ai_request, messages, _ = ensure_post_chat(session, post, provider.model_name)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The post's AI conversation is inconsistent.",
        ) from exc
    human_request = f"Адаптировать для {social_network.name} в стиле «{payload.style}»."
    messages.extend(
        [
            new_chat_message("user", human_request, kind="adaptation", platform=social_network.name),
            new_chat_message("assistant", generated_json, kind="adaptation", platform=social_network.name),
        ]
    )
    ai_request.prompt = human_request
    save_chat_response(ai_request, messages)
    adaptation = AdaptedContent(
        id=uuid4(),
        post_id=post.id,
        social_network_id=social_network.id,
        text=generated.text,
    )
    session.add(adaptation)
    commit_session(session)
    session.refresh(adaptation)
    return GeneratedAdaptationRead(
        adaptation=AdaptedContentRead.model_validate(adaptation),
        ai_request_id=ai_request.id,
    )


@router.post(
    "/api/brands/{brand_id}/suggest-structure",
    response_model=StructureSuggestionRead,
)
def suggest_post_structure(
    payload: StructureSuggestionRequest,
    brand: CurrentUserBrand,
    session: DbSession,
    provider: LLMService,
) -> StructureSuggestionRead:
    tone = session.scalar(select(ToneOfVoice).where(ToneOfVoice.brand_id == brand.id))
    topics = list(
        session.scalars(select(Topic.name).where(Topic.brand_id == brand.id)).all()
    )
    missing_fields = [
        field
        for field, value in (
            ("описание бренда", brand.description),
            ("целевая аудитория", brand.target_audience),
            ("тон общения", tone.style if tone else None),
            ("темы контента", ", ".join(topics) if topics else None),
        )
        if not value
    ]
    prompt = build_structure_suggestion_prompt(brand, tone, topics, payload.title)
    generated = _parse_output(
        GeneratedStructureContent,
        _generate_json(
            provider,
            prompt,
            output_schema=GeneratedStructureContent,
        ),
    )
    return StructureSuggestionRead(
        structure=generated.structure,
        missing_profile_fields=missing_fields,
    )
