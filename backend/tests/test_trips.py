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


def _petrol(category_id: str, payer_id: str, split_mode: str = "personal") -> dict:
    return {
        "description": "Petrol",
        "category": "Transport",
        "category_id": category_id,
        "amount": "100.00",
        "occurred_on": "2026-11-17",
        "payer_participant_id": payer_id,
        "split_mode": split_mode,
    }


def _close(api, headers, trip_id: str, key: str) -> dict:
    return data(
        api.post(f"{API}/trips/{trip_id}/close", headers={**headers, "Idempotency-Key": key}, json={"confirm": True})
    )


def test_reopen_voids_postings_and_reclosing_posts_the_corrected_split(api):
    headers = sign_up(api, "trip-reopen", name="Kishore")
    category = category_named(api, headers, "Transport")
    trip = data(api.post(f"{API}/trips", headers=headers, json={"name": "test"}))
    owner = trip["participants"][0]
    trip = data(
        api.post(f"{API}/trips/{trip['id']}/expenses", headers=headers, json=_petrol(category["id"], owner["id"]))
    )
    trip = data(api.post(f"{API}/trips/{trip['id']}/participants", headers=headers, json={"name": "vijay"}))
    _close(api, headers, trip["id"], "close-test-1")
    posted = data(api.get(f"{API}/transactions", headers=headers))
    assert [item["amount"] for item in posted] == ["100.0000"]

    # Closed trips stay read-only until reopened.
    expense_id = trip["expenses"][0]["id"]
    edit_path = f"{API}/trips/{trip['id']}/expenses/{expense_id}"
    assert api.put(edit_path, headers=headers, json=_petrol(category["id"], owner["id"], "equal")).status_code == 400

    reopened = data(api.post(f"{API}/trips/{trip['id']}/reopen", headers=headers))
    assert reopened["status"] != "closed" and reopened["expenses"][0]["posted_transaction_id"] is None
    assert data(api.get(f"{API}/dashboard?year=2026&month=11", headers=headers))["spending"] == "0"

    vijay = next(item for item in reopened["participants"] if item["name"] == "vijay")
    edited = data(api.put(edit_path, headers=headers, json=_petrol(category["id"], vijay["id"], "equal")))
    assert Decimal(edited["user_share"]) == Decimal(edited["user_owes_others"]) == Decimal("50")

    _close(api, headers, trip["id"], "close-test-2")
    active = [item for item in data(api.get(f"{API}/transactions", headers=headers)) if item["status"] != "voided"]
    assert [item["amount"] for item in active] == ["50.0000"]
    assert data(api.get(f"{API}/dashboard?year=2026&month=11", headers=headers))["spending"] == "50.0000"


def test_settle_up_zeroes_balances_without_touching_the_ledger(api):
    headers = sign_up(api, "trip-settle", name="Kishore")
    stranger = sign_up(api, "trip-settle-stranger")
    category = category_named(api, headers, "Transport")
    trip = data(api.post(f"{API}/trips", headers=headers, json={"name": "Goa"}))
    owner = trip["participants"][0]
    trip = data(api.post(f"{API}/trips/{trip['id']}/participants", headers=headers, json={"name": "vijay"}))
    vijay = next(item for item in trip["participants"] if item["name"] == "vijay")
    path = f"{API}/trips/{trip['id']}"
    api.post(f"{path}/expenses", headers=headers, json=_petrol(category["id"], owner["id"], "equal"))
    _close(api, headers, trip["id"], "close-goa-settle")

    payment = {"from_participant_id": vijay["id"], "to_participant_id": owner["id"], "amount": "50.00"}
    same = {**payment, "to_participant_id": vijay["id"]}
    assert api.post(f"{path}/settlements", headers=headers, json=same).status_code == 400
    assert api.post(f"{path}/settlements", headers=stranger, json=payment).status_code == 404
    settled = data(api.post(f"{path}/settlements", headers=headers, json=payment))
    assert all(Decimal(item["balance"]) == 0 for item in settled["balances"])
    assert Decimal(settled["others_owe_user"]) == 0
    assert len(data(api.get(f"{API}/transactions", headers=headers))) == 1  # only the posted share

    removed = data(api.delete(f"{path}/settlements/{settled['settlements'][0]['id']}", headers=headers))
    assert Decimal(removed["others_owe_user"]) == Decimal("50")


def test_delete_trip_keeps_posted_ledger_and_hides_trip_from_others(api):
    headers = sign_up(api, "trip-delete")
    stranger = sign_up(api, "trip-delete-stranger")
    category = category_named(api, headers, "Transport")
    trip = data(api.post(f"{API}/trips", headers=headers, json={"name": "Weekend"}))
    owner = trip["participants"][0]
    api.post(f"{API}/trips/{trip['id']}/expenses", headers=headers, json=_petrol(category["id"], owner["id"]))
    _close(api, headers, trip["id"], "close-weekend")
    assert api.delete(f"{API}/trips/{trip['id']}", headers=stranger).status_code == 404
    assert api.delete(f"{API}/trips/{trip['id']}", headers=headers).status_code == 204
    assert data(api.get(f"{API}/trips", headers=headers)) == []
    assert len(data(api.get(f"{API}/transactions", headers=headers))) == 1


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


def test_adding_first_traveller_converts_personal_trip_without_resplitting_old_expenses(api):
    headers = sign_up(api, "trip-convert", name="Kiran")
    category = category_named(api, headers, "Transport")
    trip = data(
        api.post(
            f"{API}/trips",
            headers=headers,
            json={"name": "Weekend", "mode": "personal", "currency": "INR"},
        )
    )
    owner = trip["participants"][0]
    trip = data(
        api.post(
            f"{API}/trips/{trip['id']}/expenses",
            headers=headers,
            json={
                "description": "Train",
                "category": "Transport",
                "category_id": category["id"],
                "amount": "120.00",
                "payer_participant_id": owner["id"],
                "split_mode": "personal",
            },
        )
    )
    converted = data(
        api.post(
            f"{API}/trips/{trip['id']}/participants",
            headers=headers,
            json={"name": "Meera"},
        )
    )
    assert converted["mode"] == "split"
    assert len(converted["participants"]) == 2
    assert converted["user_share"] == "120.0000"
    assert converted["expenses"][0]["split_mode"] == "personal"
