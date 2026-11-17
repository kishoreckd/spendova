from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import Field, StringConstraints, model_validator

from app.core.schema import ApiModel, CurrencyCode, RequestModel

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
ParticipantName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class TripCreate(RequestModel):
    name: Name
    destination: str | None = Field(default=None, max_length=160)
    start_on: date | None = None
    end_on: date | None = None
    mode: Literal["personal", "split"] = "personal"
    currency: CurrencyCode = "INR"
    budget: Decimal | None = Field(default=None, gt=0, le=1000000000, decimal_places=2)
    notes: str | None = Field(default=None, max_length=1000)
    participants: list[ParticipantName] = Field(default_factory=list, max_length=19)

    @model_validator(mode="after")
    def valid_dates(self):
        if self.start_on and self.end_on and self.end_on < self.start_on:
            raise ValueError("End date must be on or after the start date")
        if self.mode == "personal" and self.participants:
            raise ValueError("Personal trips cannot include other participants")
        return self


class ParticipantCreate(RequestModel):
    name: ParticipantName


class ShareInput(RequestModel):
    participant_id: str = Field(min_length=1, max_length=36)
    amount: Decimal = Field(gt=0, le=1000000000, decimal_places=2)


class TripExpenseCreate(RequestModel):
    description: Name
    category: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
    amount: Decimal = Field(gt=0, le=1000000000, decimal_places=2)
    occurred_on: date = Field(default_factory=date.today)
    payer_participant_id: str = Field(min_length=1, max_length=36)
    category_id: str = Field(min_length=1, max_length=36)
    split_mode: Literal["equal", "custom", "personal"] = "equal"
    participant_ids: list[str] = Field(default_factory=list, max_length=20)
    shares: list[ShareInput] = Field(default_factory=list, max_length=20)
    notes: str | None = Field(default=None, max_length=500)


class TripClose(RequestModel):
    confirm: Literal[True]


class ParticipantRead(ApiModel):
    id: str
    name: str
    is_user: bool


class ShareRead(ApiModel):
    participant_id: str
    amount: Decimal


class ExpenseRead(ApiModel):
    id: str
    description: str
    category: str
    amount: Decimal
    occurred_on: date
    payer_participant_id: str
    category_id: str
    split_mode: str
    notes: str | None
    posted_transaction_id: str | None
    shares: list[ShareRead]


class BalanceRead(ApiModel):
    participant_id: str
    name: str
    paid: Decimal
    share: Decimal
    balance: Decimal


class TripRead(ApiModel):
    id: str
    name: str
    destination: str | None
    start_on: date | None
    end_on: date | None
    mode: str
    status: str
    currency: str
    budget: Decimal | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    participants: list[ParticipantRead]
    expenses: list[ExpenseRead]
    balances: list[BalanceRead]
    total_spent: Decimal
    user_share: Decimal
    user_paid: Decimal
    others_owe_user: Decimal
    user_owes_others: Decimal
