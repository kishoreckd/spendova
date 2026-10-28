from decimal import Decimal

from app.core.schema import ApiModel


class DashboardPeriod(ApiModel):
    year: int
    month: int


class DashboardCategory(ApiModel):
    id: str
    name: str
    color: str | None
    amount: Decimal


class DashboardSummary(ApiModel):
    period: DashboardPeriod
    income: Decimal
    spending: Decimal
    cash_flow: Decimal
    transaction_count: int
    categories: list[DashboardCategory]
