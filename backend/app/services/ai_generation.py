import logging
from typing import Sequence, TypeVar

from fastapi import HTTPException, status
from pydantic import BaseModel, ValidationError

from app.services.llm import (
    LLMError,
    LLMProvider,
    LLMResponseError,
    LLMUnavailableError,
)

OutputSchema = TypeVar("OutputSchema", bound=BaseModel)
logger = logging.getLogger(__name__)


def generate_json(
    provider: LLMProvider,
    prompt: str,
    images: Sequence[bytes] = (),
    output_schema: type[BaseModel] | None = None,
) -> str:
    try:
        format_schema = output_schema.model_json_schema() if output_schema else None
        return provider.generate_json(
            prompt,
            images=images,
            format_schema=format_schema,
        )
    except LLMUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except LLMResponseError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except LLMError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The configured language model service is unavailable.",
        ) from exc


def parse_output(model_type: type[OutputSchema], output: str) -> OutputSchema:
    try:
        return model_type.model_validate_json(output)
    except ValidationError as exc:
        details = [
            f"{'.'.join(str(part) for part in error['loc'])}:{error['type']}"
            for error in exc.errors(
                include_url=False,
                include_context=False,
                include_input=False,
            )
        ]
        logger.warning(
            "Language model output failed %s validation: %s",
            model_type.__name__,
            ", ".join(details),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The language model returned a response in an invalid format.",
        ) from exc
