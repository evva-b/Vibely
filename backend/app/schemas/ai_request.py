from datetime import datetime
from uuid import UUID

from pydantic import field_validator

from app.schemas.base import ORMReadModel
from app.services.ai_conversations import extract_user_prompt


class AIRequestRead(ORMReadModel):
    id: UUID
    template_id: UUID | None
    brand_id: UUID
    request_type: str
    prompt: str
    response: str | None
    model: str
    created_at: datetime

    @field_validator("prompt", mode="before")
    @classmethod
    def hide_internal_prompt(cls, value: object) -> str:
        return extract_user_prompt(value)
