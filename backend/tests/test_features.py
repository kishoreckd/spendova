import os
from datetime import date, timedelta

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["AUTH_REQUIRED"] = "false"

from fastapi.testclient import TestClient

from app.domain import add_months
from app.main import app


def data(response):
    body = response.json()
    assert body["status"] == "success"
    return body["data"]


def test_google_auth_creates_and_updates_profile_in_local_mode():
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/auth/google",
            headers={"X-User-Id": "firebase-user-1"},
            json={
                "email": "owner@example.com",
                "name": "Spendova Owner",
                "photo_url": "https://example.com/avatar.jpg",
            },
        )
        assert created.status_code == 200
        assert data(created)["email"] == "owner@example.com"
        assert data(created)["photo_url"] == "https://example.com/avatar.jpg"
        updated = client.patch(
            "/api/v1/auth/me",
            headers={"X-User-Id": "firebase-user-1"},
            json={"base_currency": "USD", "country_code": "US", "onboarding_completed": True},
        )
        assert updated.status_code == 200
        assert data(updated)["base_currency"] == "USD"
        assert data(updated)["onboarding_completed"] is True


def test_email_verification_code_marks_profile_verified():
    headers = {"X-User-Id": "email-user-1"}
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/auth/google",
            headers=headers,
            json={"email": "new-user@example.com", "name": "New User"},
        )
        assert created.status_code == 200
        assert data(created)["email_verified"] is False

        sent = client.post("/api/v1/auth/verification/send", headers=headers)
        assert sent.status_code == 200
        code = data(sent)["development_code"]
        assert code and len(code) == 6

        confirmed = client.post(
            "/api/v1/auth/verification/confirm",
            headers=headers,
            json={"code": code},
        )
        assert confirmed.status_code == 200
        assert data(confirmed)["email_verified"] is True


def test_default_and_custom_categories_are_user_scoped():
    with TestClient(app) as client:
        first = client.get("/api/v1/categories", headers={"X-User-Id": "user-a"})
        assert first.status_code == 200
        defaults = data(first)
        assert {"Insurance premiums", "Interest & dividends", "Business & freelance"}.issubset(
            {category["name"] for category in defaults}
        )
        custom = client.post(
            "/api/v1/categories",
            headers={"X-User-Id": "user-a"},
            json={"name": "Cloud services", "category_type": "expense", "icon": "cloud"},
        )
        assert custom.status_code == 201
        other = client.get("/api/v1/categories", headers={"X-User-Id": "user-b"})
        assert all(category["name"] != "Cloud services" for category in data(other))


def test_asset_reports_age_and_cost_per_day():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/assets",
            json={
                "name": "iPhone 11",
                "asset_type": "phone",
                "purchase_price": "60000",
                "purchased_on": "2020-01-01",
                "currency": "INR",
            },
        )
        assert response.status_code == 201
        assert data(response)["age_days"] > 2000
        assert float(data(response)["cost_per_day"]) > 0


def test_asset_replacement_goal_can_be_set_switched_and_cleared():
    headers = {"X-User-Id": "asset-owner"}
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/assets",
            headers=headers,
            json={
                "name": "  iPhone 15  ", "asset_type": "Watch", "purchase_price": "79900",
                "purchased_on": "2023-10-20", "expected_life_months": 36,
            },
        )
        assert created.status_code == 201
        asset = data(created)
        assert asset["name"] == "iPhone 15"
        assert asset["replacement_goal"]["reached_on"] == "2026-10-20"
        assert asset["replacement_goal"]["target_cost_per_day"] == "72.90"

        switched = client.patch(
            f"/api/v1/assets/{asset['id']}",
            headers=headers,
            json={"expected_life_months": None, "target_cost_per_day": "50"},
        )
        assert switched.status_code == 200
        assert data(switched)["replacement_goal"]["days_needed"] == 1598

        conflict = client.patch(f"/api/v1/assets/{asset['id']}", headers=headers, json={"expected_life_months": 24})
        assert conflict.status_code == 422

        cleared = client.patch(f"/api/v1/assets/{asset['id']}", headers=headers, json={"target_cost_per_day": None})
        assert data(cleared)["replacement_goal"] is None

        stranger = client.patch(f"/api/v1/assets/{asset['id']}", headers={"X-User-Id": "intruder"}, json={"name": "Mine"})
        assert stranger.status_code == 404


