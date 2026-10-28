"""Due-date arithmetic for recurring commitments (no database access)."""

from datetime import date, timedelta

from app.core.finance import add_months


def next_due(current: date, frequency: str, interval: int) -> date:
    if frequency == "daily":
        return current + timedelta(days=interval)
    if frequency == "weekly":
        return current + timedelta(weeks=interval)
    if frequency == "monthly":
        return add_months(current, interval)
    return add_months(current, interval * 12)
