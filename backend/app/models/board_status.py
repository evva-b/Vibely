import uuid

from sqlalchemy import Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class BoardStatus(Base):
    __tablename__ = "BoardStatus"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    posts: Mapped[list["Post"]] = relationship(
        back_populates="board_status",
        passive_deletes="all",
    )
