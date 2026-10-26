from datetime import datetime
from uuid import UUID

from pydantic import EmailStr, Field

from app.schemas.base import NonEmptyString, ORMReadModel


class UserCreate(ORMReadModel):
    name: NonEmptyString = Field(max_length=100)
    email: EmailStr = Field(max_length=255)
    password: NonEmptyString


class UserRead(ORMReadModel):
    id: UUID
    name: str
    email: EmailStr
    created_at: datetime
