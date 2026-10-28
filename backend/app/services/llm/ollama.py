import logging
import re
from typing import Any

import httpx

from app.core.config import get_settings
from app.services.llm.base import LLMResponseError, LLMUnavailableError

logger = logging.getLogger(__name__)


class OllamaProvider:
    def __init__(
        self,
        base_url: str | None = None,
        model_name: str | None = None,
        timeout_seconds: float = 180.0,
    ) -> None:
        settings = get_settings()
        self._base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self._model_name = model_name if model_name is not None else settings.ollama_model.strip()
        self._timeout = httpx.Timeout(timeout_seconds, connect=5.0)

    @property
    def model_name(self) -> str:
        return self._model_name

    def _require_model(self) -> None:
        if not self._model_name:
            raise LLMUnavailableError(
                "OLLAMA_MODEL is not configured in the backend environment."
            )
        if len(self._model_name) > 100:
            raise LLMUnavailableError(
                "Configured Ollama model name exceeds the database model field limit."
            )

    @staticmethod
    def _log_http_error(response: httpx.Response) -> None:
        body = response.text[:500]
        body = re.sub(
            r"(?i)(authorization|api[_-]?key|token|password|secret)"
            r"(\s*[:=]\s*|\s+)(?:bearer\s+)?[^\s,;\"']+",
            r"\1=[REDACTED]",
            body,
        )
        body = " ".join(body.split())
        url = response.url.copy_with(
            username="",
            password="",
            query=None,
            fragment=None,
        )
        logger.warning(
            "Ollama HTTP error: method=%s url=%s status=%s response=%s",
            response.request.method,
            url,
            response.status_code,
            body if response.request.method == "GET" else "[omitted]",
        )

    def check_availability(self) -> None:
        self._require_model()
        try:
            response = httpx.get(
                f"{self._base_url}/api/tags",
                timeout=httpx.Timeout(10.0, connect=3.0),
                trust_env=False,
            )
            response.raise_for_status()
            payload: Any = response.json()
        except httpx.TimeoutException as exc:
            raise LLMUnavailableError("Ollama did not respond in time.") from exc
        except httpx.ConnectError as exc:
            raise LLMUnavailableError("Ollama is not reachable at the configured URL.") from exc
        except httpx.HTTPStatusError as exc:
            self._log_http_error(exc.response)
            raise LLMUnavailableError(
                f"Ollama health check failed with HTTP {exc.response.status_code}."
            ) from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise LLMUnavailableError("Ollama returned an invalid model list.") from exc

        models = payload.get("models") if isinstance(payload, dict) else None
        if not isinstance(models, list):
            raise LLMUnavailableError("Ollama returned an invalid model list.")
        installed_names = {
            item.get("name")
            for item in models
            if isinstance(item, dict) and isinstance(item.get("name"), str)
        }
        if self._model_name not in installed_names:
            raise LLMUnavailableError(
                f"Configured Ollama model '{self._model_name}' is not installed."
            )

    def generate_json(self, prompt: str) -> str:
        self._require_model()
        try:
            response = httpx.post(
                f"{self._base_url}/api/generate",
                json={
                    "model": self._model_name,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                },
                timeout=self._timeout,
                trust_env=False,
            )
            response.raise_for_status()
            payload: Any = response.json()
        except httpx.TimeoutException as exc:
            raise LLMUnavailableError("Ollama generation timed out.") from exc
        except httpx.ConnectError as exc:
            raise LLMUnavailableError("Ollama is not reachable at the configured URL.") from exc
        except httpx.HTTPStatusError as exc:
            response_body = exc.response.text[:1000].lower()
            if "model" in response_body and (
                "not found" in response_body or "does not exist" in response_body
            ):
                raise LLMUnavailableError(
                    f"Configured Ollama model '{self._model_name}' is not installed."
                ) from exc
            raise LLMResponseError("Ollama rejected the generation request.") from exc
        except httpx.HTTPError as exc:
            raise LLMUnavailableError("Could not communicate with Ollama.") from exc
        except ValueError as exc:
            raise LLMResponseError("Ollama returned invalid JSON.") from exc

        if not isinstance(payload, dict):
            raise LLMResponseError("Ollama returned an invalid response.")
        generated = payload.get("response")
        if not isinstance(generated, str) or not generated.strip():
            raise LLMResponseError("Ollama returned an empty response.")
        return generated.strip()
