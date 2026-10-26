from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.base import NonEmptyString, ORMReadModel


class MediaFileCreate(ORMReadModel):
    file_name: NonEmptyString = Field(max_length=255)
    file_type: NonEmptyString = Field(max_length=100)
    file_url: str = Field(min_length=1, max_length=500)
    file_size: int = Field(ge=0)

    @field_validator("file_url")
    @classmethod
    def reject_embedded_file_content(cls, value: str) -> str:
        if value.lstrip().lower().startswith("data:"):
            raise ValueError("file_url must reference a stored file, not embed its content")
        return value


class MediaFileRead(ORMReadModel):
    id: UUID
    post_id: UUID
    file_name: str
    file_type: str
    file_url: str
    file_size: int
