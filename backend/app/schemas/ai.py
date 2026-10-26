from uuid import UUID

from pydantic import Field

from app.schemas.adapted_content import AdaptedContentRead
from app.schemas.base import NonEmptyString, ORMReadModel
from app.schemas.post import PostRead


class PostGenerateRequest(ORMReadModel):
    prompt: NonEmptyString = Field(max_length=10000)
    template_id: UUID | None = None
    board_status_id: UUID | None = None


class AdaptationGenerateRequest(ORMReadModel):
    social_network_id: UUID


class GeneratedPostContent(ORMReadModel):
    title: NonEmptyString = Field(max_length=255)
    text: NonEmptyString


class GeneratedAdaptationContent(ORMReadModel):
    text: NonEmptyString


class GeneratedPostRead(ORMReadModel):
    post: PostRead
    ai_request_id: UUID


class GeneratedAdaptationRead(ORMReadModel):
    adaptation: AdaptedContentRead
    ai_request_id: UUID
