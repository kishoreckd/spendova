from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .domain import TransactionType


class ReadModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class GoogleAuthRequest(BaseModel):
    email: str | None = Field(default=None, max_length=320)
    name: str | None = Field(default=None, max_length=120)
    photo_url: str | None = Field(default=None, max_length=1000)


class UserRead(ReadModel):
    id: str
    email: str
    display_name: str | None
    photo_url: str | None
    base_currency: str
    country_code: str | None
    locale: str
    time_zone: str
    onboarding_completed: bool
    email_verified: bool


class VerificationCodeRequest(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")


class VerificationCodeSent(BaseModel):
    sent: bool
    expires_in_seconds: int
    development_code: str | None = None


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    base_currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    country_code: str | None = Field(default=None, pattern=r"^[A-Z]{2}$")
    locale: str | None = Field(default=None, min_length=2, max_length=20)
    time_zone: str | None = Field(default=None, min_length=1, max_length=80)
    onboarding_completed: bool | None = None


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    account_type: str = Field(min_length=1, max_length=30)
    currency: str = Field(default="INR", pattern=r"^[A-Z]{3}$")
    opening_balance: Decimal = Decimal(0)


class AccountRead(AccountCreate, ReadModel):
    id: str
    archived: bool


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    category_type: str = Field(pattern=r"^(expense|income)$")
    icon: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=20)
    monthly_budget: Decimal | None = Field(default=None, ge=0)


class CategoryRead(CategoryCreate, ReadModel):
    id: str
    archived: bool
    is_default: bool


class EntryRead(ReadModel):
    target: str
    side: str
    amount: Decimal


class TransactionCreate(BaseModel):
    kind: TransactionType
    amount: Decimal = Field(gt=0)
    source: str = Field(min_length=1, max_length=100)
    destination: str = Field(min_length=1, max_length=100)
    merchant: str | None = Field(default=None, max_length=160)
    occurred_on: date = Field(default_factory=date.today)
    currency: str = Field(default="INR", pattern=r"^[A-Z]{3}$")
    category_id: str | None = None
    notes: str | None = Field(default=None, max_length=500)


class TransactionRead(TransactionCreate, ReadModel):
    id: str
    status: str
    entries: list[EntryRead]


class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    target_amount: Decimal = Field(gt=0)
    saved_amount: Decimal = Field(default=Decimal(0), ge=0)
    months: int = Field(gt=0)

    @model_validator(mode="after")
    def saved_amount_cannot_exceed_target(self) -> "GoalCreate":
        if self.saved_amount > self.target_amount:
            raise ValueError("saved amount cannot exceed target")
        return self


class GoalRead(GoalCreate, ReadModel):
    id: str
    monthly_required: Decimal


class AssetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    asset_type: str = Field(min_length=1, max_length=50)
    purchase_price: Decimal = Field(gt=0)
    purchased_on: date
    currency: str = Field(default="INR", pattern=r"^[A-Z]{3}$")
    notes: str | None = Field(default=None, max_length=500)


class AssetRead(AssetCreate, ReadModel):
    id: str
    status: str
    age_days: int
    cost_per_day: Decimal


class BudgetLineCreate(BaseModel):
    category_id: str
    amount_limit: Decimal = Field(gt=0)


class BudgetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    month: date
    total_limit: Decimal = Field(gt=0)
    lines: list[BudgetLineCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_lines(self) -> "BudgetCreate":
        if len({line.category_id for line in self.lines}) != len(self.lines):
            raise ValueError("budget categories must be unique")
        if sum((line.amount_limit for line in self.lines), Decimal(0)) > self.total_limit:
            raise ValueError("category limits cannot exceed the total budget")
        return self


class BudgetLineRead(BudgetLineCreate, ReadModel):
    id: str


class BudgetRead(ReadModel):
    id: str
    name: str
    month: date
    total_limit: Decimal
    lines: list[BudgetLineRead]


class RecurringRuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kind: TransactionType
    amount: Decimal = Field(gt=0)
    currency: str = Field(default="INR", pattern=r"^[A-Z]{3}$")
    frequency: str = Field(pattern=r"^(daily|weekly|monthly|yearly)$")
    interval: int = Field(default=1, ge=1, le=365)
    next_due_on: date
    source: str = Field(min_length=1, max_length=100)
    destination: str = Field(min_length=1, max_length=100)
    category_id: str | None = None


class RecurringRuleRead(RecurringRuleCreate, ReadModel):
    id: str
    active: bool


class GoalContributionCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    contributed_on: date = Field(default_factory=date.today)
    note: str | None = Field(default=None, max_length=250)


class GoalContributionRead(GoalContributionCreate, ReadModel):
    id: str
    goal_id: str
