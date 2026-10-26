import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Text, Uuid, text as sql_text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AdaptedContent(Base):
    __tablename__ = "AdaptedContent"

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
    social_network_id: Mapped[uuid.UUID] = mapped_column(
        "socialnetworkid",
        Uuid(as_uuid=True),
        ForeignKey("SocialNetwork.id", ondelete="RESTRICT"),
        nullable=False,
    )
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

    post: Mapped["Post"] = relationship(
        back_populates="adapted_contents",
        passive_deletes="all",
    )
    social_network: Mapped["SocialNetwork"] = relationship(
        back_populates="adapted_contents",
        passive_deletes="all",
    )
