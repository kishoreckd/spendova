from datetime import date
from decimal import Decimal
from typing import Annotated

from pydantic import Field, StringConstraints, model_validator

from app.core.schema import ApiModel, CurrencyCode, PositiveMoney, RequestModel

AssetName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
AssetType = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
LifeMonths = Annotated[int, Field(ge=1, le=600)]
DailyTarget = Annotated[Decimal, Field(gt=0, max_digits=19, decimal_places=4)]
GOAL_CONFLICT = "choose either an expected life or a target cost per day, not both"


class AssetCreate(RequestModel):
    name: AssetName
    asset_type: AssetType
    purchase_price: PositiveMoney
    purchased_on: date
    currency: CurrencyCode = "INR"
    notes: str | None = Field(default=None, max_length=500)
    expected_life_months: LifeMonths | None = None
    target_cost_per_day: DailyTarget | None = None

    @model_validator(mode="after")
    def one_replacement_goal(self) -> "AssetCreate":
        if self.expected_life_months and self.target_cost_per_day:
            raise ValueError(GOAL_CONFLICT)
        return self


class AssetUpdate(RequestModel):
    """Partial update; send a goal field as null to remove it."""

    name: AssetName | None = None
    asset_type: AssetType | None = None
    purchase_price: Decimal | None = Field(default=None, gt=0)
    purchased_on: date | None = None
    notes: str | None = Field(default=None, max_length=500)
    expected_life_months: LifeMonths | None = None
    target_cost_per_day: DailyTarget | None = None


class ReplacementGoalRead(ApiModel):
    target_cost_per_day: Decimal
    days_needed: int
    reached_on: date
    days_remaining: int
    progress_percent: int
    reached: bool


class AssetRead(ApiModel):
    id: str
    name: str
    asset_type: str
    purchase_price: Decimal
    purchased_on: date
    currency: str
    notes: str | None
    expected_life_months: int | None
    target_cost_per_day: Decimal | None
    status: str
    age_days: int
    cost_per_day: Decimal
    replacement_goal: ReplacementGoalRead | None
