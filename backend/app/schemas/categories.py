from decimal import Decimal
from typing import Annotated

from pydantic import Field, StringConstraints

from app.core.schema import ApiModel, RequestModel


class CategoryCreate(RequestModel):
    name: str = Field(min_length=1, max_length=80)
    category_type: str = Field(pattern=r"^(expense|income)$")
    icon: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=20)
    monthly_budget: Decimal | None = Field(default=None, ge=0)


class CategoryUpdate(RequestModel):
    """Partial update. The type is fixed once transactions may reference it."""

    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)] | None = None
    icon: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=20)
    monthly_budget: Decimal | None = Field(default=None, ge=0)


class CategoryRead(ApiModel):
    id: str
    name: str
    category_type: str
    icon: str | None
    color: str | None
    monthly_budget: Decimal | None
    archived: bool
    is_default: bool
