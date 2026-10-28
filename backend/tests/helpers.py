from datetime import date

from fastapi.testclient import TestClient

API = "/api/v1"


def headers_for(user_id: str, idempotency_key: str | None = None) -> dict[str, str]:
    headers = {"X-User-Id": user_id}
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    return headers


def sign_up(api: TestClient, user_id: str, *, email: str | None = None, name: str = "Test User") -> dict[str, str]:
    """Creates the profile (as the app does after Firebase sign-in) and returns request headers."""
    response = api.post(
        f"{API}/auth/google",
        headers=headers_for(user_id),
        json={"email": email or f"{user_id}@example.com", "name": name},
    )
    assert response.status_code == 200, response.text
    return headers_for(user_id)


def data(response):
    """Asserts the success envelope and returns its data."""
    body = response.json()
    assert set(body) == {"status", "message", "data"}, body
    assert body["status"] == "success", body
    return body["data"]


def error(response) -> dict:
    """Asserts the error envelope and returns {message, code, details}."""
    body = response.json()
    assert set(body) == {"status", "message", "data"}, body
    assert body["status"] == "error", body
    return {"message": body["message"], **body["data"]}


def category_named(api: TestClient, headers: dict[str, str], name: str) -> dict:
    categories = data(api.get(f"{API}/categories", headers=headers))
    return next(item for item in categories if item["name"] == name)


def create_account(api: TestClient, headers: dict[str, str], **overrides) -> dict:
    payload = {"name": "HDFC Savings", "account_type": "bank", "currency": "INR", "opening_balance": "0", **overrides}
    response = api.post(f"{API}/accounts", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return data(response)


def expense(api: TestClient, headers: dict[str, str], key: str, **overrides):
    payload = {
        "kind": "expense",
        "amount": "100",
        "source": "bank",
        "destination": "Groceries",
        "occurred_on": date.today().isoformat(),
        **overrides,
    }
    return api.post(f"{API}/transactions", headers={**headers, "Idempotency-Key": key}, json=payload)
