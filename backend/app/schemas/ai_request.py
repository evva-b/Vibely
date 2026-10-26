from datetime import datetime
from uuid import UUID

from app.schemas.base import ORMReadModel


class AIRequestRead(ORMReadModel):
    id: UUID
    template_id: UUID | None
    brand_id: UUID
    request_type: str
    prompt: str
    response: str | None
    model: str
    created_at: datetime
