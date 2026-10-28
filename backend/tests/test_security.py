from fastapi.testclient import TestClient


def test_user_cannot_get_another_users_brand(
    client: TestClient,
    brand: dict[str, object],
    user_factory,
) -> None:
    other_user = user_factory()

    response = client.get(
        f"/api/brands/{brand['id']}",
        headers=other_user["headers"],
    )

    assert response.status_code == 404


def test_user_cannot_get_another_users_post(
    client: TestClient,
    auth_headers: dict[str, str],
    post: dict[str, object],
    user_factory,
) -> None:
    other_user = user_factory()

    response = client.get(
        f"/api/posts/{post['id']}",
        headers=other_user["headers"],
    )

    assert response.status_code == 404
