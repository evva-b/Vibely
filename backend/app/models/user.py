import uuid
from datetime import datetime

from sqlalchemy import String, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "User"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(
        "passwordhash",
        String(255),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdat",
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    brands: Mapped[list["Brand"]] = relationship(
        back_populates="user",
        passive_deletes="all",
    )
