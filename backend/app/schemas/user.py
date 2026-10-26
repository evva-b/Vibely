from datetime import datetime
from uuid import UUID

from pydantic import EmailStr, Field, field_validator

from app.schemas.base import NonEmptyString, ORMReadModel


class UserCreate(ORMReadModel):
    name: NonEmptyString = Field(max_length=100)
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=1)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value


class UserRead(ORMReadModel):
    id: UUID
    name: str
    email: EmailStr
    created_at: datetime
