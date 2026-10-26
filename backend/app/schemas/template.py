from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.base import NonEmptyString, ORMReadModel


class TemplateCreate(ORMReadModel):
    name: NonEmptyString = Field(max_length=150)
    description: str | None = None
    prompt: NonEmptyString


class TemplateUpdate(ORMReadModel):
    name: NonEmptyString | None = Field(default=None, max_length=150)
    description: str | None = None
    prompt: NonEmptyString | None = None

    @field_validator("name", "prompt")
    @classmethod
    def required_fields_cannot_be_null(
        cls,
        value: NonEmptyString | None,
    ) -> NonEmptyString | None:
        if value is None:
            raise ValueError("field cannot be null")
        return value


class TemplateRead(ORMReadModel):
    id: UUID
    brand_id: UUID
    name: str
    description: str | None
    prompt: str
