from datetime import date
from decimal import Decimal

from pydantic import Field, model_validator

from app.core.schema import ApiModel, PositiveMoney, RequestModel


class GoalCreate(RequestModel):
    name: str = Field(min_length=1, max_length=100)
    target_amount: PositiveMoney
    saved_amount: Decimal = Field(default=Decimal(0), ge=0)
    months: int = Field(gt=0)

    @model_validator(mode="after")
    def saved_amount_cannot_exceed_target(self) -> "GoalCreate":
        if self.saved_amount > self.target_amount:
            raise ValueError("saved amount cannot exceed target")
        return self


class GoalRead(ApiModel):
    id: str
    name: str
    target_amount: Decimal
    saved_amount: Decimal
    months: int
    monthly_required: Decimal


class GoalContributionCreate(RequestModel):
    amount: PositiveMoney
    contributed_on: date = Field(default_factory=date.today)
    note: str | None = Field(default=None, max_length=250)


class GoalContributionRead(ApiModel):
    id: str
    goal_id: str
    amount: Decimal
    contributed_on: date
    note: str | None
