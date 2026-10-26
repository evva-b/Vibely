from uuid import UUID

from app.schemas.base import ORMReadModel


class SocialNetworkRead(ORMReadModel):
    id: UUID
    name: str
    description: str | None
