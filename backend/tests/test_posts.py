from fastapi.testclient import TestClient


def test_create_post(
    client: TestClient,
    auth_headers: dict[str, str],
    brand: dict[str, object],
    board_status_ids: list[str],
) -> None:
    response = client.post(
        f"/api/brands/{brand['id']}/posts",
        headers=auth_headers,
        json={
            "title": "A new post",
            "text": "Post text for the API test.",
            "board_status_id": board_status_ids[0],
        },
    )

    assert response.status_code == 201
    assert response.json()["title"] == "A new post"
    assert response.json()["brand_id"] == brand["id"]


def test_list_posts(
    client: TestClient,
    auth_headers: dict[str, str],
    brand: dict[str, object],
    board_status_ids: list[str],
) -> None:
    for title in ("First test post", "Second test post"):
        created = client.post(
            f"/api/brands/{brand['id']}/posts",
            headers=auth_headers,
            json={
                "title": title,
                "text": "Post text.",
                "board_status_id": board_status_ids[0],
            },
        )
        assert created.status_code == 201, created.text

    response = client.get(
        f"/api/brands/{brand['id']}/posts",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert {item["title"] for item in response.json()} >= {
        "First test post",
        "Second test post",
    }


def test_update_post(
    client: TestClient,
    auth_headers: dict[str, str],
    post: dict[str, object],
) -> None:
    response = client.patch(
        f"/api/posts/{post['id']}",
        headers=auth_headers,
        json={"title": "Edited test post", "text": "Edited post text."},
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Edited test post"
    assert response.json()["text"] == "Edited post text."


def test_change_post_status(
    client: TestClient,
    auth_headers: dict[str, str],
    post: dict[str, object],
    board_status_ids: list[str],
) -> None:
    response = client.patch(
        f"/api/posts/{post['id']}",
        headers=auth_headers,
        json={"board_status_id": board_status_ids[1]},
    )

    assert response.status_code == 200
    assert response.json()["board_status_id"] == board_status_ids[1]


def test_delete_post(
    client: TestClient,
    auth_headers: dict[str, str],
    post: dict[str, object],
) -> None:
    response = client.delete(f"/api/posts/{post['id']}", headers=auth_headers)

    assert response.status_code == 204
    missing_post = client.get(f"/api/posts/{post['id']}", headers=auth_headers)
    assert missing_post.status_code == 404
