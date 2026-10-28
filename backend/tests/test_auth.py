from fastapi.testclient import TestClient


def test_register_valid_user(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Valid Test User",
            "email": "valid-user@example.com",
            "password": "valid-test-password",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Valid Test User"
    assert data["email"] == "valid-user@example.com"
    assert "password" not in data
    assert "password_hash" not in data


def test_register_existing_email(
    client: TestClient,
    user_factory,
) -> None:
    existing_user = user_factory()

    response = client.post(
        "/api/auth/register",
        json={
            "name": "Duplicate User",
            "email": existing_user["email"],
            "password": "another-valid-password",
        },
    )

    assert response.status_code == 409


def test_login_valid_credentials(client: TestClient, user_factory) -> None:
    user = user_factory()

    response = client.post(
        "/api/auth/login",
        json={"email": user["email"], "password": "valid-test-password"},
    )

    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
    assert response.json()["access_token"]


def test_login_invalid_password(client: TestClient, user_factory) -> None:
    user = user_factory()

    response = client.post(
        "/api/auth/login",
        json={"email": user["email"], "password": "wrong-password"},
    )

    assert response.status_code == 401
