from functools import lru_cache

from app.services.llm.base import LLMProvider
from app.services.llm.ollama import OllamaProvider


@lru_cache
def get_llm_provider() -> LLMProvider:
    return OllamaProvider()
