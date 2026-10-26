import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Brand(Base):
    __tablename__ = "Brand"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        "userid",
        Uuid(as_uuid=True),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_audience: Mapped[str | None] = mapped_column(
        "targetaudience",
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdat",
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    user: Mapped["User"] = relationship(
        back_populates="brands",
        passive_deletes="all",
    )
    tone_of_voice: Mapped["ToneOfVoice | None"] = relationship(
        back_populates="brand",
        uselist=False,
        passive_deletes="all",
    )
    topics: Mapped[list["Topic"]] = relationship(
        back_populates="brand",
        passive_deletes="all",
    )
    templates: Mapped[list["Template"]] = relationship(
        back_populates="brand",
        passive_deletes="all",
    )
    ai_requests: Mapped[list["AIRequest"]] = relationship(
        back_populates="brand",
        passive_deletes="all",
    )
    posts: Mapped[list["Post"]] = relationship(
        back_populates="brand",
        passive_deletes="all",
    )


class ToneOfVoice(Base):
    __tablename__ = "ToneOfVoice"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    brand_id: Mapped[uuid.UUID] = mapped_column(
        "brandid",
        Uuid(as_uuid=True),
        ForeignKey("Brand.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    style: Mapped[str] = mapped_column(Text, nullable=False)
    vocabulary: Mapped[str | None] = mapped_column(Text, nullable=True)
    communication_rules: Mapped[str | None] = mapped_column(
        "communicationrules",
        Text,
        nullable=True,
    )
    forbidden_words: Mapped[str | None] = mapped_column(
        "forbiddenwords",
        Text,
        nullable=True,
    )

    brand: Mapped["Brand"] = relationship(
        back_populates="tone_of_voice",
        passive_deletes="all",
    )


class Topic(Base):
    __tablename__ = "Topic"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    brand_id: Mapped[uuid.UUID] = mapped_column(
        "brandid",
        Uuid(as_uuid=True),
        ForeignKey("Brand.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)

    brand: Mapped["Brand"] = relationship(
        back_populates="topics",
        passive_deletes="all",
    )


class Template(Base):
    __tablename__ = "Template"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    brand_id: Mapped[uuid.UUID] = mapped_column(
        "brandid",
        Uuid(as_uuid=True),
        ForeignKey("Brand.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)

    brand: Mapped["Brand"] = relationship(
        back_populates="templates",
        passive_deletes="all",
    )
    ai_requests: Mapped[list["AIRequest"]] = relationship(
        back_populates="template",
        passive_deletes="all",
    )
