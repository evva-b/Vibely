from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models import SocialNetwork, User
from app.schemas.social_network import SocialNetworkRead

router = APIRouter(prefix="/api/social-networks", tags=["social networks"])
DbSession = Annotated[Session, Depends(get_db_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.get("", response_model=list[SocialNetworkRead])
def list_social_networks(
    session: DbSession,
    _current_user: CurrentUser,
) -> list[SocialNetwork]:
    return list(
        session.scalars(
            select(SocialNetwork).order_by(SocialNetwork.name, SocialNetwork.id)
        ).all()
    )
