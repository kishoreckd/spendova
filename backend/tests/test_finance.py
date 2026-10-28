"""Pure finance calculations: postings, goals, asset replacement, and loan amortization."""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.core.finance import (
    TransactionType,
    add_months,
    amortization_schedule,
    assert_balanced,
    cost_per_day,
    create_posting,
    emi_for,
    implied_annual_rate,
    installments_due_by,
    loan_summary,
    monthly_goal_amount,
    replacement_goal,
)


def test_expense_posting_balances():
    entries = create_posting(TransactionType.EXPENSE, "125.457", "bank", "groceries")
    assert_balanced(entries)
    assert entries[0].amount == Decimal("125.46")


def test_rejects_same_source_and_destination():
    with pytest.raises(ValueError):
        create_posting(TransactionType.TRANSFER, 10, "bank", "bank")


def test_goal_projection():
    assert monthly_goal_amount(Decimal("900000"), Decimal("280000"), 31) == Decimal("20000.00")


def test_add_months_clamps_to_month_end():
    assert add_months(date(2024, 1, 31), 1) == date(2024, 2, 29)
    assert add_months(date(2023, 10, 20), 36) == date(2026, 10, 20)


def test_replacement_goal_by_expected_life():
    goal = replacement_goal(Decimal("79900"), date(2023, 10, 20), date(2025, 10, 20), life_months=36)
    assert goal is not None
    assert goal.reached_on == date(2026, 10, 20)
    assert goal.days_needed == 1096
    assert goal.target_cost_per_day == Decimal("72.90")
    assert goal.days_remaining == 365
    assert goal.progress_percent == 66
    assert not goal.reached


def test_replacement_goal_by_target_daily_cost_is_reached_when_cost_falls_to_target():
    price, bought = Decimal("60000"), date(2023, 1, 1)
    goal = replacement_goal(price, bought, date(2025, 1, 1), target_cost_per_day=Decimal("50"))
    assert goal is not None
    assert goal.days_needed == 1200
    assert goal.reached_on == bought + timedelta(days=1200)
    assert cost_per_day(price, bought, goal.reached_on) == Decimal("50.00")
    reached = replacement_goal(price, bought, goal.reached_on, target_cost_per_day=Decimal("50"))
    assert reached is not None and reached.reached and reached.progress_percent == 100


def test_no_replacement_goal_without_a_target():
    assert replacement_goal(Decimal("1000"), date(2025, 1, 1), date(2025, 2, 1)) is None


@pytest.mark.parametrize(
    ("principal", "rate", "months", "expected"),
    [
        ("50000", "12", 12, "4442.44"),  # Personal loan / product EMI.
        ("4000000", "8.5", 240, "34712.93"),  # Home loan: 40 lakh, 20 years.
        ("800000", "9", 60, "16606.68"),  # Car loan.
        ("60000", "0", 6, "10000.00"),  # No-cost EMI.
    ],
)
def test_emi_matches_bank_calculators(principal, rate, months, expected):
    assert emi_for(Decimal(principal), Decimal(rate), months) == Decimal(expected)


def test_hidden_rate_of_a_shop_emi_is_revealed():
    assert implied_annual_rate(Decimal("50000"), Decimal("4600"), 12) == Decimal("18.67")
    assert implied_annual_rate(Decimal("50000"), Decimal("4442.44"), 12) == Decimal("12.00")
    assert implied_annual_rate(Decimal("60000"), Decimal("10000"), 6) == Decimal(0)
    with pytest.raises(ValueError):
        implied_annual_rate(Decimal("50000"), Decimal("3000"), 12)


def test_schedule_reconciles_to_the_principal_and_ends_at_zero():
    emi = emi_for(Decimal("50000"), Decimal("12"), 12)
    rows = amortization_schedule(Decimal("50000"), Decimal("12"), emi, 12, date(2026, 1, 31))
    assert len(rows) == 12
    assert sum((row.principal for row in rows), Decimal(0)) == Decimal("50000")
    assert rows[0].interest == Decimal("500.00")
    assert rows[-1].balance == Decimal(0)
    assert rows[1].due_on == date(2026, 2, 28)  # Month-end dates are clamped.
    assert rows[0].interest > rows[-1].interest  # Interest falls as the balance falls.


def test_inconsistent_terms_are_rejected():
    with pytest.raises(ValueError):
        amortization_schedule(Decimal("50000"), Decimal("12"), Decimal("3000"), 12, date(2026, 1, 5))
    with pytest.raises(ValueError):
        amortization_schedule(Decimal("50000"), Decimal("12"), Decimal("9000"), 12, date(2026, 1, 5))


def test_loan_summary_tracks_progress_and_dates():
    emi = emi_for(Decimal("50000"), Decimal("12"), 12)
    rows = amortization_schedule(Decimal("50000"), Decimal("12"), emi, 12, date(2026, 1, 5))
    summary = loan_summary(Decimal("50000"), emi, Decimal("12"), False, rows, 3, Decimal("499"), date(2026, 4, 10))
    assert summary.total_interest == Decimal("3309.27")
    assert summary.total_cost == Decimal("3808.27")
    assert summary.installments_left == 9
    assert summary.next_due_on == date(2026, 4, 5)
    assert summary.overdue is True and summary.due_this_month is True
    assert summary.outstanding_principal == rows[2].balance
    assert summary.principal_paid + summary.outstanding_principal == Decimal("50000")

    final_month = loan_summary(Decimal("50000"), emi, Decimal("12"), False, rows, 11, Decimal(0), date(2026, 12, 1))
    assert final_month.ends_this_month is True


def test_installments_due_by_counts_past_due_dates():
    assert installments_due_by(date(2026, 1, 5), 12, date(2026, 4, 4)) == 3
    assert installments_due_by(date(2026, 1, 5), 12, date(2026, 4, 5)) == 4
    assert installments_due_by(date(2030, 1, 5), 12, date(2026, 4, 5)) == 0
