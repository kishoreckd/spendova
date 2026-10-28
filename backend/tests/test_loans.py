from datetime import date, timedelta

from app.core.finance import add_months
from tests.helpers import API, create_account, data, error, sign_up

LOANS = f"{API}/loans"


def _phone_emi(**overrides) -> dict:
    return {
        "name": "iPhone 16",
        "loan_type": "product_emi",
        "lender": "Bajaj Finserv",
        "principal": "50000",
        "annual_interest_rate": "12",
        "tenure_months": 12,
        "first_due_on": (date.today() + timedelta(days=10)).isoformat(),
        **overrides,
    }


def test_preview_calculates_emi_interest_and_schedule(api):
    headers = sign_up(api, "previewer")
    preview = data(api.post(f"{LOANS}/preview", headers=headers, json=_phone_emi()))
    summary = preview["summary"]
    assert summary["emi"] == "4442.44"
    assert summary["total_interest"] == "3309.27"
    assert summary["total_payable"] == "53309.27"
    assert summary["rate_is_estimated"] is False
    assert len(preview["schedule"]) == 12
    assert preview["schedule"][0]["interest"] == "500.00"


def test_emi_only_offer_reveals_the_estimated_rate(api):
    headers = sign_up(api, "shop-buyer")
    terms = _phone_emi(annual_interest_rate=None, emi_amount="4600")
    summary = data(api.post(f"{LOANS}/preview", headers=headers, json=terms))["summary"]
    assert summary["annual_rate"] == "18.67"
    assert summary["rate_is_estimated"] is True
    assert summary["total_interest"] == "5200.00"


def test_rate_or_emi_is_required_and_terms_must_fit(api):
    headers = sign_up(api, "careless")
    missing = api.post(f"{LOANS}/preview", headers=headers, json=_phone_emi(annual_interest_rate=None))
    assert missing.status_code == 400
    assert "interest rate, the monthly EMI" in error(missing)["details"][0]["message"]
    mismatch = api.post(f"{LOANS}/preview", headers=headers, json=_phone_emi(emi_amount="3000"))
    assert mismatch.status_code == 400
    assert "don't fit together" in error(mismatch)["message"]


def test_creating_a_loan_adds_an_emi_bill_in_the_loans_category(api):
    headers = sign_up(api, "borrower")
    account = create_account(api, headers, name="HDFC Savings", opening_balance="100000")
    loan = data(api.post(LOANS, headers=headers, json=_phone_emi(account_id=account["id"])))
    assert loan["status"] == "active"
    assert loan["summary"]["installments_paid"] == 0

    bills = data(api.get(f"{API}/recurring-rules", headers=headers))
    assert len(bills) == 1
    bill = bills[0]
    assert bill["id"] == loan["recurring_rule_id"]
    assert bill["name"] == "iPhone 16 EMI"
    assert bill["amount"] == "4442.4400"
    assert bill["source_account_id"] == account["id"]
    categories = {c["id"]: c["name"] for c in data(api.get(f"{API}/categories", headers=headers))}
    assert categories[bill["category_id"]] == "Loans & EMIs"


def test_older_loans_assume_past_emis_were_paid(api):
    headers = sign_up(api, "old-loan")
    first_due = add_months(date.today(), -3)
    loan = data(api.post(LOANS, headers=headers, json=_phone_emi(first_due_on=first_due.isoformat())))
    # Three, two and one month ago are assumed paid; today's EMI is left due so it can be recorded.
    assert loan["summary"]["installments_paid"] == 3
    assert loan["summary"]["next_due_on"] == add_months(first_due, 3).isoformat()
    assert loan["summary"]["due_this_month"] is True


def test_preview_uses_emis_already_paid_when_given(api):
    headers = sign_up(api, "preview-paid")
    terms = {**_phone_emi(first_due_on=add_months(date.today(), -3).isoformat()), "installments_paid_before": 1}
    summary = data(api.post(f"{LOANS}/preview", headers=headers, json=terms))["summary"]
    assert summary["installments_paid"] == 1
    assert summary["overdue"] is True


