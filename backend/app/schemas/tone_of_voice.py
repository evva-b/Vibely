from uuid import UUID

from pydantic import field_validator

from app.schemas.base import NonEmptyString, ORMReadModel


class ToneOfVoiceCreate(ORMReadModel):
    style: NonEmptyString
    vocabulary: str | None = None
    communication_rules: str | None = None
    forbidden_words: str | None = None


class ToneOfVoiceUpdate(ORMReadModel):
    style: NonEmptyString | None = None
    vocabulary: str | None = None
    communication_rules: str | None = None
    forbidden_words: str | None = None

    @field_validator("style")
    @classmethod
    def style_cannot_be_null(
        cls,
        value: NonEmptyString | None,
    ) -> NonEmptyString | None:
        if value is None:
            raise ValueError("style cannot be null")
        return value


class ToneOfVoiceRead(ORMReadModel):
    id: UUID
    brand_id: UUID
    style: str
    vocabulary: str | None
    communication_rules: str | None
    forbidden_words: str | None
