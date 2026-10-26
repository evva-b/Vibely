from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api._transactions import commit_session
from app.db.session import get_db_session
from app.dependencies.brands import CurrentUserBrand, CurrentUserTopic
from app.models import Topic
from app.schemas.topic import TopicCreate, TopicRead, TopicUpdate

router = APIRouter(tags=["topics"])
DbSession = Annotated[Session, Depends(get_db_session)]


@router.post(
    "/api/brands/{brand_id}/topics",
    response_model=TopicRead,
    status_code=status.HTTP_201_CREATED,
)
def create_topic(
    payload: TopicCreate,
    brand: CurrentUserBrand,
    session: DbSession,
) -> Topic:
    topic = Topic(id=uuid4(), brand_id=brand.id, **payload.model_dump())
    session.add(topic)
    commit_session(session)
    session.refresh(topic)
    return topic


@router.get("/api/brands/{brand_id}/topics", response_model=list[TopicRead])
def list_topics(brand: CurrentUserBrand, session: DbSession) -> list[Topic]:
    return list(
        session.scalars(
            select(Topic)
            .where(Topic.brand_id == brand.id)
            .order_by(Topic.name, Topic.id)
        ).all()
    )


@router.get("/api/topics/{topic_id}", response_model=TopicRead)
def get_topic(topic: CurrentUserTopic) -> Topic:
    return topic


@router.patch("/api/topics/{topic_id}", response_model=TopicRead)
def update_topic(
    payload: TopicUpdate,
    topic: CurrentUserTopic,
    session: DbSession,
) -> Topic:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(topic, field, value)
    commit_session(session)
    session.refresh(topic)
    return topic


@router.delete(
    "/api/topics/{topic_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_topic(topic: CurrentUserTopic, session: DbSession) -> Response:
    session.delete(topic)
    commit_session(session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
