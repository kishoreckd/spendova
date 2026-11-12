from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.passwords import verify_password
from app.db.model_helpers import utcnow
from app.db.models.auth_model import PasswordCredential, UserSession
from app.db.session import engine
from tests.helpers import API, data, sign_up

ORIGIN = {"Origin": "http://testserver"}
PASSWORD = "SafePassword2026"


def register(api, email="local@example.com"):
    response = api.post(f"{API}/auth/register", json={"name": "Local User", "email": email, "password": PASSWORD})
    assert response.status_code == 201, response.text
    return data(response)


def test_local_signup_hashes_password_and_requires_verification(api, mailbox, monkeypatch):
    monkeypatch.setattr(get_settings(), "auth_required", True)
    result = register(api)
    token = result["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert "HttpOnly" in api.cookies.get("spendova_refresh", "") or api.cookies.get("spendova_refresh")
    assert result["development_code"] in mailbox[-1][1]
    assert api.get(f"{API}/accounts", headers=headers).status_code == 403
    confirmed = api.post(f"{API}/auth/verification/confirm", headers=headers, json={"code": result["development_code"]})
    assert data(confirmed)["email_verified"] is True
    assert api.get(f"{API}/accounts", headers=headers).status_code == 200
    with Session(engine) as db:
        credential = db.get(PasswordCredential, result["account"]["id"])
        assert credential is not None
        assert credential.password_hash != PASSWORD and verify_password(PASSWORD, credential.password_hash)
        assert "password_hash" not in str(result)
    assert (
        api.post(
            f"{API}/auth/register", json={"name": "Duplicate", "email": "LOCAL@example.com", "password": PASSWORD}
        ).status_code
        == 409
    )


def test_refresh_rotation_logout_and_session_expiry(api, mailbox, monkeypatch):
    monkeypatch.setattr(get_settings(), "auth_required", True)
    register(api)
    old_cookie = api.cookies.get("spendova_refresh")
    refreshed = api.post(f"{API}/auth/refresh", headers=ORIGIN)
    assert refreshed.status_code == 200
    assert api.cookies.get("spendova_refresh") != old_cookie
    assert (
        api.post(f"{API}/auth/refresh", headers={**ORIGIN, "Cookie": f"spendova_refresh={old_cookie}"}).status_code
        == 401
    )
    token = data(refreshed)["access_token"]
    assert api.post(f"{API}/auth/logout", headers=ORIGIN).status_code == 204
    assert api.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    assert api.post(f"{API}/auth/refresh", headers=ORIGIN).status_code == 401
    signed = data(api.post(f"{API}/auth/login", json={"email": "local@example.com", "password": PASSWORD}))
    with Session(engine) as db:
        session = db.scalar(select(UserSession))
        assert session is not None
        session.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    assert api.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {signed['access_token']}"}).status_code == 401


def test_login_lockout_and_untrusted_origin(api, mailbox):
    register(api)
    for _ in range(5):
        response = api.post(f"{API}/auth/login", json={"email": "local@example.com", "password": "incorrect"})
        assert response.status_code == 401
    assert api.post(f"{API}/auth/login", json={"email": "local@example.com", "password": PASSWORD}).status_code == 429
    assert api.post(f"{API}/auth/refresh", headers={"Origin": "https://evil.example"}).status_code == 403
    assert api.post(f"{API}/auth/refresh").status_code == 403
    assert (
        api.post(
            f"{API}/auth/login",
            headers={"Origin": "https://evil.example"},
            json={"email": "local@example.com", "password": PASSWORD},
        ).status_code
        == 403
    )


def test_reset_preserves_existing_user_data_and_revokes_local_sessions(api, mailbox, monkeypatch):
    legacy = sign_up(api, "existing-user", email="existing@example.com")
    account = data(
        api.post(
            f"{API}/accounts",
            headers=legacy,
            json={"name": "Existing Bank", "account_type": "bank", "opening_balance": "1000"},
        )
    )
    monkeypatch.setattr(get_settings(), "auth_required", True)
    requested = data(api.post(f"{API}/auth/password-reset/request", json={"email": "existing@example.com"}))
    verified = data(
        api.post(
            f"{API}/auth/password-reset/verify",
            json={"email": "existing@example.com", "code": requested["development_code"]},
        )
    )
    reset = api.post(
        f"{API}/auth/password-reset/complete", json={"reset_token": verified["reset_token"], "new_password": PASSWORD}
    )
    assert reset.status_code == 200
    login = data(api.post(f"{API}/auth/login", json={"email": "existing@example.com", "password": PASSWORD}))
    assert login["account"]["id"] == "existing-user"
    rows = data(api.get(f"{API}/accounts", headers={"Authorization": f"Bearer {login['access_token']}"}))
    assert rows[0]["id"] == account["id"]
    # A second reset invalidates even an unexpired access token.
    with Session(engine) as db:
        from app.db.models.password_reset_code_model import PasswordResetCode

        record = db.get(PasswordResetCode, "existing-user")
        assert record is None
    requested = data(api.post(f"{API}/auth/password-reset/request", json={"email": "existing@example.com"}))
    verified = data(
        api.post(
            f"{API}/auth/password-reset/verify",
            json={"email": "existing@example.com", "code": requested["development_code"]},
        )
    )
    api.post(
        f"{API}/auth/password-reset/complete",
        json={"reset_token": verified["reset_token"], "new_password": "OtherPassword2026"},
    )
    assert api.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {login['access_token']}"}).status_code == 401
