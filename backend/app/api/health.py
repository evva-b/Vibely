from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db_session

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
