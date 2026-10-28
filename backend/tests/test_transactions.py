from tests.helpers import API, category_named, create_account, data, error, expense, sign_up


def test_transaction_is_persisted_and_idempotent(api):
    headers = sign_up(api, "idempotent-user")
    payload = {"amount": "125.50", "merchant": "Market", "occurred_on": "2026-09-30"}
    first = expense(api, headers, "test-key-0001", **payload)
    second = expense(api, headers, "test-key-0001", **payload)
    assert first.status_code == 201
    assert data(second)["id"] == data(first)["id"]
    assert len(data(first)["entries"]) == 2
    assert len(data(api.get(f"{API}/transactions", headers=headers))) == 1


def test_transactions_are_isolated_between_users(api):
    owner = sign_up(api, "owner")
    stranger = sign_up(api, "stranger")
    assert expense(api, owner, "owner-key-001").status_code == 201
    assert data(api.get(f"{API}/transactions", headers=stranger)) == []


def test_category_must_match_the_money_flow(api):
    headers = sign_up(api, "mismatch")
    salary = category_named(api, headers, "Salary")
    response = expense(api, headers, "mismatch-key-01", category_id=salary["id"])
    assert response.status_code == 400
    assert error(response)["message"] == "An expense transaction requires an expense category"


def test_currency_must_match_the_account(api):
    headers = sign_up(api, "currency-check")
    account = create_account(api, headers, currency="USD")
    response = expense(api, headers, "currency-key-01", source_account_id=account["id"], currency="INR")
    assert response.status_code == 400


def test_voided_transactions_leave_balances(api):
    headers = sign_up(api, "voider")
    account = create_account(api, headers, opening_balance="1000")
    created = data(expense(api, headers, "void-key-0001", amount="300", source_account_id=account["id"]))
    assert api.delete(f"{API}/transactions/{created['id']}", headers=headers).status_code == 204
    assert data(api.get(f"{API}/accounts", headers=headers))[0]["current_balance"] == "1000.0000"
    assert data(api.get(f"{API}/transactions", headers=headers))[0]["status"] == "voided"


def test_idempotency_key_header_is_required(api):
    headers = sign_up(api, "no-key")
    response = api.post(
        f"{API}/transactions",
        headers=headers,
        json={"kind": "expense", "amount": "10", "source": "bank", "destination": "food"},
    )
    assert response.status_code == 400
    assert error(response)["details"][0]["path"] == "idempotency-key"
