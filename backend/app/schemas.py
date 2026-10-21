from datetime import date
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

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


EMAIL_PATTERN = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
ResetEmail = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, max_length=320, pattern=EMAIL_PATTERN)]


class PasswordResetRequest(BaseModel):
    email: ResetEmail


class PasswordResetRequested(BaseModel):
    """Identical for every email address so accounts cannot be discovered."""

    sent: bool
    expires_in_seconds: int
    resend_after_seconds: int
    development_code: str | None = None


class PasswordResetVerify(BaseModel):
    email: ResetEmail
    code: str = Field(pattern=r"^\d{6}$")


class PasswordResetVerified(BaseModel):
    reset_token: str
    expires_in_seconds: int


class PasswordResetComplete(BaseModel):
    reset_token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def strong_enough(self) -> "PasswordResetComplete":
        password = self.new_password
        if password.strip() != password:
            raise ValueError("Password can't start or end with a space")
        if not any(char.isalpha() for char in password) or not any(char.isdigit() for char in password):
            raise ValueError("Use at least one letter and one number")
        return self


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
    institution: str | None = Field(default=None, max_length=100)
    principal_amount: Decimal | None = Field(default=None, gt=0)
    annual_interest_rate: Decimal | None = Field(default=None, ge=0, le=100)
    started_on: date | None = None
    maturity_on: date | None = None
    tenure_months: int | None = Field(default=None, ge=1, le=1200)
    installment_amount: Decimal | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_financial_account(self) -> "AccountCreate":
        if self.account_type not in {"bank", "credit", "cash", "investment", "loan", "fixed_deposit", "recurring_deposit"}:
            raise ValueError("choose a supported account type")
        if self.account_type in {"fixed_deposit", "recurring_deposit"} and not self.tenure_months:
            raise ValueError("deposit tenure is required")
        if self.account_type == "fixed_deposit" and not self.principal_amount:
            raise ValueError("fixed deposit amount is required")
        if self.account_type == "recurring_deposit" and not self.installment_amount:
            raise ValueError("recurring deposit installment is required")
        return self


class AccountRead(AccountCreate, ReadModel):
    id: str
    archived: bool
    current_balance: Decimal


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


class CategoryUpdate(BaseModel):
    """Partial update. The type is fixed once transactions may reference it."""

    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)] | None = None
    icon: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=20)
    monthly_budget: Decimal | None = Field(default=None, ge=0)


class EntryRead(ReadModel):
    target: str
    side: str
    amount: Decimal


class TransactionCreate(BaseModel):
    kind: TransactionType
    amount: Decimal = Field(gt=0)
    source: str = Field(min_length=1, max_length=100)
    destination: str = Field(min_length=1, max_length=100)
    source_account_id: str | None = None
    destination_account_id: str | None = None
    merchant: str | None = Field(default=None, max_length=160)
    occurred_on: date = Field(default_factory=date.today)
    currency: str = Field(default="INR", pattern=r"^[A-Z]{3}$")
    category_id: str | None = None
    recurring_rule_id: str | None = None
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


AssetName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
AssetType = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
LifeMonths = Annotated[int, Field(ge=1, le=600)]
DailyTarget = Annotated[Decimal, Field(gt=0, max_digits=19, decimal_places=4)]
GOAL_CONFLICT = "choose either an expected life or a target cost per day, not both"


class AssetCreate(BaseModel):
    name: AssetName
    asset_type: AssetType
    purchase_price: Decimal = Field(gt=0)
    purchased_on: date
    currency: str = Field(default="INR", pattern=r"^[A-Z]{3}$")
    notes: str | None = Field(default=None, max_length=500)
    expected_life_months: LifeMonths | None = None
    target_cost_per_day: DailyTarget | None = None

    @model_validator(mode="after")
    def one_replacement_goal(self) -> "AssetCreate":
        if self.expected_life_months and self.target_cost_per_day:
            raise ValueError(GOAL_CONFLICT)
        return self


class AssetUpdate(BaseModel):
    """Partial update; send a goal field as null to remove it."""

    name: AssetName | None = None
    asset_type: AssetType | None = None
    purchase_price: Decimal | None = Field(default=None, gt=0)
    purchased_on: date | None = None
    notes: str | None = Field(default=None, max_length=500)
    expected_life_months: LifeMonths | None = None
    target_cost_per_day: DailyTarget | None = None


class ReplacementGoalRead(ReadModel):
    target_cost_per_day: Decimal
    days_needed: int
    reached_on: date
    days_remaining: int
    progress_percent: int
    reached: bool


class AssetRead(AssetCreate, ReadModel):
    id: str
    status: str
    age_days: int
    cost_per_day: Decimal
    replacement_goal: ReplacementGoalRead | None


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


class BudgetLineStatus(BaseModel):
    category_id: str
    limit: Decimal
    spent: Decimal
    remaining: Decimal


class BudgetStatus(BaseModel):
    budget_id: str
    limit: Decimal
    spent: Decimal
    remaining: Decimal
    lines: list[BudgetLineStatus]


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
    source_account_id: str | None = None
    destination_account_id: str | None = None
    category_id: str | None = None
    plan_type: str | None = Field(default=None, pattern=r"^(bill|income|investment)$")
    cost_amount: Decimal | None = Field(default=None, ge=0)
    annual_return_rate: Decimal | None = Field(default=None, ge=0, le=100)
    tenure_months: int | None = Field(default=None, ge=1, le=1200)


class RecurringRuleRead(RecurringRuleCreate, ReadModel):
    id: str
    active: bool


class RecurringPaymentCreate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0)
    paid_on: date = Field(default_factory=date.today)


class RecurringPaymentRead(BaseModel):
    commitment: RecurringRuleRead
    transaction: TransactionRead


class GoalContributionCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    contributed_on: date = Field(default_factory=date.today)
    note: str | None = Field(default=None, max_length=250)


class GoalContributionRead(GoalContributionCreate, ReadModel):
    id: str
    goal_id: str
