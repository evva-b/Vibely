import uuid

from sqlalchemy import String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SocialNetwork(Base):
    __tablename__ = "SocialNetwork"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    adapted_contents: Mapped[list["AdaptedContent"]] = relationship(
        back_populates="social_network",
        passive_deletes="all",
    )
