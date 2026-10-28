from datetime import UTC, datetime

import pytest

from app.main import app
from app.services import email_templates
from app.services.identity_service import optional_identity_provider
from tests.helpers import API, data, error, sign_up

RESET = f"{API}/auth/password-reset"


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
def identity():
    fake = FakeIdentity({"password"})
    app.dependency_overrides[optional_identity_provider] = lambda: fake
    yield fake
    app.dependency_overrides.pop(optional_identity_provider, None)


def test_full_reset_flow_changes_password_and_signs_out_other_sessions(api, mailbox, identity):
    sign_up(api, "reset-user", email="Asha@Example.com", name="Asha Rao")
    requested = api.post(f"{RESET}/request", json={"email": " asha@example.COM "})
    code = data(requested)["development_code"]
    assert code and len(code) == 6
    to, subject, text, html = mailbox[-1]
    assert to == "Asha@Example.com"
    assert code in subject and code in text and html and code in html
    assert "Hi Asha," in text

    wrong = "000000" if code != "000000" else "111111"
    miss = api.post(f"{RESET}/verify", json={"email": "asha@example.com", "code": wrong})
    assert miss.status_code == 400
    assert "4 attempts left" in error(miss)["message"]

    token = data(api.post(f"{RESET}/verify", json={"email": "asha@example.com", "code": code}))["reset_token"]
    assert api.post(f"{RESET}/verify", json={"email": "asha@example.com", "code": code}).status_code == 400

    weak = api.post(f"{RESET}/complete", json={"reset_token": token, "new_password": "password"})
    assert weak.status_code == 400
    assert error(weak)["details"][0]["message"] == "Use at least one letter and one number"

    done = api.post(f"{RESET}/complete", json={"reset_token": token, "new_password": "NewPass2026"})
    assert data(done)["email"] == "Asha@Example.com"
    assert identity.passwords == {"reset-user": "NewPass2026"}
    assert identity.signed_out == ["reset-user"]
    assert mailbox[-1][1] == "Your Spendova password was changed"

    replay = api.post(f"{RESET}/complete", json={"reset_token": token, "new_password": "Another2026"})
    assert replay.status_code == 400


def test_unknown_email_gets_the_same_answer_and_no_mail(api, mailbox, identity):
    response = api.post(f"{RESET}/request", json={"email": "nobody@example.com"})
    assert data(response)["sent"] is True
    assert data(response)["development_code"] is None
    assert mailbox == []


def test_google_only_account_gets_a_sign_in_notice_instead_of_a_code(api, mailbox, identity):
    identity.methods = {"google.com"}
    sign_up(api, "google-user", email="google-only@example.com")
    response = api.post(f"{RESET}/request", json={"email": "google-only@example.com"})
    assert data(response)["development_code"] is None
    assert mailbox[-1][1] == "Your Spendova account uses Google sign-in"


def test_repeat_requests_are_throttled_silently(api, mailbox, identity):
    sign_up(api, "throttled", email="throttled@example.com")
    first = api.post(f"{RESET}/request", json={"email": "throttled@example.com"})
    second = api.post(f"{RESET}/request", json={"email": "throttled@example.com"})
    assert first.status_code == second.status_code == 200
    assert data(second)["development_code"] is None
    assert len(mailbox) == 1


def test_code_locks_after_five_wrong_attempts(api, mailbox, identity):
    sign_up(api, "guesser", email="guesser@example.com")
    code = data(api.post(f"{RESET}/request", json={"email": "guesser@example.com"}))["development_code"]
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        api.post(f"{RESET}/verify", json={"email": "guesser@example.com", "code": wrong})
    locked = api.post(f"{RESET}/verify", json={"email": "guesser@example.com", "code": code})
    assert locked.status_code == 429


def test_reset_is_unavailable_without_identity_configuration(api, mailbox):
    sign_up(api, "no-firebase", email="no-firebase@example.com")
    code = data(api.post(f"{RESET}/request", json={"email": "no-firebase@example.com"}))["development_code"]
    token = data(api.post(f"{RESET}/verify", json={"email": "no-firebase@example.com", "code": code}))["reset_token"]
    response = api.post(f"{RESET}/complete", json={"reset_token": token, "new_password": "NewPass2026"})
    assert response.status_code == 503
    assert error(response)["code"] == "SERVICE_UNAVAILABLE"


def test_templates_escape_user_supplied_values():
    content = email_templates.password_changed_email("<script>alert(1)</script>", datetime.now(UTC))
    _, text, html = email_templates.render(content)
    assert "<script>alert" not in html
    assert "&lt;script&gt;" in html
    assert "Hi <script>alert(1)</script>," in text  # Plain text is never rendered as HTML.
