from collections.abc import Callable, Generator
from typing import TypedDict
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session

from app.db.session import get_db_session, get_engine
from app.main import app
from app.models import BoardStatus, SocialNetwork


class UserContext(TypedDict):
    user: dict[str, object]
    email: str
    headers: dict[str, str]


@pytest.fixture
def db_connection() -> Generator[Connection, None, None]:
    connection = get_engine().connect()
    transaction = connection.begin()
    try:
        yield connection
    finally:
        if transaction.is_active:
            transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_connection) -> Generator[TestClient, None, None]:
    previous_overrides = app.dependency_overrides.copy()

    def override_db_session() -> Generator[Session, None, None]:
        with Session(
            bind=db_connection,
            autoflush=False,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        ) as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db_session
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)


@pytest.fixture
def db_session(db_connection) -> Generator[Session, None, None]:
    with Session(
        bind=db_connection,
        autoflush=False,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    ) as session:
        yield session


@pytest.fixture
def board_status_ids(db_session: Session) -> list[str]:
    statuses = db_session.scalars(
        select(BoardStatus).order_by(BoardStatus.position, BoardStatus.id)
    ).all()
    if len(statuses) < 2:
        pytest.fail("At least two BoardStatus reference rows are required.")
    return [str(status.id) for status in statuses]


@pytest.fixture
def social_network_id(db_session: Session) -> str:
    network = db_session.scalar(select(SocialNetwork).order_by(SocialNetwork.name).limit(1))
    if network is None:
        pytest.fail("At least one SocialNetwork reference row is required.")
    return str(network.id)


@pytest.fixture
def user_factory(client: TestClient) -> Callable[[], UserContext]:
    def create_user() -> UserContext:
        email = f"pytest-{uuid4().hex}@example.com"
        registration = client.post(
            "/api/auth/register",
            json={
                "name": "Pytest User",
                "email": email,
                "password": "valid-test-password",
            },
        )
        assert registration.status_code == 201, registration.text

        login = client.post(
            "/api/auth/login",
            json={"email": email, "password": "valid-test-password"},
        )
        assert login.status_code == 200, login.text
        user = registration.json()
        token = login.json()["access_token"]
        return {
            "user": user,
            "email": email,
            "headers": {"Authorization": f"Bearer {token}"},
        }

    return create_user


@pytest.fixture
def registered_user(user_factory: Callable[[], UserContext]) -> UserContext:
    return user_factory()


@pytest.fixture
def auth_headers(registered_user: UserContext) -> dict[str, str]:
    return registered_user["headers"]


@pytest.fixture
def brand(
    client: TestClient,
    auth_headers: dict[str, str],
) -> dict[str, object]:
    response = client.post(
        "/api/brands",
        headers=auth_headers,
        json={
            "name": "Test Brand",
            "description": "A brand used by integration tests.",
            "target_audience": "Small business owners",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def post(
    client: TestClient,
    auth_headers: dict[str, str],
    brand: dict[str, object],
    board_status_ids: list[str],
) -> dict[str, object]:
    response = client.post(
        f"/api/brands/{brand['id']}/posts",
        headers=auth_headers,
        json={
            "title": "Integration test post",
            "text": "A test post with enough content for API checks.",
            "board_status_id": board_status_ids[0],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()
