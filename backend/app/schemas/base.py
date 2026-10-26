from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints


NonEmptyString = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1),
]


class ORMReadModel(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
