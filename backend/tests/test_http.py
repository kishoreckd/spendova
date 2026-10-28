"""Transport contract: envelope, error codes, security headers, health, and rate limits."""

from app.core.config import get_settings
from tests.helpers import API, data, error, headers_for, sign_up


def test_unknown_route_uses_the_error_envelope(api):
    response = api.get(f"{API}/does-not-exist")
    assert response.status_code == 404
    assert error(response) == {"message": "Route not found", "code": "NOT_FOUND"}


def test_validation_errors_name_the_field(api):
    headers = sign_up(api, "validator")
    response = api.post(f"{API}/goals", headers=headers, json={"name": "", "target_amount": -1, "months": 0})
    assert response.status_code == 400
    body = error(response)
    assert body["code"] == "VALIDATION_ERROR"
    assert {detail["path"] for detail in body["details"]} == {"name", "target_amount", "months"}


def test_security_headers_are_set(api):
    response = api.get("/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Cache-Control"] == "no-store"


def test_health_reports_database(api):
    body = data(api.get("/health"))
    assert body["status"] == "ok"
    assert body["db"] == "ok"


def test_dashboard_month_is_validated(api):
    headers = sign_up(api, "dashboard-user")
    assert api.get(f"{API}/dashboard?month=13", headers=headers).status_code == 400
    summary = data(api.get(f"{API}/dashboard?year=2026&month=10", headers=headers))
    assert summary["period"] == {"year": 2026, "month": 10}


def test_public_reset_routes_are_rate_limited(api, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(settings, "rate_limit_auth_requests", 2)
    url = f"{API}/auth/password-reset/request"
    statuses = [api.post(url, json={"email": "someone@example.com"}).status_code for _ in range(3)]
    assert statuses == [200, 200, 429]


def test_missing_profile_cannot_use_finance_routes_once_auth_is_required(api, monkeypatch):
    monkeypatch.setattr(get_settings(), "auth_required", True)
    response = api.get(f"{API}/accounts", headers=headers_for("anyone"))
    assert response.status_code == 401
    assert error(response)["code"] == "UNAUTHORIZED"
