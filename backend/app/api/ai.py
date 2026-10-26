from typing import Annotated, TypeVar
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ValidationError
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
    ToneOfVoice,
)
from app.schemas.adapted_content import AdaptedContentRead
from app.schemas.ai import (
    AdaptationGenerateRequest,
    GeneratedAdaptationContent,
    GeneratedAdaptationRead,
    GeneratedPostContent,
    GeneratedPostRead,
    PostGenerateRequest,
)
from app.schemas.ai_request import AIRequestRead
from app.schemas.post import PostRead
from app.services.ai_prompts import (
    build_adaptation_prompt,
    build_post_generation_prompt,
)
from app.services.llm import (
    LLMError,
    LLMProvider,
    LLMResponseError,
    LLMUnavailableError,
    get_llm_provider,
)

router = APIRouter(tags=["AI"])
DbSession = Annotated[Session, Depends(get_db_session)]
LLMService = Annotated[LLMProvider, Depends(get_llm_provider)]
OutputSchema = TypeVar("OutputSchema", bound=BaseModel)


def _generate_json(provider: LLMProvider, prompt: str) -> str:
    try:
        return provider.generate_json(prompt)
    except LLMUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except LLMResponseError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except LLMError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The configured language model service is unavailable.",
        ) from exc


def _parse_output(
    model_type: type[OutputSchema],
    output: str,
) -> OutputSchema:
    try:
        return model_type.model_validate_json(output)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The language model returned a response in an invalid format.",
        ) from exc


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

    prompt = build_post_generation_prompt(brand, tone, template, payload.prompt)
    generated_json = _generate_json(provider, prompt)
    generated = _parse_output(GeneratedPostContent, generated_json)

    ai_request_id = uuid4()
    ai_request = AIRequest(
        id=ai_request_id,
        brand_id=brand.id,
        template_id=template.id if template else None,
        request_type="post_generation",
        prompt=prompt,
        response=generated_json,
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
    prompt = build_adaptation_prompt(brand, tone, social_network, post.text)
    generated_json = _generate_json(provider, prompt)
    generated = _parse_output(GeneratedAdaptationContent, generated_json)

    ai_request_id = uuid4()
    ai_request = AIRequest(
        id=ai_request_id,
        brand_id=brand.id,
        template_id=None,
        request_type="adaptation",
        prompt=prompt,
        response=generated_json,
        model=provider.model_name,
    )
    adaptation = AdaptedContent(
        id=uuid4(),
        post_id=post.id,
        social_network_id=social_network.id,
        text=generated.text,
    )
    session.add_all([ai_request, adaptation])
    commit_session(session)
    session.refresh(adaptation)
    return GeneratedAdaptationRead(
        adaptation=AdaptedContentRead.model_validate(adaptation),
        ai_request_id=ai_request_id,
    )
