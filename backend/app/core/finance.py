import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP
from enum import StrEnum

MONEY = Decimal("0.01")

class TransactionType(StrEnum):
    EXPENSE = "expense"
    INCOME = "income"
    TRANSFER = "transfer"

class Side(StrEnum):
    DEBIT = "debit"
    CREDIT = "credit"

@dataclass(frozen=True)
class Entry:
    target: str
    side: Side
    amount: Decimal

def amount(value: Decimal | str | int) -> Decimal:
    result = Decimal(value).quantize(MONEY, rounding=ROUND_HALF_UP)
    if result <= 0:
        raise ValueError("amount must be greater than zero")
    return result

def create_posting(kind: TransactionType, value: Decimal | str | int, source: str, destination: str) -> tuple[Entry, Entry]:
    value = amount(value)
    if source == destination:
        raise ValueError("source and destination must differ")
    if kind == TransactionType.EXPENSE:
        return Entry(destination, Side.DEBIT, value), Entry(source, Side.CREDIT, value)
    if kind == TransactionType.INCOME:
        return Entry(destination, Side.DEBIT, value), Entry(source, Side.CREDIT, value)
    return Entry(destination, Side.DEBIT, value), Entry(source, Side.CREDIT, value)

def assert_balanced(entries: tuple[Entry, ...]) -> None:
    debit = sum((e.amount for e in entries if e.side == Side.DEBIT), Decimal(0))
    credit = sum((e.amount for e in entries if e.side == Side.CREDIT), Decimal(0))
    if debit != credit:
        raise ValueError(f"unbalanced posting: {debit} != {credit}")

def monthly_goal_amount(target: Decimal, saved: Decimal, months: int) -> Decimal:
    if months <= 0:
        raise ValueError("months must be positive")
    remaining = max(Decimal(0), target - saved)
    return (remaining / months).quantize(MONEY, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class ReplacementGoal:
    """When an owned product has paid for itself at the owner's chosen daily cost."""

    target_cost_per_day: Decimal
    days_needed: int
    reached_on: date
    days_remaining: int
    progress_percent: int
    reached: bool


def add_months(start: date, months: int) -> date:
    month_index = start.month - 1 + months
    year, month = start.year + month_index // 12, month_index % 12 + 1
    return date(year, month, min(start.day, calendar.monthrange(year, month)[1]))


def days_owned(purchased_on: date, today: date) -> int:
    return max(1, (today - purchased_on).days)


def cost_per_day(price: Decimal, purchased_on: date, today: date) -> Decimal:
    return (price / days_owned(purchased_on, today)).quantize(MONEY, rounding=ROUND_HALF_UP)


def replacement_goal(
    price: Decimal,
    purchased_on: date,
    today: date,
    life_months: int | None = None,
    target_cost_per_day: Decimal | None = None,
) -> ReplacementGoal | None:
    """Return progress toward an expected life or a target cost per day.

    Cost per day is price / days owned, so it falls every day. The goal is met
    on the first day that figure reaches the owner's target.
    """
    if life_months:
        reached_on = add_months(purchased_on, life_months)
        days_needed = max(1, (reached_on - purchased_on).days)
        target = (price / days_needed).quantize(MONEY, rounding=ROUND_HALF_UP)
    elif target_cost_per_day:
        if target_cost_per_day <= 0:
            raise ValueError("target cost per day must be greater than zero")
        days_needed = max(1, int((price / target_cost_per_day).to_integral_value(rounding=ROUND_CEILING)))
        reached_on = purchased_on + timedelta(days=days_needed)
        target = target_cost_per_day.quantize(MONEY, rounding=ROUND_HALF_UP)
    else:
        return None
    reached = today >= reached_on
    return ReplacementGoal(
        target_cost_per_day=target,
        days_needed=days_needed,
        reached_on=reached_on,
        days_remaining=max(0, (reached_on - today).days),
        progress_percent=100 if reached else min(99, days_owned(purchased_on, today) * 100 // days_needed),
        reached=reached,
    )
