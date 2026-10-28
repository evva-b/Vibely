from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.schemas.ai_request import AIRequestRead
from app.schemas.base import NonEmptyString, ORMReadModel
from app.schemas.post import PostRead


class PostChatMessageCreate(ORMReadModel):
    prompt: NonEmptyString = Field(max_length=5000)
    social_network_id: UUID | None = None
    style: NonEmptyString | None = Field(default=None, max_length=100)
    image_data: str | None = Field(default=None, max_length=900_000)
    image_type: Literal["image/jpeg", "image/png", "image/webp"] | None = None

    @field_validator("image_data")
    @classmethod
    def validate_image_data(cls, value: str | None) -> str | None:
        if value is None:
            return None
        import base64
        import binascii

        try:
            decoded = base64.b64decode(value, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Image data must be valid base64.") from exc
        if not decoded or len(decoded) > 650_000:
            raise ValueError("Image must not exceed 650 KB after compression.")
        return value

    @model_validator(mode="after")
    def validate_image_fields(self) -> "PostChatMessageCreate":
        if (self.image_data is None) != (self.image_type is None):
            raise ValueError("Image data and image type must be supplied together.")
        return self


class PostChatContextUpdate(ORMReadModel):
    social_network_id: UUID
    style: NonEmptyString = Field(max_length=100)


class ChatFeedbackUpdate(ORMReadModel):
    rating: Literal["up", "down"] | None = None


class ChatMessageRead(ORMReadModel):
    id: UUID
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime
    kind: Literal["post", "adaptation"] = "post"
    platform: str | None = None
    feedback: Literal["up", "down"] | None = None
    image_data: str | None = None
    image_type: Literal["image/jpeg", "image/png", "image/webp"] | None = None


class PostChatContextRead(ORMReadModel):
    social_network_id: UUID | None = None
    social_network: str | None = None
    style: str | None = None


class PostChatRead(ORMReadModel):
    post: PostRead
    request: AIRequestRead
    messages: list[ChatMessageRead] = Field(default_factory=list)
    context: PostChatContextRead = Field(default_factory=PostChatContextRead)


class ChatFeedbackRead(ORMReadModel):
    message_id: UUID
    rating: Literal["up", "down"] | None
