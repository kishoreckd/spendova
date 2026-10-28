from tests.helpers import API, category_named, data, error, expense, sign_up


def test_budget_status_tracks_each_category_and_budget_can_be_deleted(api):
    headers = sign_up(api, "budgeter")
    groceries = category_named(api, headers, "Groceries")
    transport = category_named(api, headers, "Transport")
    salary = category_named(api, headers, "Salary")
    for key, category, amount in (("b-1", groceries, "1200"), ("b-2", groceries, "300"), ("b-3", transport, "500")):
        expense(
            api,
            headers,
            f"budget-{key}",
            amount=amount,
            destination=category["name"],
            category_id=category["id"],
            occurred_on="2026-08-10",
        )

    income_line = api.post(
        f"{API}/budgets",
        headers=headers,
        json={
            "name": "Bad",
            "month": "2026-08-01",
            "total_limit": 100,
            "lines": [{"category_id": salary["id"], "amount_limit": 50}],
        },
    )
    assert income_line.status_code == 400

    budget = data(
        api.post(
            f"{API}/budgets",
            headers=headers,
            json={
                "name": "August",
                "month": "2026-08-15",
                "total_limit": 5000,
                "lines": [{"category_id": groceries["id"], "amount_limit": 1000}],
            },
        )
    )
    assert budget["month"] == "2026-08-01"
    result = data(api.get(f"{API}/budgets/{budget['id']}/status", headers=headers))
    assert result["spent"] == "2000.0000"
    assert result["remaining"] == "3000.0000"
    assert result["lines"][0]["spent"] == "1500.0000"
    assert result["lines"][0]["remaining"] == "-500.0000"
    assert api.delete(f"{API}/budgets/{budget['id']}", headers=headers).status_code == 204
    assert data(api.get(f"{API}/budgets", headers=headers)) == []


def test_one_budget_per_month(api):
    headers = sign_up(api, "monthly-budgeter")
    payload = {"name": "October", "month": "2026-10-01", "total_limit": 1000}
    assert api.post(f"{API}/budgets", headers=headers, json=payload).status_code == 201
    duplicate = api.post(f"{API}/budgets", headers=headers, json=payload)
    assert duplicate.status_code == 409
    assert error(duplicate)["message"] == "A budget already exists for this month"


def test_category_limits_cannot_exceed_total(api):
    headers = sign_up(api, "over-limit")
    groceries = category_named(api, headers, "Groceries")
    response = api.post(
        f"{API}/budgets",
        headers=headers,
        json={
            "name": "Tight",
            "month": "2026-10-01",
            "total_limit": 100,
            "lines": [{"category_id": groceries["id"], "amount_limit": 500}],
        },
    )
    assert response.status_code == 400
