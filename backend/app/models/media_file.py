import uuid

from sqlalchemy import ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MediaFile(Base):
    __tablename__ = "MediaFile"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    post_id: Mapped[uuid.UUID] = mapped_column(
        "postid",
        Uuid(as_uuid=True),
        ForeignKey("Post.id", ondelete="CASCADE"),
        nullable=False,
    )
    file_name: Mapped[str] = mapped_column("filename", String(255), nullable=False)
    file_type: Mapped[str] = mapped_column("filetype", String(100), nullable=False)
    file_url: Mapped[str] = mapped_column("fileurl", String(500), nullable=False)
    file_size: Mapped[int] = mapped_column("filesize", Integer, nullable=False)

    post: Mapped["Post"] = relationship(
        back_populates="media_files",
        passive_deletes="all",
    )
