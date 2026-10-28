from fastapi.testclient import TestClient


def test_ollama_health(client: TestClient) -> None:
    response = client.get("/api/health/llm")

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "ok"
    assert response.json()["provider"] == "ollama"


def test_generate_post(
    client: TestClient,
    auth_headers: dict[str, str],
    brand: dict[str, object],
    board_status_ids: list[str],
    social_network_id: str,
) -> None:
    response = client.post(
        f"/api/brands/{brand['id']}/generate-post",
        headers=auth_headers,
        json={
            "prompt": "Напиши короткий полезный пост о том, как выбрать кофе.",
            "board_status_id": board_status_ids[0],
            "social_network_id": social_network_id,
            "style": "Дружелюбный и понятный",
        },
    )

    assert response.status_code == 201, response.text
    generated_post = response.json()["post"]
    assert generated_post["title"].strip()
    assert generated_post["text"].strip()
    assert response.json()["ai_request_id"]


def test_generate_adaptation(
    client: TestClient,
    auth_headers: dict[str, str],
    post: dict[str, object],
    social_network_id: str,
) -> None:
    response = client.post(
        f"/api/posts/{post['id']}/generate-adaptation",
        headers=auth_headers,
        json={
            "social_network_id": social_network_id,
            "style": "Кратко и дружелюбно",
        },
    )

    assert response.status_code == 201, response.text
    adaptation = response.json()["adaptation"]
    assert adaptation["text"].strip()
    assert adaptation["post_id"] == post["id"]
    assert adaptation["social_network_id"] == social_network_id
