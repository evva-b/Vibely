from uuid import UUID

from app.schemas.base import ORMReadModel


class MediaFileRead(ORMReadModel):
    id: UUID
    post_id: UUID
    file_name: str
    file_type: str
    file_url: str
    file_size: int
