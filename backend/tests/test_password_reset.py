import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["AUTH_REQUIRED"] = "false"

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app import email_templates
from app.api import password_reset
from app.main import app
from app.services.identity import optional_identity_provider


class FakeIdentity:
    def __init__(self, methods: set[str]) -> None:
        self.methods = methods
        self.passwords: dict[str, str] = {}
        self.signed_out: list[str] = []

    def sign_in_methods(self, uid: str) -> set[str]:
        return self.methods

    def set_password(self, uid: str, password: str) -> None:
        self.passwords[uid] = password

    def sign_out_everywhere(self, uid: str) -> None:
        self.signed_out.append(uid)


@pytest.fixture
def mailbox(monkeypatch):
    sent: list[tuple[str, email_templates.EmailContent]] = []
    monkeypatch.setattr(password_reset, "send_in_background", lambda to, content: sent.append((to, content)))
    return sent


@pytest.fixture
def identity():
    fake = FakeIdentity({"password"})
    app.dependency_overrides[optional_identity_provider] = lambda: fake
    yield fake
    app.dependency_overrides.pop(optional_identity_provider, None)


def body(response):
    return response.json()["data"]


def sign_up(client: TestClient, uid: str, email: str) -> None:
    client.post("/api/v1/auth/google", headers={"X-User-Id": uid}, json={"email": email, "name": "Asha Rao"})


def test_full_reset_flow_changes_password_and_signs_out_other_sessions(mailbox, identity):
    with TestClient(app) as client:
        sign_up(client, "reset-user", "Asha@Example.com")
        requested = client.post("/api/v1/auth/password-reset/request", json={"email": " asha@example.COM "})
        assert requested.status_code == 200
        code = body(requested)["development_code"]
        assert code and len(code) == 6
        to, message = mailbox[-1]
        assert to == "Asha@Example.com"
        assert code in message.subject and code in message.html and code in message.text
        assert "Hi Asha," in message.text

        wrong = "000000" if code != "000000" else "111111"
        miss = client.post("/api/v1/auth/password-reset/verify", json={"email": "asha@example.com", "code": wrong})
        assert miss.status_code == 400
        assert "4 attempts left" in miss.json()["message"]

        verified = client.post("/api/v1/auth/password-reset/verify", json={"email": "asha@example.com", "code": code})
        assert verified.status_code == 200
        token = body(verified)["reset_token"]
        reused_code = client.post("/api/v1/auth/password-reset/verify", json={"email": "asha@example.com", "code": code})
        assert reused_code.status_code == 400

        weak = client.post("/api/v1/auth/password-reset/complete", json={"reset_token": token, "new_password": "password"})
        assert weak.status_code == 422

        done = client.post("/api/v1/auth/password-reset/complete", json={"reset_token": token, "new_password": "NewPass2026"})
        assert done.status_code == 200
        assert body(done)["email"] == "Asha@Example.com"
        assert identity.passwords == {"reset-user": "NewPass2026"}
        assert identity.signed_out == ["reset-user"]
        assert mailbox[-1][1].subject == "Your Spendova password was changed"

        replay = client.post("/api/v1/auth/password-reset/complete", json={"reset_token": token, "new_password": "Another2026"})
        assert replay.status_code == 400


def test_unknown_email_gets_the_same_answer_and_no_mail(mailbox, identity):
    with TestClient(app) as client:
        response = client.post("/api/v1/auth/password-reset/request", json={"email": "nobody@example.com"})
        assert response.status_code == 200
        assert body(response)["sent"] is True
        assert body(response)["development_code"] is None
        assert mailbox == []


def test_google_only_account_gets_a_sign_in_notice_instead_of_a_code(mailbox, identity):
    identity.methods = {"google.com"}
    with TestClient(app) as client:
        sign_up(client, "google-user", "google-only@example.com")
        response = client.post("/api/v1/auth/password-reset/request", json={"email": "google-only@example.com"})
        assert response.status_code == 200
        assert body(response)["development_code"] is None
        assert mailbox[-1][1].subject == "Your Spendova account uses Google sign-in"


def test_repeat_requests_are_throttled_silently(mailbox, identity):
    with TestClient(app) as client:
        sign_up(client, "throttled", "throttled@example.com")
        first = client.post("/api/v1/auth/password-reset/request", json={"email": "throttled@example.com"})
        second = client.post("/api/v1/auth/password-reset/request", json={"email": "throttled@example.com"})
        assert first.status_code == second.status_code == 200
        assert body(second)["development_code"] is None
        assert len(mailbox) == 1


def test_code_locks_after_five_wrong_attempts(mailbox, identity):
    with TestClient(app) as client:
        sign_up(client, "guesser", "guesser@example.com")
        code = body(client.post("/api/v1/auth/password-reset/request", json={"email": "guesser@example.com"}))["development_code"]
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(5):
            client.post("/api/v1/auth/password-reset/verify", json={"email": "guesser@example.com", "code": wrong})
        locked = client.post("/api/v1/auth/password-reset/verify", json={"email": "guesser@example.com", "code": code})
        assert locked.status_code == 429


def test_templates_escape_user_supplied_values():
    message = email_templates.password_changed(
        name="<script>alert(1)</script>", app_url="https://spendova.app", changed_at=datetime.now(timezone.utc)
    )
    assert "<script>" not in message.html
    assert "&lt;script&gt;" in message.html
