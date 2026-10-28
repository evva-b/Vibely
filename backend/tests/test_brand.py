from fastapi.testclient import TestClient


def test_create_brand(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post(
        "/api/brands",
        headers=auth_headers,
        json={"name": "New Brand", "description": "A test description"},
    )

    assert response.status_code == 201
    assert response.json()["name"] == "New Brand"
    assert response.json()["user_id"]


def test_get_brand(
    client: TestClient,
    auth_headers: dict[str, str],
    brand: dict[str, object],
) -> None:
    response = client.get(f"/api/brands/{brand['id']}", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["id"] == brand["id"]
    assert response.json()["name"] == "Test Brand"


def test_update_brand(
    client: TestClient,
    auth_headers: dict[str, str],
    brand: dict[str, object],
) -> None:
    response = client.patch(
        f"/api/brands/{brand['id']}",
        headers=auth_headers,
        json={"name": "Updated Brand", "target_audience": "Creators"},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Updated Brand"
    assert response.json()["target_audience"] == "Creators"


def test_add_brand_topic(
    client: TestClient,
    auth_headers: dict[str, str],
    brand: dict[str, object],
) -> None:
    response = client.post(
        f"/api/brands/{brand['id']}/topics",
        headers=auth_headers,
        json={"name": "Product tips"},
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Product tips"
    assert response.json()["brand_id"] == brand["id"]
