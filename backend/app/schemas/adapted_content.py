from datetime import datetime
from uuid import UUID

from pydantic import field_validator

from app.schemas.base import NonEmptyString, ORMReadModel


class AdaptedContentCreate(ORMReadModel):
    social_network_id: UUID
    text: NonEmptyString


class AdaptedContentUpdate(ORMReadModel):
    social_network_id: UUID | None = None
    text: NonEmptyString | None = None

    @field_validator("social_network_id", "text")
    @classmethod
    def required_fields_cannot_be_null(
        cls,
        value: UUID | NonEmptyString | None,
    ) -> UUID | NonEmptyString | None:
        if value is None:
            raise ValueError("field cannot be null")
        return value


class AdaptedContentRead(ORMReadModel):
    id: UUID
    post_id: UUID
    social_network_id: UUID
    text: str
    created_at: datetime
    updated_at: datetime
