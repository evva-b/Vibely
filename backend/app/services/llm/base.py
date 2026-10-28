from typing import Mapping, Protocol, Sequence


class LLMError(Exception):
    """Base error for configured language model providers."""


class LLMUnavailableError(LLMError):
    """The configured model provider is unavailable or lacks the model."""


class LLMResponseError(LLMError):
    """The provider returned an unusable response."""


class LLMProvider(Protocol):
    @property
    def model_name(self) -> str: ...

    def generate_json(
        self,
        prompt: str,
        images: Sequence[bytes] = (),
        format_schema: Mapping[str, object] | None = None,
    ) -> str: ...

    def check_availability(self) -> None: ...
