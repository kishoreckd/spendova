from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
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
