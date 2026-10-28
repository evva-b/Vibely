from fastapi.testclient import TestClient


def test_add_image_metadata(
    client: TestClient,
    auth_headers: dict[str, str],
    post: dict[str, object],
) -> None:
    response = client.post(
        f"/api/posts/{post['id']}/media",
        headers=auth_headers,
        json={
            "file_name": "campaign-image.png",
            "file_type": "image/png",
            "file_url": "https://cdn.example.com/campaign-image.png",
            "file_size": 2048,
        },
    )

    assert response.status_code == 201, response.text
    assert response.json()["file_name"] == "campaign-image.png"
    assert response.json()["file_type"] == "image/png"
    assert response.json()["post_id"] == post["id"]


def test_reject_embedded_file_content(
    client: TestClient,
    auth_headers: dict[str, str],
    post: dict[str, object],
) -> None:
    response = client.post(
        f"/api/posts/{post['id']}/media",
        headers=auth_headers,
        json={
            "file_name": "image.png",
            "file_type": "image/png",
            "file_url": "data:image/png;base64,ZmFrZQ==",
            "file_size": 4,
        },
    )

    assert response.status_code == 422
