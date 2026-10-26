from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.models import BoardStatus

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/db")
def database_health_check(
    session: Annotated[Session, Depends(get_db_session)],
) -> dict[str, str]:
    database_name = session.execute(text("SELECT current_database()")).scalar_one()
    return {"status": "ok", "database": database_name}


@router.get("/health/orm")
def orm_health_check(
    session: Annotated[Session, Depends(get_db_session)],
) -> dict[str, object]:
    board_statuses = session.scalars(
        select(BoardStatus).order_by(BoardStatus.position)
    ).all()
    return {
        "status": "ok",
        "boardStatuses": [
            {
                "id": str(board_status.id),
                "name": board_status.name,
                "position": board_status.position,
            }
            for board_status in board_statuses
        ],
    }
