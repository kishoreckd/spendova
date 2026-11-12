from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
import requests
from sqlalchemy import select

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.finance import deposit_projection
from app.db.models.email_outbox_model import EmailOutbox
from app.db.models.preferences_model import AiCharge, AiDay
from app.db.models.user_model import User
from app.db.session import SessionLocal
from app.services import ai_quota_service as quota
from app.services import email_outbox_service, reminder_service
from tests.helpers import API, create_account, data, expense, sign_up

PREFS = {"daily_token_limit": 20000, "bills": False, "deposits": False, "budgets": False, "weekly": False}


def test_deposit_math_and_dates(api):
    fixed = deposit_projection("fixed_deposit", Decimal(10000), None, Decimal(12), 12)
    assert fixed is not None
    assert fixed["estimated_maturity"] == Decimal("11268.25")
    assert fixed["estimated_interest"] == Decimal("1268.25")
    recurring = deposit_projection("recurring_deposit", None, Decimal(1000), Decimal(0), 12)
    assert recurring is not None
    assert recurring["estimated_maturity"] == Decimal("12000")
    unknown = deposit_projection("fixed_deposit", Decimal(1000), None, None, 12)
    assert unknown is not None
    assert unknown["estimated_maturity"] is None
    headers = sign_up(api, "deposits-owner")
    account = create_account(
        api,
        headers,
        account_type="fixed_deposit",
        principal_amount="10000",
        annual_interest_rate="12",
        tenure_months=12,
        started_on="2026-01-31",
    )
    assert account["maturity_on"] == "2027-01-31"
    assert account["deposit_projection"]["estimated_maturity"] == "11268.25"
    response = api.post(
        f"{API}/accounts",
        headers=headers,
        json={
            "name": "bad",
            "account_type": "fixed_deposit",
            "principal_amount": "100",
            "tenure_months": 12,
            "started_on": "2026-01-31",
            "maturity_on": "2026-01-01",
        },
    )
    assert response.status_code == 400
    assert data(api.get(f"{API}/insights/snapshot", headers=headers))["deposits"][0]["type"] == "fixed_deposit"


def test_preferences_isolation_and_limits(api, monkeypatch):
    owner = sign_up(api, "preferences-owner")
    other = sign_up(api, "preferences-other")
    assert data(api.get(f"{API}/preferences", headers=owner))["bills"] is False
    monkeypatch.setattr(get_settings(), "finance_assistant_max_daily_tokens", 30000)
    saved = data(
        api.put(f"{API}/preferences", headers=owner, json={**PREFS, "bills": True, "daily_token_limit": 15000})
    )
    assert saved["bills"] is True
    assert saved["daily_token_limit"] == 15000
    assert data(api.get(f"{API}/preferences", headers=other))["bills"] is False
    assert api.put(f"{API}/preferences", headers=owner, json={**PREFS, "daily_token_limit": 30001}).status_code == 400
    assert api.put(f"{API}/preferences", headers=owner, json={**PREFS, "daily_token_limit": -1}).status_code == 400


def test_quota_day_boundary_and_idempotent_settlement(api):
    sign_up(api, "quota-owner")
    before = datetime(2026, 11, 5, 18, 29, tzinfo=UTC)
    after = datetime(2026, 11, 5, 18, 30, tzinfo=UTC)
    assert quota.period(before)[0] == date(2026, 11, 5)
    assert quota.period(after)[0] == date(2026, 11, 6)
    charge = quota.reserve("quota-owner", 19000, before)
    with pytest.raises(AppError) as error:
        quota.reserve("quota-owner", 1001, before)
    assert error.value.code == "AI_DAILY_LIMIT"
    quota.settle(charge, 200)
    quota.settle(charge, 200)
    with SessionLocal() as db:
        assert db.get_one(AiDay, ("quota-owner", date(2026, 11, 5))).charged_tokens == 200
    quota.reserve("quota-owner", 19000, after)