def test_asset_rejects_both_goals_and_empty_required_fields():
    with TestClient(app) as client:
        both = client.post(
            "/api/v1/assets",
            json={
                "name": "Laptop", "asset_type": "computer", "purchase_price": "90000",
                "purchased_on": "2024-01-01", "expected_life_months": 48, "target_cost_per_day": "40",
            },
        )
        assert both.status_code == 422
        blank = client.post(
            "/api/v1/assets",
            json={"name": "   ", "asset_type": "computer", "purchase_price": "1", "purchased_on": "2024-01-01"},
        )
        assert blank.status_code == 422
        assert blank.json()["data"][0]["field"] == "body -> name"


def test_category_can_be_edited_but_not_duplicated_or_taken():
    headers = {"X-User-Id": "category-editor"}
    with TestClient(app) as client:
        categories = data(client.get("/api/v1/categories", headers=headers))
        groceries = next(item for item in categories if item["name"] == "Groceries")
        renamed = client.patch(
            f"/api/v1/categories/{groceries['id']}",
            headers=headers,
            json={"name": "Food shopping", "color": "#123456", "monthly_budget": "8000"},
        )
        assert renamed.status_code == 200
        assert data(renamed)["name"] == "Food shopping"
        assert data(renamed)["category_type"] == "expense"
        duplicate = client.patch(
            f"/api/v1/categories/{groceries['id']}", headers=headers, json={"name": "Housing"}
        )
        assert duplicate.status_code == 409
        stranger = client.patch(
            f"/api/v1/categories/{groceries['id']}", headers={"X-User-Id": "someone-else"}, json={"name": "Mine"}
        )
        assert stranger.status_code == 404


def test_budget_status_tracks_each_category_and_budget_can_be_deleted():
    headers = {"X-User-Id": "budgeter"}
    with TestClient(app) as client:
        categories = data(client.get("/api/v1/categories", headers=headers))
        groceries = next(item for item in categories if item["name"] == "Groceries")
        transport = next(item for item in categories if item["name"] == "Transport")
        salary = next(item for item in categories if item["name"] == "Salary")
        for key, category, amount in (("b-1", groceries, "1200"), ("b-2", groceries, "300"), ("b-3", transport, "500")):
            client.post(
                "/api/v1/transactions",
                headers={**headers, "Idempotency-Key": f"budget-{key}"},
                json={"kind": "expense", "amount": amount, "source": "bank", "destination": category["name"],
                      "category_id": category["id"], "occurred_on": "2026-08-10"},
            )
        income_line = client.post(
            "/api/v1/budgets",
            headers=headers,
            json={"name": "Bad", "month": "2026-08-01", "total_limit": 100,
                  "lines": [{"category_id": salary["id"], "amount_limit": 50}]},
        )
        assert income_line.status_code == 422
        budget = data(client.post(
            "/api/v1/budgets",
            headers=headers,
            json={"name": "August", "month": "2026-08-15", "total_limit": 5000,
                  "lines": [{"category_id": groceries["id"], "amount_limit": 1000}]},
        ))
        assert budget["month"] == "2026-08-01"
        result = data(client.get(f"/api/v1/budgets/{budget['id']}/status", headers=headers))
        assert result["spent"] == "2000.0000"
        assert result["remaining"] == "3000.0000"
        assert result["lines"][0]["spent"] == "1500.0000"
        assert result["lines"][0]["remaining"] == "-500.0000"
        assert client.delete(f"/api/v1/budgets/{budget['id']}", headers=headers).status_code == 204
        assert data(client.get("/api/v1/budgets", headers=headers)) == []


def test_bill_can_be_created_and_stopped():
    headers = {"X-User-Id": "bill-payer"}
    with TestClient(app) as client:
        rule = data(client.post(
            "/api/v1/recurring-rules",
            headers=headers,
            json={"name": "Netflix", "kind": "expense", "amount": "649", "frequency": "monthly",
                  "next_due_on": "2026-11-05", "source": "HDFC Savings", "destination": "Entertainment"},
        ))
        assert len(data(client.get("/api/v1/recurring-rules", headers=headers))) == 1
        assert client.delete(f"/api/v1/recurring-rules/{rule['id']}", headers=headers).status_code == 204
        assert data(client.get("/api/v1/recurring-rules", headers=headers)) == []


