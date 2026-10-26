from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api._transactions import commit_session, utc_naive_timestamp_after
from app.db.session import get_db_session
from app.dependencies.brands import CurrentUserAdaptation, CurrentUserPost
from app.models import AdaptedContent, SocialNetwork
from app.schemas.adapted_content import (
    AdaptedContentCreate,
    AdaptedContentRead,
    AdaptedContentUpdate,
)

router = APIRouter(tags=["adaptations"])
DbSession = Annotated[Session, Depends(get_db_session)]


def _require_social_network(session: Session, social_network_id: UUID) -> None:
    if session.get(SocialNetwork, social_network_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Social network not found",
        )


@router.post(
    "/api/posts/{post_id}/adaptations",
    response_model=AdaptedContentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_adaptation(
    payload: AdaptedContentCreate,
    post: CurrentUserPost,
    session: DbSession,
) -> AdaptedContent:
    _require_social_network(session, payload.social_network_id)
    adaptation = AdaptedContent(
        id=uuid4(),
        post_id=post.id,
        **payload.model_dump(),
    )
    session.add(adaptation)
    commit_session(session)
    session.refresh(adaptation)
    return adaptation


@router.get(
    "/api/posts/{post_id}/adaptations",
    response_model=list[AdaptedContentRead],
)
def list_adaptations(
    post: CurrentUserPost,
    session: DbSession,
) -> list[AdaptedContent]:
    return list(
        session.scalars(
            select(AdaptedContent)
            .where(AdaptedContent.post_id == post.id)
            .order_by(AdaptedContent.created_at, AdaptedContent.id)
        ).all()
    )


@router.get(
    "/api/adaptations/{adaptation_id}",
    response_model=AdaptedContentRead,
)
def get_adaptation(adaptation: CurrentUserAdaptation) -> AdaptedContent:
    return adaptation


@router.patch(
    "/api/adaptations/{adaptation_id}",
    response_model=AdaptedContentRead,
)
def update_adaptation(
    payload: AdaptedContentUpdate,
    adaptation: CurrentUserAdaptation,
    session: DbSession,
) -> AdaptedContent:
    changes = payload.model_dump(exclude_unset=True)
    if "social_network_id" in changes:
        _require_social_network(session, changes["social_network_id"])
    for field, value in changes.items():
        setattr(adaptation, field, value)
    if changes:
        adaptation.updated_at = utc_naive_timestamp_after(adaptation.updated_at)
        commit_session(session)
        session.refresh(adaptation)
    return adaptation


@router.delete(
    "/api/adaptations/{adaptation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_adaptation(
    adaptation: CurrentUserAdaptation,
    session: DbSession,
) -> Response:
    session.delete(adaptation)
    commit_session(session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
