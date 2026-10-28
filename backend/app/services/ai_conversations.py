import json
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.models import AIRequest, Post


def extract_user_prompt(value: object) -> str:
    if not isinstance(value, str):
        return ""
    start_tag = "<user_task>"
    end_tag = "</user_task>"
    if start_tag in value and end_tag in value:
        serialized_task = value.split(start_tag, 1)[1].split(end_tag, 1)[0]
        try:
            task = json.loads(serialized_task)
        except json.JSONDecodeError:
            return ""
        if isinstance(task, dict) and isinstance(task.get("request"), str):
            return task["request"]
        return ""
    if any(tag in value for tag in ("<brand_context>", "<tone_of_voice>", "Output requirements", "You create useful")):
        return ""
    return value


def parse_response_payload(request: AIRequest) -> dict[str, Any]:
    if not request.response:
        return {}
    try:
        payload = json.loads(request.response)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def get_chat_messages(request: AIRequest) -> list[dict[str, Any]]:
    payload = parse_response_payload(request)
    stored_messages = payload.get("messages")
    if isinstance(stored_messages, list):
        messages = [
            item
            for item in stored_messages
            if isinstance(item, dict)
            and item.get("role") in {"user", "assistant"}
            and isinstance(item.get("content"), str)
        ]
        if messages:
            return messages

    messages: list[dict[str, Any]] = []
    user_prompt = extract_user_prompt(request.prompt)
    if user_prompt:
        messages.append(
            {
                "id": str(uuid4()),
                "role": "user",
                "content": user_prompt,
                "created_at": request.created_at.isoformat(),
                "kind": "post",
            }
        )
    if request.response:
        messages.append(
            {
                "id": str(uuid4()),
                "role": "assistant",
                "content": request.response,
                "created_at": request.created_at.isoformat(),
                "kind": "post",
            }
        )
    return messages


def ensure_post_chat(
    session: Session,
    post: Post,
    model_name: str,
) -> tuple[AIRequest, list[dict[str, Any]], bool]:
    if post.ai_request_id is not None:
        request = session.get(AIRequest, post.ai_request_id)
        if request is None or request.brand_id != post.brand_id:
            raise ValueError("The post's AI conversation is inconsistent.")
        payload = parse_response_payload(request)
        raw_messages = payload.get("messages")
        messages = get_chat_messages(request)
        migrated = not isinstance(raw_messages, list)
        if migrated:
            payload["messages"] = messages
            request.response = json.dumps(payload, ensure_ascii=False)
        return request, messages, migrated

    request = AIRequest(
        id=uuid4(),
        brand_id=post.brand_id,
        template_id=None,
        request_type="post_chat",
        prompt="",
        response=json.dumps({"messages": []}, ensure_ascii=False),
        model=model_name,
    )
    post.ai_request_id = request.id
    session.add(request)
    return request, [], True


def new_chat_message(
    role: str,
    content: str,
    *,
    kind: str = "post",
    platform: str | None = None,
    image_data: str | None = None,
    image_type: str | None = None,
) -> dict[str, Any]:
    message = {
        "id": str(uuid4()),
        "role": role,
        "content": content,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "kind": kind,
        "platform": platform,
        "feedback": None,
    }
    if image_data is not None and image_type is not None:
        message["image_data"] = image_data
        message["image_type"] = image_type
    return message


def save_chat_response(
    request: AIRequest,
    messages: list[dict[str, Any]],
    **response_fields: Any,
) -> None:
    payload = parse_response_payload(request)
    payload.update(response_fields)
    retained_messages = messages[-100:]
    image_messages = [
        message
        for message in retained_messages
        if message.get("image_data") is not None
    ]
    for message in image_messages[:-10]:
        message.pop("image_data", None)
        message.pop("image_type", None)
    payload["messages"] = retained_messages
    request.response = json.dumps(payload, ensure_ascii=False)


def parse_message_id(value: object) -> UUID | None:
    try:
        return UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return None