def test_weekly_commitment_payment_creates_transaction_and_advances_due_date():
    headers = {"X-User-Id": "weekly-payer"}
    today = date.today()
    with TestClient(app) as client:
        categories = data(client.get("/api/v1/categories", headers=headers))
        insurance = next(item for item in categories if item["name"] == "Insurance premiums")
        rule = data(client.post(
            "/api/v1/recurring-rules",
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
        ))
        paid = client.post(
            f"/api/v1/recurring-rules/{rule['id']}/pay",
            headers={**headers, "Idempotency-Key": "weekly-payment-001"},
            json={"amount": "550", "paid_on": today.isoformat()},
        )
        assert paid.status_code == 200
        result = data(paid)
        assert result["transaction"]["amount"] == "550.0000"
        assert result["commitment"]["amount"] == "550.0000"
        assert result["commitment"]["next_due_on"] == (today + timedelta(weeks=1)).isoformat()
        assert len(data(client.get("/api/v1/transactions", headers=headers))) == 1


def test_income_and_investment_plans_keep_financial_details():
    headers = {"X-User-Id": "financial-planner"}
    with TestClient(app) as client:
        categories = data(client.get("/api/v1/categories", headers=headers))
        business = next(item for item in categories if item["name"] == "Business & freelance")
        income = client.post(
            "/api/v1/recurring-rules",
            headers=headers,
            json={
                "name": "Consulting income", "plan_type": "income", "kind": "income",
                "amount": "50000", "cost_amount": "12000", "frequency": "monthly",
                "next_due_on": "2026-11-01", "source": "Business & freelance",
                "destination": "HDFC Savings", "category_id": business["id"],
            },
        )
        assert income.status_code == 201
        assert data(income)["cost_amount"] == "12000.0000"

        missing_tenure = client.post(
            "/api/v1/recurring-rules",
            headers=headers,
            json={
                "name": "LIC plan", "plan_type": "investment", "kind": "transfer",
                "amount": "5000", "frequency": "monthly", "next_due_on": "2026-11-01",
                "source": "HDFC Savings", "destination": "LIC Investment",
            },
        )
        assert missing_tenure.status_code == 422


def test_manual_transaction_linked_to_commitment_advances_schedule():
    headers = {"X-User-Id": "linked-commitment"}
    today = date.today()
    with TestClient(app) as client:
        categories = data(client.get("/api/v1/categories", headers=headers))
        insurance = next(item for item in categories if item["name"] == "Insurance premiums")
        rule = data(client.post(
            "/api/v1/recurring-rules",
            headers=headers,
            json={
                "name": "LIC premium", "kind": "expense", "amount": "2000",
                "frequency": "monthly", "next_due_on": today.isoformat(),
                "source": "HDFC Savings", "destination": "Insurance premiums",
                "category_id": insurance["id"],
            },
        ))
        created = client.post(
            "/api/v1/transactions",
            headers={**headers, "Idempotency-Key": "linked-transaction-001"},
            json={
                "kind": "expense", "amount": "2100", "currency": "INR",
                "source": "HDFC Savings", "destination": "Insurance premiums",
                "merchant": "LIC premium", "occurred_on": today.isoformat(),
                "category_id": insurance["id"], "recurring_rule_id": rule["id"],
            },
        )
        assert created.status_code == 201
        rules = data(client.get("/api/v1/recurring-rules", headers=headers))
        assert rules[0]["amount"] == "2100.0000"
        assert rules[0]["next_due_on"] == add_months(today, 1).isoformat()