def test_paying_each_emi_posts_transactions_and_closes_the_loan(api):
    headers = sign_up(api, "payer")
    account = create_account(api, headers, name="Salary", opening_balance="100000")
    loan = data(
        api.post(
            LOANS,
            headers=headers,
            json=_phone_emi(account_id=account["id"], tenure_months=3, principal="9000", annual_interest_rate="0"),
        )
    )
    first = api.post(f"{LOANS}/{loan['id']}/payments", headers={**headers, "Idempotency-Key": "emi-payment-1"}, json={})
    assert data(first)["loan"]["summary"]["installments_paid"] == 1
    assert data(first)["transaction"]["amount"] == "3000.0000"
    repeat = api.post(
        f"{LOANS}/{loan['id']}/payments", headers={**headers, "Idempotency-Key": "emi-payment-1"}, json={}
    )
    assert data(repeat)["loan"]["summary"]["installments_paid"] == 1

    for key in ("emi-payment-2", "emi-payment-3"):
        api.post(f"{LOANS}/{loan['id']}/payments", headers={**headers, "Idempotency-Key": key}, json={})
    closed = data(api.get(f"{LOANS}?include_closed=true", headers=headers))[0]
    assert closed["status"] == "closed"
    assert closed["summary"]["installments_left"] == 0
    assert data(api.get(f"{API}/recurring-rules", headers=headers)) == []
    assert data(api.get(f"{API}/accounts", headers=headers))[0]["current_balance"] == "91000.0000"

    again = api.post(f"{LOANS}/{loan['id']}/payments", headers={**headers, "Idempotency-Key": "emi-payment-4"}, json={})
    assert again.status_code == 400


def test_schedule_marks_paid_installments(api):
    headers = sign_up(api, "scheduler")
    loan = data(api.post(LOANS, headers=headers, json=_phone_emi(installments_paid_before=2)))
    rows = data(api.get(f"{LOANS}/{loan['id']}/schedule", headers=headers))
    assert [row["paid"] for row in rows[:3]] == [True, True, False]
    assert rows[-1]["balance"] == "0.00"


def test_overview_sums_emis_and_compares_them_with_income(api):
    headers = sign_up(api, "overview-user")
    last_month = add_months(date.today().replace(day=1), -1)
    for index in range(3):
        api.post(
            f"{API}/transactions",
            headers={**headers, "Idempotency-Key": f"salary-income-{index}"},
            json={
                "kind": "income",
                "amount": "60000",
                "source": "Employer",
                "destination": "Bank",
                "occurred_on": add_months(last_month, -index).isoformat(),
            },
        )
    api.post(LOANS, headers=headers, json=_phone_emi())
    api.post(
        LOANS,
        headers=headers,
        json=_phone_emi(
            name="Car loan", loan_type="vehicle", principal="800000", annual_interest_rate="9", tenure_months=60
        ),
    )
    overview = data(api.get(f"{LOANS}/overview", headers=headers))
    assert overview["active_loans"] == 2
    assert overview["monthly_emi_total"] == "21049.12"
    assert overview["average_monthly_income"] == "60000.00"
    assert overview["emi_to_income_percent"] == "35.1"


def test_loans_are_private_and_can_be_closed(api):
    owner = sign_up(api, "loan-owner")
    stranger = sign_up(api, "loan-stranger")
    loan = data(api.post(LOANS, headers=owner, json=_phone_emi()))
    assert api.get(f"{LOANS}/{loan['id']}/schedule", headers=stranger).status_code == 404
    assert api.post(f"{LOANS}/{loan['id']}/close", headers=stranger).status_code == 404
    closed = data(api.post(f"{LOANS}/{loan['id']}/close", headers=owner))
    assert closed["status"] == "closed"
    assert data(api.get(LOANS, headers=owner)) == []
    assert data(api.get(f"{API}/recurring-rules", headers=owner)) == []
