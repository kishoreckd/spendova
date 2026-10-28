from datetime import date, timedelta

from app.core.finance import add_months
from tests.helpers import API, category_named, data, sign_up

RULES = f"{API}/recurring-rules"


def test_bill_can_be_created_and_stopped(api):
    headers = sign_up(api, "bill-payer")
    rule = data(
        api.post(
            RULES,
            headers=headers,
            json={
                "name": "Netflix",
                "kind": "expense",
                "amount": "649",
                "frequency": "monthly",
                "next_due_on": "2026-11-05",
                "source": "HDFC Savings",
                "destination": "Entertainment",
            },
        )
    )
    assert len(data(api.get(RULES, headers=headers))) == 1
    assert api.delete(f"{RULES}/{rule['id']}", headers=headers).status_code == 204
    assert data(api.get(RULES, headers=headers)) == []


def test_weekly_commitment_payment_creates_transaction_and_advances_due_date(api):
    headers = sign_up(api, "weekly-payer")
    today = date.today()
    insurance = category_named(api, headers, "Insurance premiums")
    rule = data(
        api.post(
            RULES,
            headers=headers,
            json={
                "name": "Weekly premium",
                "kind": "expense",
                "amount": "500",
                "frequency": "weekly",
                "interval": 1,
                "next_due_on": today.isoformat(),
                "source": "HDFC Savings",
                "destination": "Insurance premiums",
                "category_id": insurance["id"],
            },
        )
    )
    paid = api.post(
        f"{RULES}/{rule['id']}/pay",
        headers={**headers, "Idempotency-Key": "weekly-payment-001"},
        json={"amount": "550", "paid_on": today.isoformat()},
    )
    result = data(paid)
    assert result["transaction"]["amount"] == "550.0000"
    assert result["transaction"]["recurring_rule_id"] == rule["id"]
    assert result["commitment"]["amount"] == "550.0000"
    assert result["commitment"]["next_due_on"] == (today + timedelta(weeks=1)).isoformat()
    assert len(data(api.get(f"{API}/transactions", headers=headers))) == 1


def test_income_and_investment_plans_keep_financial_details(api):
    headers = sign_up(api, "financial-planner")
    business = category_named(api, headers, "Business & freelance")
    income = api.post(
        RULES,
        headers=headers,
        json={
            "name": "Consulting income",
            "plan_type": "income",
            "kind": "income",
            "amount": "50000",
            "cost_amount": "12000",
            "frequency": "monthly",
            "next_due_on": "2026-11-01",
            "source": "Business & freelance",
            "destination": "HDFC Savings",
            "category_id": business["id"],
        },
    )
    assert income.status_code == 201
    assert data(income)["cost_amount"] == "12000.0000"
    missing_tenure = api.post(
        RULES,
        headers=headers,
        json={
            "name": "LIC plan",
            "plan_type": "investment",
            "kind": "transfer",
            "amount": "5000",
            "frequency": "monthly",
            "next_due_on": "2026-11-01",
            "source": "HDFC Savings",
            "destination": "LIC Investment",
        },
    )
    assert missing_tenure.status_code == 400


def test_manual_transaction_linked_to_commitment_advances_schedule(api):
    headers = sign_up(api, "linked-commitment")
    today = date.today()
    insurance = category_named(api, headers, "Insurance premiums")
    rule = data(
        api.post(
            RULES,
            headers=headers,
            json={
                "name": "LIC premium",
                "kind": "expense",
                "amount": "2000",
                "frequency": "monthly",
                "next_due_on": today.isoformat(),
                "source": "HDFC Savings",
                "destination": "Insurance premiums",
                "category_id": insurance["id"],
            },
        )
    )
    created = api.post(
        f"{API}/transactions",
        headers={**headers, "Idempotency-Key": "linked-transaction-001"},
        json={
            "kind": "expense",
            "amount": "2100",
            "currency": "INR",
            "source": "HDFC Savings",
            "destination": "Insurance premiums",
            "merchant": "LIC premium",
            "occurred_on": today.isoformat(),
            "category_id": insurance["id"],
            "recurring_rule_id": rule["id"],
        },
    )
    assert created.status_code == 201
    rules = data(api.get(RULES, headers=headers))
    assert rules[0]["amount"] == "2100.0000"
    assert rules[0]["next_due_on"] == add_months(today, 1).isoformat()


def test_payments_cannot_be_future_dated(api):
    headers = sign_up(api, "future-payer")
    rule = data(
        api.post(
            RULES,
            headers=headers,
            json={
                "name": "Rent",
                "kind": "expense",
                "amount": "20000",
                "frequency": "monthly",
                "next_due_on": date.today().isoformat(),
                "source": "Bank",
                "destination": "Housing",
            },
        )
    )
    response = api.post(
        f"{RULES}/{rule['id']}/pay",
        headers={**headers, "Idempotency-Key": "future-payment-01"},
        json={"paid_on": (date.today() + timedelta(days=2)).isoformat()},
    )
    assert response.status_code == 400
