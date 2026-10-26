from datetime import datetime
from uuid import UUID

from pydantic import field_validator

from app.schemas.base import NonEmptyString, ORMReadModel


class PostCreate(ORMReadModel):
    title: NonEmptyString
    text: NonEmptyString
    board_status_id: UUID


class PostUpdate(ORMReadModel):
    title: NonEmptyString | None = None
    text: NonEmptyString | None = None
    board_status_id: UUID | None = None

    @field_validator("title", "text", "board_status_id")
    @classmethod
    def required_fields_cannot_be_null(
        cls,
        value: NonEmptyString | UUID | None,
    ) -> NonEmptyString | UUID | None:
        if value is None:
            raise ValueError("field cannot be null")
        return value


class PostRead(ORMReadModel):
    id: UUID
    brand_id: UUID
    ai_request_id: UUID | None
    board_status_id: UUID
    title: str
    text: str
    created_at: datetime
    updated_at: datetime
