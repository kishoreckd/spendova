from datetime import date
from decimal import Decimal

from pydantic import Field

from app.core.finance import TransactionType
from app.core.schema import ApiModel, CurrencyCode, PositiveMoney, RequestModel


class TransactionCreate(RequestModel):
    kind: TransactionType
    amount: PositiveMoney
    source: str = Field(min_length=1, max_length=100)
    destination: str = Field(min_length=1, max_length=100)
    source_account_id: str | None = None
    destination_account_id: str | None = None
    merchant: str | None = Field(default=None, max_length=160)
    occurred_on: date = Field(default_factory=date.today)
    currency: CurrencyCode = "INR"
    category_id: str | None = None
    recurring_rule_id: str | None = None
    notes: str | None = Field(default=None, max_length=500)


class EntryRead(ApiModel):
    target: str
    side: str
    amount: Decimal


class TransactionRead(ApiModel):
    id: str
    kind: str
    amount: Decimal
    currency: str
    source: str
    destination: str
    source_account_id: str | None
    destination_account_id: str | None
    merchant: str | None
    occurred_on: date
    category_id: str | None
    recurring_rule_id: str | None
    notes: str | None
    status: str
    entries: list[EntryRead]
