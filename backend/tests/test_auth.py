from tests.helpers import API, data, error, headers_for, sign_up


def test_google_sign_in_creates_then_updates_profile(api):
    headers = sign_up(api, "firebase-user-1", email="owner@example.com", name="Spendova Owner")
    again = api.post(
        f"{API}/auth/google",
        headers=headers,
        json={"email": "owner@example.com", "name": "Spendova Owner", "photo_url": "https://example.com/a.jpg"},
    )
    assert data(again)["photo_url"] == "https://example.com/a.jpg"

    updated = api.patch(
        f"{API}/auth/me",
        headers=headers,
        json={"base_currency": "USD", "country_code": "US", "onboarding_completed": True},
    )
    assert data(updated)["base_currency"] == "USD"
    assert data(updated)["onboarding_completed"] is True


def test_profile_rejects_unknown_fields(api):
    headers = sign_up(api, "strict-user")
    response = api.patch(f"{API}/auth/me", headers=headers, json={"email_verified": True})
    assert response.status_code == 400
    assert error(response)["details"][0]["path"] == "email_verified"


def test_email_verification_code_marks_profile_verified(api, mailbox):
    headers = sign_up(api, "email-user-1", name="New User")
    assert data(api.get(f"{API}/auth/me", headers=headers))["email_verified"] is False

    sent = data(api.post(f"{API}/auth/verification/send", headers=headers))
    code = sent["development_code"]
    assert code and len(code) == 6
    assert mailbox[-1][1] == f"{code} is your Spendova verification code"

    confirmed = api.post(f"{API}/auth/verification/confirm", headers=headers, json={"code": code})
    assert data(confirmed)["email_verified"] is True


def test_wrong_verification_codes_are_counted_and_lock_out(api, mailbox):
    headers = sign_up(api, "guessing-user")
    code = data(api.post(f"{API}/auth/verification/send", headers=headers))["development_code"]
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        assert api.post(f"{API}/auth/verification/confirm", headers=headers, json={"code": wrong}).status_code == 400
    locked = api.post(f"{API}/auth/verification/confirm", headers=headers, json={"code": code})
    assert locked.status_code == 429
    assert error(locked)["code"] == "RATE_LIMITED"


def test_profile_requires_sign_in_first(api):
    response = api.get(f"{API}/auth/me", headers=headers_for("never-signed-in"))
    assert response.status_code == 404
    assert error(response)["code"] == "NOT_FOUND"
