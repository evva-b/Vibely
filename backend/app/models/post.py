import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, Uuid, text as sql_text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Post(Base):
    __tablename__ = "Post"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    ai_request_id: Mapped[uuid.UUID | None] = mapped_column(
        "airequestid",
        Uuid(as_uuid=True),
        ForeignKey("AIRequest.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
    board_status_id: Mapped[uuid.UUID] = mapped_column(
        "boardstatusid",
        Uuid(as_uuid=True),
        ForeignKey("BoardStatus.id", ondelete="RESTRICT"),
        nullable=False,
    )
    brand_id: Mapped[uuid.UUID] = mapped_column(
        "brandid",
        Uuid(as_uuid=True),
        ForeignKey("Brand.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        "createdat",
        nullable=False,
        server_default=sql_text("CURRENT_TIMESTAMP"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedat",
        nullable=False,
        server_default=sql_text("CURRENT_TIMESTAMP"),
    )

    ai_request: Mapped["AIRequest | None"] = relationship(
        back_populates="post",
        uselist=False,
        passive_deletes="all",
    )
    board_status: Mapped["BoardStatus"] = relationship(
        back_populates="posts",
        passive_deletes="all",
    )
    brand: Mapped["Brand"] = relationship(
        back_populates="posts",
        passive_deletes="all",
    )
    adapted_contents: Mapped[list["AdaptedContent"]] = relationship(
        back_populates="post",
        passive_deletes="all",
    )
    media_files: Mapped[list["MediaFile"]] = relationship(
        back_populates="post",
        passive_deletes="all",
    )
