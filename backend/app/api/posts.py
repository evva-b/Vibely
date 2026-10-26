from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api._transactions import commit_session, utc_naive_timestamp_after
from app.db.session import get_db_session
from app.dependencies.brands import CurrentUserBrand, CurrentUserPost
from app.models import BoardStatus, Post
from app.schemas.board import BoardColumnRead
from app.schemas.post import PostCreate, PostRead, PostUpdate

router = APIRouter(tags=["posts"])
DbSession = Annotated[Session, Depends(get_db_session)]


def _require_board_status(session: Session, board_status_id: UUID) -> BoardStatus:
    board_status = session.get(BoardStatus, board_status_id)
    if board_status is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board status not found",
        )
    return board_status


@router.post(
    "/api/brands/{brand_id}/posts",
    response_model=PostRead,
    status_code=status.HTTP_201_CREATED,
)
def create_post(
    payload: PostCreate,
    brand: CurrentUserBrand,
    session: DbSession,
) -> Post:
    _require_board_status(session, payload.board_status_id)
    post = Post(
        id=uuid4(),
        brand_id=brand.id,
        ai_request_id=None,
        **payload.model_dump(),
    )
    session.add(post)
    commit_session(session)
    session.refresh(post)
    return post


@router.get(
    "/api/brands/{brand_id}/posts",
    response_model=list[PostRead],
)
def list_brand_posts(
    brand: CurrentUserBrand,
    session: DbSession,
) -> list[Post]:
    return list(
        session.scalars(
            select(Post)
            .where(Post.brand_id == brand.id)
            .order_by(Post.created_at, Post.id)
        ).all()
    )


@router.get("/api/brands/{brand_id}/board", response_model=list[BoardColumnRead])
def get_brand_board(
    brand: CurrentUserBrand,
    session: DbSession,
) -> list[dict[str, object]]:
    statuses = session.scalars(
        select(BoardStatus).order_by(BoardStatus.position, BoardStatus.id)
    ).all()
    posts = session.scalars(
        select(Post)
        .where(Post.brand_id == brand.id)
        .order_by(Post.updated_at, Post.id)
    ).all()
    posts_by_status: dict[UUID, list[Post]] = {
        board_status.id: [] for board_status in statuses
    }
    for post in posts:
        posts_by_status[post.board_status_id].append(post)
    return [
        {
            "id": board_status.id,
            "name": board_status.name,
            "position": board_status.position,
            "posts": posts_by_status[board_status.id],
        }
        for board_status in statuses
    ]


@router.get("/api/posts/{post_id}", response_model=PostRead)
def get_post(post: CurrentUserPost) -> Post:
    return post


@router.patch("/api/posts/{post_id}", response_model=PostRead)
def update_post(
    payload: PostUpdate,
    post: CurrentUserPost,
    session: DbSession,
) -> Post:
    changes = payload.model_dump(exclude_unset=True)
    if "board_status_id" in changes:
        _require_board_status(session, changes["board_status_id"])
    for field, value in changes.items():
        setattr(post, field, value)
    if changes:
        post.updated_at = utc_naive_timestamp_after(post.updated_at)
        commit_session(session)
        session.refresh(post)
    return post


@router.delete("/api/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(post: CurrentUserPost, session: DbSession) -> Response:
    session.delete(post)
    commit_session(session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
