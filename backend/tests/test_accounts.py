from datetime import date

from tests.helpers import API, create_account, data, error, sign_up


def test_loan_repayment_updates_bank_and_outstanding_balances(api):
    headers = sign_up(api, "borrower")
    create_account(api, headers, name="Salary bank", opening_balance="10000")
    create_account(
        api,
        headers,
        name="Personal loan",
        account_type="loan",
        opening_balance="-50000",
        principal_amount="50000",
        institution="Example Bank",
    )
    repayment = api.post(
        f"{API}/transactions",
        headers={**headers, "Idempotency-Key": "loan-repayment-001"},
        json={
            "kind": "transfer",
            "amount": "5000",
            "currency": "INR",
            "source": "Salary bank",
            "destination": "Personal loan",
            "occurred_on": date.today().isoformat(),
        },
    )
    assert repayment.status_code == 201
    accounts = {item["name"]: item for item in data(api.get(f"{API}/accounts", headers=headers))}
    assert accounts["Salary bank"]["current_balance"] == "5000.0000"
    assert accounts["Personal loan"]["current_balance"] == "-45000.0000"


def test_duplicate_account_names_are_isolated_by_account_id(api):
    headers = sign_up(api, "duplicate-account-owner")
    first = create_account(api, headers, opening_balance="1000")
    second = create_account(api, headers, opening_balance="2000")
    expense = api.post(
        f"{API}/transactions",
        headers={**headers, "Idempotency-Key": "duplicate-account-expense-001"},
        json={
            "kind": "expense",
            "amount": "250",
            "currency": "INR",
            "source": "HDFC Savings",
            "destination": "Groceries",
            "source_account_id": second["id"],
            "occurred_on": date.today().isoformat(),
        },
    )
    assert expense.status_code == 201
    accounts = {item["id"]: item for item in data(api.get(f"{API}/accounts", headers=headers))}
    assert accounts[first["id"]]["current_balance"] == "1000.0000"
    assert accounts[second["id"]]["current_balance"] == "1750.0000"


def test_deposit_accounts_require_their_terms(api):
    headers = sign_up(api, "saver")
    missing = api.post(
        f"{API}/accounts",
        headers=headers,
        json={"name": "FD", "account_type": "fixed_deposit", "currency": "INR", "principal_amount": "100000"},
    )
    assert missing.status_code == 400
    assert error(missing)["details"][0]["message"] == "deposit tenure is required"


def test_archived_accounts_disappear_and_belong_to_their_owner(api):
    owner = sign_up(api, "account-owner")
    stranger = sign_up(api, "account-stranger")
    account = create_account(api, owner)
    assert api.delete(f"{API}/accounts/{account['id']}", headers=stranger).status_code == 404
    assert api.delete(f"{API}/accounts/{account['id']}", headers=owner).status_code == 204
    assert data(api.get(f"{API}/accounts", headers=owner)) == []
