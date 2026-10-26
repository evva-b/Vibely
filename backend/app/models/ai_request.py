import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AIRequest(Base):
    __tablename__ = "AIRequest"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        "templateid",
        Uuid(as_uuid=True),
        ForeignKey("Template.id", ondelete="SET NULL"),
        nullable=True,
    )
    brand_id: Mapped[uuid.UUID] = mapped_column(
        "brandid",
        Uuid(as_uuid=True),
        ForeignKey("Brand.id", ondelete="CASCADE"),
        nullable=False,
    )
    request_type: Mapped[str] = mapped_column(
        "requesttype",
        String(50),
        nullable=False,
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    response: Mapped[str | None] = mapped_column(Text, nullable=True)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        "createdat",
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    template: Mapped["Template | None"] = relationship(
        back_populates="ai_requests",
        passive_deletes="all",
    )
    brand: Mapped["Brand"] = relationship(
        back_populates="ai_requests",
        passive_deletes="all",
    )
    post: Mapped["Post | None"] = relationship(
        back_populates="ai_request",
        uselist=False,
        passive_deletes="all",
    )
