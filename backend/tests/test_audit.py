from tests.helpers import API, create_account, data, expense, sign_up


def test_changes_are_recorded_for_their_owner_only(api):
    owner = sign_up(api, "audited")
    other = sign_up(api, "other-person")
    account = create_account(api, owner)
    expense(api, owner, "audited-expense-1", source_account_id=account["id"])

    actions = [entry["action"] for entry in data(api.get(f"{API}/audit", headers=owner))["items"]]
    assert actions[:3] == ["TRANSACTION_CREATE", "ACCOUNT_CREATE", "USER_SIGN_UP"]
    assert [entry["action"] for entry in data(api.get(f"{API}/audit", headers=other))["items"]] == ["USER_SIGN_UP"]


def test_repeated_idempotent_requests_are_audited_once(api):
    headers = sign_up(api, "idempotent-audit")
    expense(api, headers, "same-key-0001")
    expense(api, headers, "same-key-0001")
    actions = [entry["action"] for entry in data(api.get(f"{API}/audit", headers=headers))["items"]]
    assert actions.count("TRANSACTION_CREATE") == 1


def test_audit_pages_with_a_cursor(api):
    headers = sign_up(api, "paged-audit")
    for index in range(3):
        create_account(api, headers, name=f"Account {index}")
    first = data(api.get(f"{API}/audit?limit=2", headers=headers))
    assert len(first["items"]) == 2 and first["next_cursor"]
    rest = data(api.get(f"{API}/audit?limit=2&cursor={first['next_cursor']}", headers=headers))
    assert len(rest["items"]) == 2 and rest["next_cursor"] is None
