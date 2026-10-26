from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api._transactions import commit_session
from app.db.session import get_db_session
from app.dependencies.brands import CurrentUserBrand, CurrentUserTemplate
from app.models import Template
from app.schemas.template import TemplateCreate, TemplateRead, TemplateUpdate

router = APIRouter(tags=["templates"])
DbSession = Annotated[Session, Depends(get_db_session)]


@router.post(
    "/api/brands/{brand_id}/templates",
    response_model=TemplateRead,
    status_code=status.HTTP_201_CREATED,
)
def create_template(
    payload: TemplateCreate,
    brand: CurrentUserBrand,
    session: DbSession,
) -> Template:
    template = Template(id=uuid4(), brand_id=brand.id, **payload.model_dump())
    session.add(template)
    commit_session(session)
    session.refresh(template)
    return template


@router.get(
    "/api/brands/{brand_id}/templates",
    response_model=list[TemplateRead],
)
def list_templates(
    brand: CurrentUserBrand,
    session: DbSession,
) -> list[Template]:
    return list(
        session.scalars(
            select(Template)
            .where(Template.brand_id == brand.id)
            .order_by(Template.name, Template.id)
        ).all()
    )


@router.get("/api/templates/{template_id}", response_model=TemplateRead)
def get_template(template: CurrentUserTemplate) -> Template:
    return template


@router.patch("/api/templates/{template_id}", response_model=TemplateRead)
def update_template(
    payload: TemplateUpdate,
    template: CurrentUserTemplate,
    session: DbSession,
) -> Template:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(template, field, value)
    commit_session(session)
    session.refresh(template)
    return template


@router.delete(
    "/api/templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_template(
    template: CurrentUserTemplate,
    session: DbSession,
) -> Response:
    session.delete(template)
    commit_session(session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
