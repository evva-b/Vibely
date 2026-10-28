from uuid import UUID

from pydantic import Field

from app.schemas.adapted_content import AdaptedContentRead
from app.schemas.base import NonEmptyString, ORMReadModel
from app.schemas.post import PostRead


class PostGenerateRequest(ORMReadModel):
    prompt: NonEmptyString = Field(max_length=10000)
    template_id: UUID | None = None
    board_status_id: UUID | None = None
    social_network_id: UUID | None = None
    style: NonEmptyString | None = Field(default=None, max_length=100)


class AdaptationGenerateRequest(ORMReadModel):
    social_network_id: UUID
    style: NonEmptyString = Field(default="В стиле бренда", max_length=100)


class StructureSuggestionRequest(ORMReadModel):
    title: NonEmptyString = Field(max_length=255)


class StructureSuggestionRead(ORMReadModel):
    structure: NonEmptyString
    missing_profile_fields: list[str]


class GeneratedStructureContent(ORMReadModel):
    structure: NonEmptyString


class GeneratedPostContent(ORMReadModel):
    title: NonEmptyString = Field(max_length=255)
    text: NonEmptyString
    why_it_works: NonEmptyString


class GeneratedAdaptationContent(ORMReadModel):
    text: NonEmptyString
    why_it_works: NonEmptyString


class GeneratedPostRead(ORMReadModel):
    post: PostRead
    ai_request_id: UUID


class GeneratedAdaptationRead(ORMReadModel):
    adaptation: AdaptedContentRead
    ai_request_id: UUID
