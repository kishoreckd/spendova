from decimal import Decimal
import pytest
from app.domain import TransactionType, assert_balanced, create_posting, monthly_goal_amount

def test_expense_posting_balances():
    entries = create_posting(TransactionType.EXPENSE, "125.457", "bank", "groceries")
    assert_balanced(entries)
    assert entries[0].amount == Decimal("125.46")

def test_rejects_same_source_and_destination():
    with pytest.raises(ValueError): create_posting(TransactionType.TRANSFER, 10, "bank", "bank")

def test_goal_projection():
    assert monthly_goal_amount(Decimal("900000"), Decimal("280000"), 31) == Decimal("20000.00")
