from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from app.core.schema import ApiModel, RequestModel


class FinanceSnapshot(ApiModel):
    as_of: date
    currency: str
    period_start: date
    period_end: date
    average_income: Decimal
    average_spending: Decimal
    monthly_emi: Decimal
    monthly_goal_saving: Decimal
    monthly_headroom: Decimal
    income_months: int
    excluded_currency_transactions: int
    deposits: list[dict] = Field(default_factory=list)
    loans: list[dict]
    warnings: list[str]
    ai_available: bool


class PurchaseScenario(RequestModel):
    price: Decimal = Field(gt=0, le=1000000000, max_digits=12, decimal_places=2)
    down_payment: Decimal = Field(default=Decimal(0), ge=0, le=1000000000)
    months: int = Field(default=12, ge=1, le=480)
    annual_rate: Decimal = Field(default=Decimal(0), ge=0, le=100)


class ChatTurn(RequestModel):
    role: Literal["user", "assistant"]
    content: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=6000)]


class AssistantRequest(RequestModel):
    question: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)
    scenario: PurchaseScenario | None = None
    use_ai: bool = False


class AssistantReply(ApiModel):
    answer: str
    mode: Literal["local", "ai"]
    snapshot: FinanceSnapshot
    calculation: dict[str, str | int | None] | None = None


class DepositScenario(RequestModel):
    kind: Literal["fixed_deposit", "recurring_deposit"]
    amount: Decimal = Field(gt=0, le=1000000000, max_digits=12, decimal_places=2)
    annual_rate: Decimal = Field(ge=0, le=100)
    months: int = Field(ge=1, le=1200)
