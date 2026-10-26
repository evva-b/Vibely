from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.base import NonEmptyString, ORMReadModel


class TopicCreate(ORMReadModel):
    name: NonEmptyString = Field(max_length=150)


class TopicUpdate(ORMReadModel):
    name: NonEmptyString | None = Field(default=None, max_length=150)

    @field_validator("name")
    @classmethod
    def name_cannot_be_null(cls, value: NonEmptyString | None) -> NonEmptyString | None:
        if value is None:
            raise ValueError("name cannot be null")
        return value


class TopicRead(ORMReadModel):
    id: UUID
    brand_id: UUID
    name: str
