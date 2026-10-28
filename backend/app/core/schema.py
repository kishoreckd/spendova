"""Base classes and shared field types for request and response schemas."""

from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


class ApiModel(BaseModel):
    """Response DTO. Reads attributes straight from ORM objects."""

    model_config = ConfigDict(from_attributes=True)


class RequestModel(BaseModel):
    """Request body. Unknown fields are rejected so typos never pass silently."""

    model_config = ConfigDict(extra="forbid")


CurrencyCode = Annotated[str, Field(pattern=r"^[A-Z]{3}$")]
PositiveMoney = Annotated[Decimal, Field(gt=0)]
EMAIL_PATTERN = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
Email = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, max_length=320, pattern=EMAIL_PATTERN)]
OneTimeCode = Annotated[str, Field(pattern=r"^\d{6}$")]
