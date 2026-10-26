from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.models import BoardStatus
from app.services.llm import LLMError, LLMProvider, get_llm_provider

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


@router.get("/health/llm", response_model=None)
def llm_health_check(
    provider: Annotated[LLMProvider, Depends(get_llm_provider)],
) -> dict[str, str | None] | JSONResponse:
    try:
        provider.check_availability()
    except LLMError as exc:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unavailable",
                "provider": "ollama",
                "model": provider.model_name or None,
                "detail": str(exc),
            },
        )
    return {
        "status": "ok",
        "provider": "ollama",
        "model": provider.model_name,
    }