def test_loan_repayment_updates_bank_and_outstanding_balances():
    headers = {"X-User-Id": "borrower"}
    with TestClient(app) as client:
        for payload in (
            {"name": "Salary bank", "account_type": "bank", "currency": "INR", "opening_balance": "10000"},
            {"name": "Personal loan", "account_type": "loan", "currency": "INR", "opening_balance": "-50000", "principal_amount": "50000", "institution": "Example Bank"},
        ):
            assert client.post("/api/v1/accounts", headers=headers, json=payload).status_code == 201
        repayment = client.post(
            "/api/v1/transactions",
            headers={**headers, "Idempotency-Key": "loan-repayment-001"},
            json={
                "kind": "transfer", "amount": "5000", "currency": "INR",
                "source": "Salary bank", "destination": "Personal loan",
                "occurred_on": date.today().isoformat(),
            },
        )
        assert repayment.status_code == 201
        accounts = {item["name"]: item for item in data(client.get("/api/v1/accounts", headers=headers))}
        assert accounts["Salary bank"]["current_balance"] == "5000.0000"
        assert accounts["Personal loan"]["current_balance"] == "-45000.0000"


def test_duplicate_account_names_are_isolated_by_account_id():
    headers = {"X-User-Id": "duplicate-account-owner"}
    with TestClient(app) as client:
        first = data(client.post("/api/v1/accounts", headers=headers, json={
            "name": "HDFC Savings", "account_type": "bank", "currency": "INR", "opening_balance": "1000",
        }))
        second = data(client.post("/api/v1/accounts", headers=headers, json={
            "name": "HDFC Savings", "account_type": "bank", "currency": "INR", "opening_balance": "2000",
        }))
        expense = client.post(
            "/api/v1/transactions",
            headers={**headers, "Idempotency-Key": "duplicate-account-expense-001"},
            json={
                "kind": "expense", "amount": "250", "currency": "INR",
                "source": "HDFC Savings", "destination": "Groceries",
                "source_account_id": second["id"], "occurred_on": date.today().isoformat(),
            },
        )
        assert expense.status_code == 201
        accounts = {item["id"]: item for item in data(client.get("/api/v1/accounts", headers=headers))}
        assert accounts[first["id"]]["current_balance"] == "1000.0000"
        assert accounts[second["id"]]["current_balance"] == "1750.0000"


def test_transactions_are_isolated_between_users():
    with TestClient(app) as client:
        payload = {"kind": "expense", "amount": 100, "source": "bank", "destination": "food"}
        created = client.post(
            "/api/v1/transactions",
            headers={"X-User-Id": "owner", "Idempotency-Key": "owner-key-001"},
            json=payload,
        )
        assert created.status_code == 201
        stranger = client.get("/api/v1/transactions", headers={"X-User-Id": "stranger"})
        assert data(stranger) == []


def test_budget_status_and_recurring_rules():
    headers = {"X-User-Id": "planner"}
    with TestClient(app) as client:
        categories = data(client.get("/api/v1/categories", headers=headers))
        groceries = next(item for item in categories if item["name"] == "Groceries")
        budget = client.post(
            "/api/v1/budgets",
            headers=headers,
            json={
                "name": "October plan",
                "month": "2026-10-01",
                "total_limit": 50000,
                "lines": [{"category_id": groceries["id"], "amount_limit": 10000}],
            },
        )
        assert budget.status_code == 201
        status_response = client.get(f"/api/v1/budgets/{data(budget)['id']}/status", headers=headers)
        assert float(data(status_response)["remaining"]) == 50000
        recurring = client.post(
            "/api/v1/recurring-rules",
            headers=headers,
            json={
                "name": "Monthly salary", "kind": "income", "amount": 92000,
                "frequency": "monthly", "next_due_on": "2026-11-01",
                "source": "employer", "destination": "salary account", "category_id": None,
            },
        )
        assert recurring.status_code == 201


def test_goal_contribution_recalculates_monthly_requirement():
    headers = {"X-User-Id": "goal-owner"}
    with TestClient(app) as client:
        goal = client.post(
            "/api/v1/goals", headers=headers,
            json={"name": "Car", "target_amount": 100000, "saved_amount": 10000, "months": 9},
        )
        contribution = client.post(
            f"/api/v1/goals/{data(goal)['id']}/contributions", headers=headers,
            json={"amount": 9000, "contributed_on": "2026-10-20"},
        )
        assert contribution.status_code == 201
        refreshed = data(client.get("/api/v1/goals", headers=headers))[0]
        assert refreshed["saved_amount"] == "19000.0000"
        assert refreshed["monthly_required"] == "9000.0000"
