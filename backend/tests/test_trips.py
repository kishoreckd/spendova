from decimal import Decimal

from app.core.finance import allocate_equal
from tests.helpers import API, category_named, data, sign_up


def test_equal_allocation_preserves_every_cent():
    assert allocate_equal(Decimal("10.00"), 3) == [Decimal("3.34"), Decimal("3.33"), Decimal("3.33")]
    assert sum(allocate_equal(Decimal("0.05"), 4)) == Decimal("0.05")


def test_split_trip_balances_and_close_posts_only_users_share(api):
    headers = sign_up(api, "trip-owner", name="Asha")
    category = category_named(api, headers, "Transport")
    trip = data(
        api.post(
            f"{API}/trips",
            headers=headers,
            json={
                "name": "Goa road trip",
                "destination": "Goa",
                "mode": "split",
                "currency": "INR",
                "budget": "1000",
                "participants": ["Rahul", "Meera", "Arjun"],
            },
        )
    )
    owner = next(item for item in trip["participants"] if item["is_user"])
    rahul = next(item for item in trip["participants"] if item["name"] == "Rahul")
    trip = data(
        api.post(
            f"{API}/trips/{trip['id']}/expenses",
            headers=headers,
            json={
                "description": "Petrol",
                "category": "Transport",
                "category_id": category["id"],
                "amount": "100.00",
                "occurred_on": "2026-11-05",
                "payer_participant_id": owner["id"],
                "split_mode": "equal",
            },
        )
    )
    trip = data(
        api.post(
            f"{API}/trips/{trip['id']}/expenses",
            headers=headers,
            json={
                "description": "Snacks",
                "category": "Transport",
                "category_id": category["id"],
                "amount": "60.00",
                "occurred_on": "2026-11-06",
                "payer_participant_id": rahul["id"],
                "split_mode": "equal",
            },
        )
    )
    assert trip["total_spent"] == "160.0000"
    assert trip["user_share"] == "40.0000"
    assert trip["user_paid"] == "100.0000"
    assert trip["others_owe_user"] == "60.00"

    closed = data(
        api.post(
            f"{API}/trips/{trip['id']}/close",
            headers={**headers, "Idempotency-Key": "close-goa-trip"},
            json={"confirm": True},
        )
    )
    assert closed["status"] == "closed"
    transactions = data(api.get(f"{API}/transactions", headers=headers))
    assert sorted(item["amount"] for item in transactions) == ["15.0000", "25.0000"]
    dashboard = data(api.get(f"{API}/dashboard?year=2026&month=11", headers=headers))
    assert dashboard["spending"] == "40.0000"

    # Closing again is idempotent and never creates duplicate reporting expenses.
    api.post(
        f"{API}/trips/{trip['id']}/close",
        headers={**headers, "Idempotency-Key": "close-goa-again"},
        json={"confirm": True},
    )
    assert len(data(api.get(f"{API}/transactions", headers=headers))) == 2


def test_trip_rejects_cross_user_access_and_invalid_custom_split(api):
    owner_headers = sign_up(api, "trip-private")
    stranger_headers = sign_up(api, "trip-stranger")
    category = category_named(api, owner_headers, "Transport")
    trip = data(
        api.post(
            f"{API}/trips",
            headers=owner_headers,
            json={"name": "Private trip", "mode": "split", "currency": "INR", "participants": ["Friend"]},
        )
    )
    assert api.get(f"{API}/trips/{trip['id']}", headers=stranger_headers).status_code == 404
    response = api.post(
        f"{API}/trips/{trip['id']}/expenses",
        headers=owner_headers,
        json={
            "description": "Hotel",
            "category": "Transport",
            "category_id": category["id"],
            "amount": "100",
            "payer_participant_id": trip["participants"][0]["id"],
            "split_mode": "custom",
            "shares": [{"participant_id": trip["participants"][0]["id"], "amount": "50"}],
        },
    )
    assert response.status_code == 400
