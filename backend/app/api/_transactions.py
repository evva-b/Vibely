from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


def utc_naive_timestamp_after(previous: datetime) -> datetime:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    return max(now, previous + timedelta(microseconds=1))


def commit_session(session: Session) -> None:
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The requested change conflicts with existing data",
        ) from exc
    except Exception:
        session.rollback()
        raise
