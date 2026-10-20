import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["AUTH_REQUIRED"] = "false"

from fastapi.testclient import TestClient

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
        assert len(data(first)) == 8
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
