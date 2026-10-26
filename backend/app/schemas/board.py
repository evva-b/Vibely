from uuid import UUID

from app.schemas.base import ORMReadModel
from app.schemas.post import PostRead


class BoardColumnRead(ORMReadModel):
    id: UUID
    name: str
    position: int
    posts: list[PostRead]