def test_concurrent_reservations_do_not_exceed_allowance(api, monkeypatch):
    sign_up(api, "concurrent-owner")
    monkeypatch.setattr(get_settings(), "finance_assistant_daily_token_limit", 1000)

    def attempt(_):
        try:
            quota.reserve("concurrent-owner", 700)
            return True
        except AppError:
            return False

    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(attempt, range(4)))
    assert sum(results) == 1


def test_zero_allowance_blocks_network_but_local_works(api, monkeypatch):
    headers = sign_up(api, "paused-ai")
    api.put(f"{API}/preferences", headers=headers, json={**PREFS, "daily_token_limit": 0})
    monkeypatch.setattr(get_settings(), "openai_api_key", "test-placeholder")

    def forbidden(*args, **kwargs):
        pytest.fail("Exhausted allowance must prevent provider calls")

    monkeypatch.setattr(requests, "post", forbidden)
    assert (
        api.post(f"{API}/insights/chat", headers=headers, json={"question": "Help", "use_ai": True}).status_code == 429
    )
    assert data(api.post(f"{API}/insights/chat", headers=headers, json={"question": "Help"}))["mode"] == "local"
    assert data(api.get(f"{API}/preferences", headers=headers))["tokens_used"] == 0


def test_actual_usage_and_limit_change_does_not_clear_spend(api, monkeypatch):
    headers = sign_up(api, "metered-ai")
    monkeypatch.setattr(get_settings(), "openai_api_key", "test-placeholder")

    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "status": "completed",
                "usage": {"total_tokens": 123},
                "output": [{"type": "message", "content": [{"type": "output_text", "text": "Record your income."}]}],
            }

    monkeypatch.setattr(requests, "post", lambda *args, **kwargs: Response())
    assert (
        api.post(f"{API}/insights/chat", headers=headers, json={"question": "Help", "use_ai": True}).status_code == 200
    )
    assert data(api.get(f"{API}/preferences", headers=headers))["tokens_used"] == 123
    api.put(f"{API}/preferences", headers=headers, json={**PREFS, "daily_token_limit": 0})
    usage = data(api.get(f"{API}/preferences", headers=headers))
    assert usage["tokens_used"] == 123
    assert usage["tokens_remaining"] == 0


def test_unknown_usage_retains_reservation(api):
    sign_up(api, "unknown-charge")
    charge = quota.reserve("unknown-charge", 1000)
    quota.settle(charge, None)
    with SessionLocal() as db:
        assert db.get_one(AiCharge, charge).settled is False
        assert db.get_one(AiDay, ("unknown-charge", quota.period()[0])).charged_tokens == 1000


def test_reminders_opt_in_dedup_and_delivery(api, monkeypatch, mailbox):
    monkeypatch.setattr(get_settings(), "reminders_enabled", True)
    headers = sign_up(api, "reminder-owner")
    create_account(
        api,
        headers,
        account_type="fixed_deposit",
        principal_amount="10000",
        annual_interest_rate="6",
        tenure_months=1,
        started_on="2026-10-05",
    )
    response = api.post(
        f"{API}/recurring-rules",
        headers=headers,
        json={
            "name": "Rent",
            "kind": "expense",
            "amount": "5000",
            "frequency": "monthly",
            "next_due_on": "2026-11-05",
            "source": "Bank",
            "destination": "Rent",
        },
    )
    assert response.status_code == 201
    with SessionLocal() as db:
        db.get_one(User, "reminder-owner").email_verified = True
        db.commit()
    now = datetime(2026, 11, 5, 12, tzinfo=UTC)
    assert reminder_service.run_once(now)["queued"] == 0
    api.put(f"{API}/preferences", headers=headers, json={**PREFS, "bills": True, "deposits": True})
    assert reminder_service.run_once(now)["queued"] == 2
    assert reminder_service.run_once(now)["queued"] == 0
    with SessionLocal() as db:
        rows = list(db.scalars(select(EmailOutbox).where(EmailOutbox.category == "reminder")))
        assert len(rows) == 2
        assert all(row.payload_enc and "Rent" not in row.payload_enc for row in rows)
        ids = [row.id for row in rows]
    for ident in ids:
        email_outbox_service.deliver(ident)
    assert len(mailbox) == 2
    assert all("10000" not in item[2] and "5000" not in item[2] for item in mailbox)
    api.put(f"{API}/preferences", headers=headers, json=PREFS)
    assert reminder_service.run_once(datetime(2026, 11, 6, 12, tzinfo=UTC))["queued"] == 0


