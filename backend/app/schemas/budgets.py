from datetime import date
from decimal import Decimal

from pydantic import Field, model_validator

from app.core.schema import ApiModel, PositiveMoney, RequestModel


class BudgetLineCreate(RequestModel):
    category_id: str
    amount_limit: PositiveMoney


class BudgetCreate(RequestModel):
    name: str = Field(min_length=1, max_length=100)
    month: date
    total_limit: PositiveMoney
    lines: list[BudgetLineCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_lines(self) -> "BudgetCreate":
        if len({line.category_id for line in self.lines}) != len(self.lines):
            raise ValueError("budget categories must be unique")
        if sum((line.amount_limit for line in self.lines), Decimal(0)) > self.total_limit:
            raise ValueError("category limits cannot exceed the total budget")
        return self


class BudgetLineRead(ApiModel):
    id: str
    category_id: str
    amount_limit: Decimal


class BudgetRead(ApiModel):
    id: str
    name: str
    month: date
    total_limit: Decimal
    lines: list[BudgetLineRead]


class BudgetLineStatus(ApiModel):
    category_id: str
    limit: Decimal
    spent: Decimal
    remaining: Decimal


class BudgetStatus(ApiModel):
    budget_id: str
    limit: Decimal
    spent: Decimal
    remaining: Decimal
    lines: list[BudgetLineStatus]
