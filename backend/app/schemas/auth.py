from typing import Literal

from pydantic import EmailStr, Field, field_validator

from app.schemas.base import ORMReadModel


class LoginRequest(ORMReadModel):
    email: EmailStr
    password: str = Field(min_length=1)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value


class TokenResponse(ORMReadModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
