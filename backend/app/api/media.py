from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api._transactions import commit_session
from app.db.session import get_db_session
from app.dependencies.brands import CurrentUserMedia, CurrentUserPost
from app.models import MediaFile
from app.schemas.media_file import MediaFileCreate, MediaFileRead

router = APIRouter(tags=["media"])
DbSession = Annotated[Session, Depends(get_db_session)]


@router.post(
    "/api/posts/{post_id}/media",
    response_model=MediaFileRead,
    status_code=status.HTTP_201_CREATED,
)
def create_media_metadata(
    payload: MediaFileCreate,
    post: CurrentUserPost,
    session: DbSession,
) -> MediaFile:
    media = MediaFile(
        id=uuid4(),
        post_id=post.id,
        **payload.model_dump(),
    )
    session.add(media)
    commit_session(session)
    session.refresh(media)
    return media


@router.get(
    "/api/posts/{post_id}/media",
    response_model=list[MediaFileRead],
)
def list_post_media(
    post: CurrentUserPost,
    session: DbSession,
) -> list[MediaFile]:
    return list(
        session.scalars(
            select(MediaFile)
            .where(MediaFile.post_id == post.id)
            .order_by(MediaFile.file_name, MediaFile.id)
        ).all()
    )


@router.get("/api/media/{media_id}", response_model=MediaFileRead)
def get_media(media: CurrentUserMedia) -> MediaFile:
    return media


@router.delete(
    "/api/media/{media_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_media(media: CurrentUserMedia, session: DbSession) -> Response:
    session.delete(media)
    commit_session(session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
