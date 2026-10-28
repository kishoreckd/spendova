from tests.helpers import API, data, error, sign_up


def test_asset_reports_age_and_cost_per_day(api):
    headers = sign_up(api, "asset-reporter")
    response = api.post(
        f"{API}/assets",
        headers=headers,
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


def test_asset_replacement_goal_can_be_set_switched_and_cleared(api):
    headers = sign_up(api, "asset-owner")
    intruder = sign_up(api, "intruder")
    asset = data(
        api.post(
            f"{API}/assets",
            headers=headers,
            json={
                "name": "  iPhone 15  ",
                "asset_type": "Watch",
                "purchase_price": "79900",
                "purchased_on": "2023-10-20",
                "expected_life_months": 36,
            },
        )
    )
    assert asset["name"] == "iPhone 15"
    assert asset["replacement_goal"]["reached_on"] == "2026-10-20"
    assert asset["replacement_goal"]["target_cost_per_day"] == "72.90"

    switched = api.patch(
        f"{API}/assets/{asset['id']}", headers=headers, json={"expected_life_months": None, "target_cost_per_day": "50"}
    )
    assert data(switched)["replacement_goal"]["days_needed"] == 1598

    conflict = api.patch(f"{API}/assets/{asset['id']}", headers=headers, json={"expected_life_months": 24})
    assert conflict.status_code == 400

    cleared = api.patch(f"{API}/assets/{asset['id']}", headers=headers, json={"target_cost_per_day": None})
    assert data(cleared)["replacement_goal"] is None
    assert api.patch(f"{API}/assets/{asset['id']}", headers=intruder, json={"name": "Mine"}).status_code == 404


def test_asset_rejects_both_goals_and_empty_required_fields(api):
    headers = sign_up(api, "asset-validator")
    both = api.post(
        f"{API}/assets",
        headers=headers,
        json={
            "name": "Laptop",
            "asset_type": "computer",
            "purchase_price": "90000",
            "purchased_on": "2024-01-01",
            "expected_life_months": 48,
            "target_cost_per_day": "40",
        },
    )
    assert both.status_code == 400
    blank = api.post(
        f"{API}/assets",
        headers=headers,
        json={"name": "   ", "asset_type": "computer", "purchase_price": "1", "purchased_on": "2024-01-01"},
    )
    assert blank.status_code == 400
    assert error(blank)["details"][0]["path"] == "name"


def test_future_purchase_dates_are_rejected(api):
    headers = sign_up(api, "time-traveller")
    response = api.post(
        f"{API}/assets",
        headers=headers,
        json={"name": "Car", "asset_type": "vehicle", "purchase_price": "900000", "purchased_on": "2999-01-01"},
    )
    assert response.status_code == 400
    assert error(response)["message"] == "Purchase date cannot be in the future"
