from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.base import NonEmptyString, ORMReadModel


class BrandCreate(ORMReadModel):
    name: NonEmptyString = Field(max_length=150)
    description: str | None = None
    target_audience: str | None = None


class BrandUpdate(ORMReadModel):
    name: NonEmptyString | None = Field(default=None, max_length=150)
    description: str | None = None
    target_audience: str | None = None

    @field_validator("name")
    @classmethod
    def name_cannot_be_null(cls, value: NonEmptyString | None) -> NonEmptyString | None:
        if value is None:
            raise ValueError("name cannot be null")
        return value


class BrandRead(ORMReadModel):
    id: UUID
    user_id: UUID
    name: str
    description: str | None
    target_audience: str | None
    created_at: datetime
