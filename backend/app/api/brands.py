from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api._transactions import commit_session
from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.dependencies.brands import CurrentUserBrand
from app.models import Brand, ToneOfVoice, User
from app.schemas.brand import BrandCreate, BrandRead, BrandUpdate
from app.schemas.tone_of_voice import (
    ToneOfVoiceCreate,
    ToneOfVoiceRead,
    ToneOfVoiceUpdate,
)

router = APIRouter(prefix="/api/brands", tags=["brands"])
DbSession = Annotated[Session, Depends(get_db_session)]


@router.post(
    "",
    response_model=BrandRead,
    status_code=status.HTTP_201_CREATED,
)
def create_brand(
    payload: BrandCreate,
    session: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> Brand:
    brand = Brand(
        id=uuid4(),
        user_id=current_user.id,
        **payload.model_dump(),
    )
    session.add(brand)
    commit_session(session)
    session.refresh(brand)
    return brand


@router.get("", response_model=list[BrandRead])
def list_brands(
    session: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[Brand]:
    return list(
        session.scalars(
            select(Brand)
            .where(Brand.user_id == current_user.id)
            .order_by(Brand.created_at, Brand.id)
        ).all()
    )


@router.get("/{brand_id}", response_model=BrandRead)
def get_brand(brand: CurrentUserBrand) -> Brand:
    return brand


@router.patch("/{brand_id}", response_model=BrandRead)
def update_brand(
    payload: BrandUpdate,
    brand: CurrentUserBrand,
    session: DbSession,
) -> Brand:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(brand, field, value)
    commit_session(session)
    session.refresh(brand)
    return brand


@router.delete("/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_brand(brand: CurrentUserBrand, session: DbSession) -> Response:
    session.delete(brand)
    commit_session(session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{brand_id}/tone-of-voice", response_model=ToneOfVoiceRead)
def get_tone_of_voice(
    brand: CurrentUserBrand,
    session: DbSession,
) -> ToneOfVoice:
    tone = session.scalar(
        select(ToneOfVoice).where(ToneOfVoice.brand_id == brand.id)
    )
    if tone is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tone of voice not found",
        )
    return tone


@router.put(
    "/{brand_id}/tone-of-voice",
    response_model=ToneOfVoiceRead,
)
def put_tone_of_voice(
    payload: ToneOfVoiceCreate,
    brand: CurrentUserBrand,
    session: DbSession,
) -> ToneOfVoice:
    tone = session.scalar(
        select(ToneOfVoice).where(ToneOfVoice.brand_id == brand.id)
    )
    if tone is None:
        tone = ToneOfVoice(id=uuid4(), brand_id=brand.id, **payload.model_dump())
        session.add(tone)
    else:
        for field, value in payload.model_dump().items():
            setattr(tone, field, value)
    commit_session(session)
    session.refresh(tone)
    return tone


@router.patch(
    "/{brand_id}/tone-of-voice",
    response_model=ToneOfVoiceRead,
)
def patch_tone_of_voice(
    payload: ToneOfVoiceUpdate,
    brand: CurrentUserBrand,
    session: DbSession,
) -> ToneOfVoice:
    tone = session.scalar(
        select(ToneOfVoice).where(ToneOfVoice.brand_id == brand.id)
    )
    if tone is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tone of voice not found",
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tone, field, value)
    commit_session(session)
    session.refresh(tone)
    return tone


@router.delete(
    "/{brand_id}/tone-of-voice",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_tone_of_voice(
    brand: CurrentUserBrand,
    session: DbSession,
) -> Response:
    tone = session.scalar(
        select(ToneOfVoice).where(ToneOfVoice.brand_id == brand.id)
    )
    if tone is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tone of voice not found",
        )
    session.delete(tone)
    commit_session(session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
