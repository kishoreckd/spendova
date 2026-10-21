from datetime import date, timedelta
from decimal import Decimal
import pytest
from app.domain import (
    TransactionType,
    add_months,
    assert_balanced,
    cost_per_day,
    create_posting,
    monthly_goal_amount,
    replacement_goal,
)

def test_expense_posting_balances():
    entries = create_posting(TransactionType.EXPENSE, "125.457", "bank", "groceries")
    assert_balanced(entries)
    assert entries[0].amount == Decimal("125.46")

def test_rejects_same_source_and_destination():
    with pytest.raises(ValueError): create_posting(TransactionType.TRANSFER, 10, "bank", "bank")

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
