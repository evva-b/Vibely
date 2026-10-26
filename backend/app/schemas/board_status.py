from uuid import UUID

from app.schemas.base import ORMReadModel


class BoardStatusRead(ORMReadModel):
    id: UUID
    name: str
    position: int
