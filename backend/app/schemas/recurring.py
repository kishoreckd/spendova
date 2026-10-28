from datetime import date
from decimal import Decimal

from pydantic import Field

from app.core.finance import TransactionType
from app.core.schema import ApiModel, CurrencyCode, PositiveMoney, RequestModel
from app.schemas.transactions import TransactionRead


class RecurringRuleCreate(RequestModel):
    name: str = Field(min_length=1, max_length=120)
    kind: TransactionType
    amount: PositiveMoney
    currency: CurrencyCode = "INR"
    frequency: str = Field(pattern=r"^(daily|weekly|monthly|yearly)$")
    interval: int = Field(default=1, ge=1, le=365)
    next_due_on: date
    source: str = Field(min_length=1, max_length=100)
    destination: str = Field(min_length=1, max_length=100)
    source_account_id: str | None = None
    destination_account_id: str | None = None
    category_id: str | None = None
    plan_type: str | None = Field(default=None, pattern=r"^(bill|income|investment)$")
    cost_amount: Decimal | None = Field(default=None, ge=0)
    annual_return_rate: Decimal | None = Field(default=None, ge=0, le=100)
    tenure_months: int | None = Field(default=None, ge=1, le=1200)


class RecurringRuleRead(ApiModel):
    id: str
    name: str
    kind: str
    amount: Decimal
    currency: str
    frequency: str
    interval: int
    next_due_on: date
    source: str
    destination: str
    source_account_id: str | None
    destination_account_id: str | None
    category_id: str | None
    plan_type: str
    cost_amount: Decimal | None
    annual_return_rate: Decimal | None
    tenure_months: int | None
    active: bool


class RecurringPaymentCreate(RequestModel):
    amount: Decimal | None = Field(default=None, gt=0)
    paid_on: date = Field(default_factory=date.today)


class RecurringPaymentRead(ApiModel):
    commitment: RecurringRuleRead
    transaction: TransactionRead