def test_budget_and_weekly_preferences_are_working(api, monkeypatch):
    monkeypatch.setattr(get_settings(), "reminders_enabled", True)
    headers = sign_up(api, "budget-reminders")
    with SessionLocal() as db:
        db.get_one(User, "budget-reminders").email_verified = True
        db.commit()
    api.post(f"{API}/budgets", headers=headers, json={"name": "November", "month": "2026-11-01", "total_limit": "1000"})
    expense(api, headers, "budget-spending", amount="850", occurred_on="2026-11-02")
    api.put(f"{API}/preferences", headers=headers, json={**PREFS, "budgets": True, "weekly": True})
    assert reminder_service.run_once(datetime(2026, 11, 2, 12, tzinfo=UTC))["queued"] == 2
    assert reminder_service.run_once(datetime(2026, 11, 2, 12, tzinfo=UTC))["queued"] == 0


def test_deposit_agent_tool_is_metered_and_server_calculated(api, monkeypatch):
    import json

    headers = sign_up(api, "deposit-agent")
    monkeypatch.setattr(get_settings(), "openai_api_key", "test-placeholder")
    calls = []

    def provider(url, **kwargs):
        calls.append(kwargs["json"])
        if len(calls) == 1:
            result = {
                "status": "completed",
                "usage": {"total_tokens": 100},
                "output": [
                    {
                        "type": "function_call",
                        "name": "project_deposit",
                        "call_id": "deposit-1",
                        "arguments": json.dumps(
                            {"kind": "recurring_deposit", "amount": "1000", "months": 12, "annual_rate": "0"}
                        ),
                    }
                ],
            }
        else:
            output = json.loads(kwargs["json"]["input"][-1]["output"])
            assert output["estimated_maturity"] == "12000.00"
            result = {
                "status": "completed",
                "usage": {"total_tokens": 100},
                "output": [
                    {
                        "type": "message",
                        "content": [{"type": "output_text", "text": "Estimated maturity INR 12000.00."}],
                    }
                ],
            }

        class Response:
            def raise_for_status(self):
                pass

            def json(self):
                return result

        return Response()

    monkeypatch.setattr(requests, "post", provider)
    result = data(
        api.post(
            f"{API}/insights/chat",
            headers=headers,
            json={"question": "RD 1000 per month for 12 months at 0% annual interest", "use_ai": True},
        )
    )
    assert result["calculation"]["kind"] == "deposit"
    assert result["calculation"]["estimated_maturity"] == "12000.00"
    assert data(api.get(f"{API}/preferences", headers=headers))["tokens_used"] == 200


@pytest.mark.parametrize("track", [True, False])
def test_loan_reminders_with_or_without_payment_tracking(api, monkeypatch, track):
    monkeypatch.setattr(get_settings(), "reminders_enabled", True)
    headers = sign_up(api, "loan-reminder")
    with SessionLocal() as db:
        db.get_one(User, "loan-reminder").email_verified = True
        db.commit()
    response = api.post(
        f"{API}/loans",
        headers=headers,
        json={
            "name": "Private loan name",
            "loan_type": "personal",
            "principal": "12000",
            "annual_interest_rate": "0",
            "tenure_months": 12,
            "first_due_on": "2026-11-05",
            "installments_paid_before": 0,
            "track_payments": track,
        },
    )
    assert response.status_code == 201, response.text
    api.put(f"{API}/preferences", headers=headers, json={**PREFS, "bills": True})
    assert reminder_service.run_once(datetime(2026, 11, 5, 12, tzinfo=UTC))["queued"] == 1
    assert reminder_service.run_once(datetime(2026, 11, 5, 12, tzinfo=UTC))["queued"] == 0
