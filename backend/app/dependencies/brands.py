from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models import (
    AdaptedContent,
    Brand,
    MediaFile,
    Post,
    Template,
    Topic,
    User,
)


def get_current_user_brand(
    brand_id: UUID,
    session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Brand:
    brand = session.scalar(
        select(Brand).where(
            Brand.id == brand_id,
            Brand.user_id == current_user.id,
        )
    )
    if brand is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found",
        )
    return brand


def get_current_user_topic(
    topic_id: UUID,
    session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Topic:
    topic = session.scalar(
        select(Topic)
        .join(Brand, Topic.brand_id == Brand.id)
        .where(
            Topic.id == topic_id,
            Brand.user_id == current_user.id,
        )
    )
    if topic is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found",
        )
    return topic


def get_current_user_template(
    template_id: UUID,
    session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Template:
    template = session.scalar(
        select(Template)
        .join(Brand, Template.brand_id == Brand.id)
        .where(
            Template.id == template_id,
            Brand.user_id == current_user.id,
        )
    )
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    return template


def get_current_user_post(
    post_id: UUID,
    session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Post:
    post = session.scalar(
        select(Post)
        .join(Brand, Post.brand_id == Brand.id)
        .where(
            Post.id == post_id,
            Brand.user_id == current_user.id,
        )
    )
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )
    return post


def get_current_user_adaptation(
    adaptation_id: UUID,
    session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AdaptedContent:
    adaptation = session.scalar(
        select(AdaptedContent)
        .join(Post, AdaptedContent.post_id == Post.id)
        .join(Brand, Post.brand_id == Brand.id)
        .where(
            AdaptedContent.id == adaptation_id,
            Brand.user_id == current_user.id,
        )
    )
    if adaptation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Adaptation not found",
        )
    return adaptation


def get_current_user_media(
    media_id: UUID,
    session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MediaFile:
    media = session.scalar(
        select(MediaFile)
        .join(Post, MediaFile.post_id == Post.id)
        .join(Brand, Post.brand_id == Brand.id)
        .where(
            MediaFile.id == media_id,
            Brand.user_id == current_user.id,
        )
    )
    if media is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media file not found",
        )
    return media


CurrentUserBrand = Annotated[Brand, Depends(get_current_user_brand)]
CurrentUserTopic = Annotated[Topic, Depends(get_current_user_topic)]
CurrentUserTemplate = Annotated[Template, Depends(get_current_user_template)]
CurrentUserPost = Annotated[Post, Depends(get_current_user_post)]
CurrentUserAdaptation = Annotated[
    AdaptedContent,
    Depends(get_current_user_adaptation),
]
CurrentUserMedia = Annotated[MediaFile, Depends(get_current_user_media)]
