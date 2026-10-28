from datetime import date
from decimal import Decimal

from pydantic import Field, model_validator

from app.constants.finance import ACCOUNT_TYPES
from app.core.schema import ApiModel, CurrencyCode, RequestModel


class AccountCreate(RequestModel):
    name: str = Field(min_length=1, max_length=80)
    account_type: str = Field(min_length=1, max_length=30)
    currency: CurrencyCode = "INR"
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
        if self.account_type not in ACCOUNT_TYPES:
            raise ValueError("choose a supported account type")
        if self.account_type in {"fixed_deposit", "recurring_deposit"} and not self.tenure_months:
            raise ValueError("deposit tenure is required")
        if self.account_type == "fixed_deposit" and not self.principal_amount:
            raise ValueError("fixed deposit amount is required")
        if self.account_type == "recurring_deposit" and not self.installment_amount:
            raise ValueError("recurring deposit installment is required")
        return self


class AccountRead(ApiModel):
    id: str
    name: str
    account_type: str
    currency: str
    opening_balance: Decimal
    institution: str | None
    principal_amount: Decimal | None
    annual_interest_rate: Decimal | None
    started_on: date | None
    maturity_on: date | None
    tenure_months: int | None
    installment_amount: Decimal | None
    archived: bool
    current_balance: Decimal
