from datetime import date
from decimal import Decimal
from typing import Annotated

from pydantic import ConfigDict, Field, StringConstraints, model_validator

from app.constants.finance import LOAN_TYPES
from app.core.schema import ApiModel, PositiveMoney, RequestModel
from app.schemas.transactions import TransactionRead

LoanName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class LoanTerms(RequestModel):
    """Enough to calculate a schedule. Give the interest rate, the EMI, or both."""

    principal: PositiveMoney
    annual_interest_rate: Decimal | None = Field(default=None, ge=0, le=100)
    emi_amount: PositiveMoney | None = None
    tenure_months: int = Field(ge=1, le=480)
    first_due_on: date
    processing_fee: Decimal = Field(default=Decimal(0), ge=0)

    @model_validator(mode="after")
    def rate_or_emi(self) -> "LoanTerms":
        if self.annual_interest_rate is None and self.emi_amount is None:
            raise ValueError("Enter the interest rate, the monthly EMI, or both")
        return self


class LoanPreviewRequest(LoanTerms):
    """The loan form while it is being filled in; fields the calculation doesn't need are ignored."""

    model_config = ConfigDict(extra="ignore")

    installments_paid_before: int | None = Field(default=None, ge=0, le=480)


class LoanCreate(LoanTerms):
    name: LoanName
    loan_type: str = Field(min_length=1, max_length=30)
    lender: str | None = Field(default=None, max_length=100)
    # EMIs already paid before adding the loan. Omit to assume every EMI due so far was paid.
    installments_paid_before: int | None = Field(default=None, ge=0, le=480)
    account_id: str | None = None
    asset_id: str | None = None
    notes: str | None = Field(default=None, max_length=500)
    track_payments: bool = True

    @model_validator(mode="after")
    def known_type(self) -> "LoanCreate":
        if self.loan_type not in LOAN_TYPES:
            raise ValueError("Choose a supported loan type")
        if self.installments_paid_before is not None and self.installments_paid_before > self.tenure_months:
            raise ValueError("EMIs already paid can't exceed the tenure")
        return self


class LoanSummaryRead(ApiModel):
    emi: Decimal
    annual_rate: Decimal
    rate_is_estimated: bool
    tenure_months: int
    total_payable: Decimal
    total_interest: Decimal
    processing_fee: Decimal
    total_cost: Decimal
    first_due_on: date
    last_due_on: date
    installments_paid: int
    installments_left: int
    principal_paid: Decimal
    interest_paid: Decimal
    outstanding_principal: Decimal
    remaining_payable: Decimal
    remaining_interest: Decimal
    next_due_on: date | None
    next_payment: Decimal | None
    overdue: bool
    due_this_month: bool
    ends_this_month: bool
    progress_percent: int


class InstallmentRead(ApiModel):
    number: int
    due_on: date
    payment: Decimal
    interest: Decimal
    principal: Decimal
    balance: Decimal
    paid: bool


class LoanPreview(ApiModel):
    summary: LoanSummaryRead
    schedule: list[InstallmentRead]


class LoanRead(ApiModel):
    id: str
    name: str
    loan_type: str
    lender: str | None
    currency: str
    principal: Decimal
    annual_interest_rate: Decimal | None
    emi_amount: Decimal
    tenure_months: int
    first_due_on: date
    processing_fee: Decimal
    installments_paid_before: int
    account_id: str | None
    asset_id: str | None
    recurring_rule_id: str | None
    status: str
    notes: str | None
    summary: LoanSummaryRead


class LoanPaymentCreate(RequestModel):
    paid_on: date = Field(default_factory=date.today)


class LoanPaymentRead(ApiModel):
    loan: LoanRead
    transaction: TransactionRead


class LoanEnding(ApiModel):
    id: str
    name: str
    last_due_on: date


class LoansOverview(ApiModel):
    """Borrowing at a glance; the numbers a person (or an assistant) needs to judge new debt."""

    active_loans: int
    monthly_emi_total: Decimal
    outstanding_principal_total: Decimal
    remaining_payable_total: Decimal
    remaining_interest_total: Decimal
    due_this_month_total: Decimal
    overdue_count: int
    ending_this_month: list[LoanEnding]
    debt_free_on: date | None
    average_monthly_income: Decimal | None
    emi_to_income_percent: Decimal | None
