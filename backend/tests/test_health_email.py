import pytest
from pydantic import ValidationError

from app.core.config import Settings, get_settings
from tests.helpers import data, error

TEST_KEY = "k" * 40
SECRET = "s" * 48


def _production(**overrides) -> Settings:
    values = {
        "environment": "production",
        "auth_required": True,
        "firebase_project_id": "spendova-test",
        "otp_secret": SECRET,
        "data_encryption_key": SECRET + "x",
        "email_delivery_mode": "smtp",
        "smtp_host": "smtp-relay.brevo.com",
        "smtp_username": "login@smtp-brevo.com",
        "smtp_password": "smtp-key",
        "email_from": "Spendova <no-reply@example.com>",
        **overrides,
    }
    return Settings(_env_file=None, **values)  # type: ignore[call-arg]


def test_production_accepts_a_complete_smtp_configuration():
    assert _production().is_production


@pytest.mark.parametrize("missing", ["smtp_host", "smtp_username", "smtp_password", "email_from"])
def test_production_refuses_to_start_without_smtp_settings(missing):
    with pytest.raises(ValidationError, match=missing.upper()):
        _production(**{missing: ""})


def test_production_rejects_a_short_email_test_key():
    with pytest.raises(ValidationError, match="EMAIL_TEST_API_KEY"):
        _production(email_test_api_key="too-short")


def test_email_health_reports_missing_smtp(api):
    response = api.get("/health/email")
    assert response.status_code == 503
    assert response.json()["data"]["stage"] == "configuration"


def test_test_email_is_disabled_without_a_key(api):
    response = api.post("/health/email", json={"email": "me@example.com"})
    assert response.status_code == 503
    assert error(response)["code"] == "EMAIL_TEST_DISABLED"


def test_test_email_requires_the_key(api, monkeypatch):
    monkeypatch.setattr(get_settings(), "email_test_api_key", TEST_KEY)
    response = api.post("/health/email", headers={"X-Email-Test-Key": "wrong"}, json={"email": "me@example.com"})
    assert response.status_code == 401


def test_cron_is_disabled_without_a_secret(api):
    response = api.get("/cron/email-outbox")
    assert response.status_code == 503
    assert error(response)["code"] == "CRON_DISABLED"


def test_cron_requires_the_bearer_secret(api, monkeypatch):
    monkeypatch.setattr(get_settings(), "cron_secret", SECRET)
    assert api.get("/cron/email-outbox", headers={"Authorization": "Bearer wrong"}).status_code == 401
    response = api.get("/cron/email-outbox", headers={"Authorization": f"Bearer {SECRET}"})
    assert response.status_code == 200


def test_test_email_sends_once_per_minute(api, mailbox, monkeypatch):
    monkeypatch.setattr(get_settings(), "email_test_api_key", TEST_KEY)
    headers = {"X-Email-Test-Key": TEST_KEY}
    first = api.post("/health/email", headers=headers, json={"email": "Me@Example.com"})
    assert first.status_code == 202
    assert data(first)["submission"] == "accepted"
    assert mailbox[0][0] == "me@example.com"
    assert mailbox[0][1] == "[Spendova test] Email delivery test"

    again = api.post("/health/email", headers=headers, json={"email": "me@example.com"})
    assert again.status_code == 429
    assert len(mailbox) == 1
