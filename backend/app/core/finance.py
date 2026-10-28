import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal
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


def create_posting(
    kind: TransactionType, value: Decimal | str | int, source: str, destination: str
) -> tuple[Entry, Entry]:
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


# --- Loans and EMIs -----------------------------------------------------------------------
# Reducing-balance amortization, the method Indian banks and NBFCs use for EMIs:
#   EMI = P * r * (1 + r)^n / ((1 + r)^n - 1), with r = annual rate / 12 / 100.
# Each month's interest is charged on the balance still owed; the rest of the EMI repays principal.

RATE = Decimal("0.01")
SCHEDULE_TOLERANCE = Decimal("0.05")  # The final EMI may differ from the rest by rounding, not more.
MISMATCH = "This EMI, interest rate, and tenure don't fit together. Check the numbers on your loan statement."


@dataclass(frozen=True)
class Installment:
    number: int
    due_on: date
    payment: Decimal
    interest: Decimal
    principal: Decimal
    balance: Decimal


@dataclass(frozen=True)
class LoanSummary:
    emi: Decimal
    annual_rate: Decimal
    rate_is_estimated: bool
    tenure_months: int
    total_payable: Decimal
    total_interest: Decimal
    processing_fee: Decimal
    total_cost: Decimal  # Interest plus fees: what borrowing costs beyond the amount itself.
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


def _exact_emi(principal: Decimal, annual_rate: Decimal, months: int) -> Decimal:
    monthly = annual_rate / Decimal(1200)
    if monthly == 0:
        return principal / months
    factor = (1 + monthly) ** months
    return principal * monthly * factor / (factor - 1)


def emi_for(principal: Decimal, annual_rate: Decimal, months: int) -> Decimal:
    """Monthly instalment that repays `principal` over `months` at `annual_rate` percent."""
    if principal <= 0 or months <= 0 or annual_rate < 0:
        raise ValueError("amount, tenure, and rate must be positive")
    return _exact_emi(principal, annual_rate, months).quantize(MONEY, rounding=ROUND_HALF_UP)


def implied_annual_rate(principal: Decimal, emi: Decimal, months: int, *, exact: bool = False) -> Decimal:
    """The interest rate hidden in an EMI offer (for example a 'no-cost' or shop EMI).

    Solved by bisection because the EMI formula has no closed-form inverse. Use `exact=True`
    to build a schedule (so every EMI comes out to the stated amount); the default rounds
    to two decimal places for display.
    """
    if principal <= 0 or emi <= 0 or months <= 0:
        raise ValueError("amount, EMI, and tenure must be positive")
    total = emi * months
    if total < principal - Decimal("0.5"):
        raise ValueError("This EMI is too low to repay the amount within the tenure")
    if total <= principal + Decimal("0.5"):
        return Decimal(0)
    low, high = Decimal(0), Decimal(300)
    for _ in range(80):
        mid = (low + high) / 2
        if _exact_emi(principal, mid, months) > emi:
            high = mid
        else:
            low = mid
    rate = (low + high) / 2
    return rate if exact else rate.quantize(RATE, rounding=ROUND_HALF_UP)


def amortization_schedule(
    principal: Decimal, annual_rate: Decimal, emi: Decimal, months: int, first_due_on: date
) -> list[Installment]:
    """Month-by-month split of each EMI into interest and principal.

    The last instalment settles the exact remaining balance, so totals always reconcile.
    Raises ValueError when the EMI cannot repay the loan at this rate within the tenure.
    """
    monthly = annual_rate / Decimal(1200)
    # Work in paise so stored values (4 decimal places) and fresh input give identical schedules.
    principal, emi = principal.quantize(MONEY), emi.quantize(MONEY)
    balance = principal
    rows: list[Installment] = []
    for number in range(1, months + 1):
        interest = (balance * monthly).quantize(MONEY, rounding=ROUND_HALF_UP)
        payment = balance + interest if number == months else emi
        if payment <= interest and balance > 0:
            raise ValueError(MISMATCH)
        principal_part = payment - interest
        balance -= principal_part
        if balance < 0:
            raise ValueError(MISMATCH)  # The EMI repays the loan before the tenure ends.
        rows.append(
            Installment(number, add_months(first_due_on, number - 1), payment, interest, principal_part, balance)
        )
    if abs(rows[-1].payment - emi) > emi * SCHEDULE_TOLERANCE + 1:
        raise ValueError(MISMATCH)
    return rows


def loan_summary(
    principal: Decimal,
    emi: Decimal,
    annual_rate: Decimal,
    rate_is_estimated: bool,
    schedule: list[Installment],
    installments_paid: int,
    processing_fee: Decimal,
    today: date,
) -> LoanSummary:
    principal, emi, processing_fee = principal.quantize(MONEY), emi.quantize(MONEY), processing_fee.quantize(MONEY)
    annual_rate = annual_rate.quantize(RATE, rounding=ROUND_HALF_UP)
    paid = min(max(installments_paid, 0), len(schedule))
    done, left = schedule[:paid], schedule[paid:]
    total_payable = sum((row.payment for row in schedule), Decimal(0))
    total_interest = total_payable - principal
    upcoming = left[0] if left else None
    this_month = (today.year, today.month)
    last = schedule[-1]
    return LoanSummary(
        emi=emi,
        annual_rate=annual_rate,
        rate_is_estimated=rate_is_estimated,
        tenure_months=len(schedule),
        total_payable=total_payable,
        total_interest=total_interest,
        processing_fee=processing_fee,
        total_cost=total_interest + processing_fee,
        first_due_on=schedule[0].due_on,
        last_due_on=last.due_on,
        installments_paid=paid,
        installments_left=len(left),
        principal_paid=sum((row.principal for row in done), Decimal(0)),
        interest_paid=sum((row.interest for row in done), Decimal(0)),
        outstanding_principal=done[-1].balance if done else principal,
        remaining_payable=sum((row.payment for row in left), Decimal(0)),
        remaining_interest=sum((row.interest for row in left), Decimal(0)),
        next_due_on=upcoming.due_on if upcoming else None,
        next_payment=upcoming.payment if upcoming else None,
        overdue=bool(upcoming and upcoming.due_on < today),
        due_this_month=bool(upcoming and (upcoming.due_on.year, upcoming.due_on.month) == this_month),
        ends_this_month=bool(left) and (last.due_on.year, last.due_on.month) == this_month,
        progress_percent=paid * 100 // len(schedule),
    )


def installments_due_by(first_due_on: date, months: int, today: date) -> int:
    """How many instalments have fallen due on or before today (a default for loans started earlier)."""
    count = 0
    while count < months and add_months(first_due_on, count) <= today:
        count += 1
    return count
