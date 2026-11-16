import re
import time

from app.core import totp
from app.core.config import get_settings
from tests.helpers import API, data, error

PASSWORD = "SafePassword2026"
EMAIL = "twostep@example.com"


def register(api, monkeypatch):
    monkeypatch.setattr(get_settings(), "auth_required", True)
    response = api.post(f"{API}/auth/register", json={"name": "Two Step", "email": EMAIL, "password": PASSWORD})
    assert response.status_code == 201, response.text
    result = data(response)
    return result, {"Authorization": f"Bearer {result['access_token']}"}


def login(api):
    return data(api.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD}))


def test_authenticator_setup_sign_in_replay_and_backup_code(api, mailbox, monkeypatch):
    _, headers = register(api, monkeypatch)
    assert data(api.get(f"{API}/auth/2fa", headers=headers))["enabled"] is False
    setup = data(api.post(f"{API}/auth/2fa/totp/setup", headers=headers, json={"password": PASSWORD}))
    assert setup["otpauth_uri"].startswith("otpauth://totp/Spendova%3A")
    wrong = api.post(f"{API}/auth/2fa/totp/enable", headers=headers, json={"code": "000000"})
    assert wrong.status_code == 400
    now = time.time()
    enabled = data(
        api.post(
            f"{API}/auth/2fa/totp/enable",
            headers=headers,
            json={"code": totp.code_at(setup["secret"], int(now // 30) - 1)},
        )
    )
    backup = enabled["recovery_codes"]
    assert len(backup) == 8
    assert data(api.get(f"{API}/auth/2fa", headers=headers)) == {
        "enabled": True,
        "method": "totp",
        "recovery_codes_left": 8,
    }

    challenge = login(api)
    assert challenge["two_factor_required"] is True and "access_token" not in challenge
    code = totp.code_at(setup["secret"], int(now // 30))
    body = {"challenge_token": challenge["challenge_token"], "method": "totp", "code": code}
    signed = data(api.post(f"{API}/auth/login/2fa", json=body))
    assert signed["account"]["email"] == EMAIL

    # The same code cannot be used twice, and a used challenge is gone.
    again = login(api)
    replay = api.post(f"{API}/auth/login/2fa", json={**body, "challenge_token": again["challenge_token"]})
    assert replay.status_code == 400
    assert api.post(f"{API}/auth/login/2fa", json=body).status_code == 401

    recovery = {"challenge_token": again["challenge_token"], "method": "recovery", "code": backup[0].upper()}
    assert api.post(f"{API}/auth/login/2fa", json=recovery).status_code == 200
    third = login(api)
    reused = api.post(f"{API}/auth/login/2fa", json={**recovery, "challenge_token": third["challenge_token"]})
    assert reused.status_code == 400


def test_email_method_needs_verified_email_and_sends_sign_in_code(api, mailbox, monkeypatch):
    result, headers = register(api, monkeypatch)
    refused = api.post(f"{API}/auth/2fa/email/enable", headers=headers, json={"password": PASSWORD})
    assert refused.status_code == 400 and error(refused)["message"] == "Verify your email first"
    api.post(f"{API}/auth/verification/confirm", headers=headers, json={"code": result["development_code"]})
    assert (
        len(
            data(api.post(f"{API}/auth/2fa/email/enable", headers=headers, json={"password": PASSWORD}))[
                "recovery_codes"
            ]
        )
        == 8
    )

    challenge = login(api)
    assert challenge["method"] == "email"
    subject = mailbox[-1][1]
    assert "sign-in code" in subject
    match = re.search(r"\d{6}", subject)
    assert match is not None
    code = match.group()
    assert challenge["development_code"] in (None, code)
    resend = api.post(f"{API}/auth/login/2fa/resend", json={"challenge_token": challenge["challenge_token"]})
    assert resend.status_code == 429
    body = {"challenge_token": challenge["challenge_token"], "method": "email", "code": code}
    assert data(api.post(f"{API}/auth/login/2fa", json=body))["account"]["email"] == EMAIL


def test_attempt_limit_and_disable_requires_password(api, mailbox, monkeypatch):
    _, headers = register(api, monkeypatch)
    assert api.post(f"{API}/auth/2fa/totp/setup", headers=headers, json={"password": "wrong"}).status_code == 400
    setup = data(api.post(f"{API}/auth/2fa/totp/setup", headers=headers, json={"password": PASSWORD}))
    api.post(
        f"{API}/auth/2fa/totp/enable",
        headers=headers,
        json={"code": totp.code_at(setup["secret"], int(time.time() // 30))},
    )
    challenge = login(api)
    body = {"challenge_token": challenge["challenge_token"], "method": "totp", "code": "123456"}
    for _ in range(5):
        api.post(f"{API}/auth/login/2fa", json=body)
    assert api.post(f"{API}/auth/login/2fa", json=body).status_code == 401

    assert api.post(f"{API}/auth/2fa/disable", headers=headers, json={"password": "wrong"}).status_code == 400
    assert api.post(f"{API}/auth/2fa/disable", headers=headers, json={"password": PASSWORD}).status_code == 204
    assert "access_token" in login(api)
