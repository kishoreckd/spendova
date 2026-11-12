"""Opt-in reminder producer. Deduplication receipt and outbox insertion commit together."""

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.db.models.account_model import Account
from app.db.models.budget_model import Budget
from app.db.models.loan_model import Loan
from app.db.models.preferences_model import Preferences, ReminderReceipt
from app.db.models.recurring_rule_model import RecurringRule
from app.db.models.transaction_model import Transaction
from app.db.models.user_model import User
from app.db.session import SessionLocal
from app.services import email_outbox_service as outbox
from app.services import email_templates, loans_service
from app.services.email_templates import EmailContent

logger = logging.getLogger("spendova.reminders")


def stage(days: int) -> str | None:
    if days == 7:
        return "7-days"
    if days == 1:
        return "tomorrow"
    if days == 0:
        return "today"
    if -30 <= days < 0:
        return "overdue"
    return None


def _enqueue(db, user, key, heading, detail, path, ttl=timedelta(days=1)) -> bool:
    if db.scalar(
        select(ReminderReceipt.id).where(ReminderReceipt.user_id == user.id, ReminderReceipt.event_key == key)
    ):
        return False
    try:
        with db.begin_nested():
            db.add(ReminderReceipt(user_id=user.id, event_key=key))
            content = EmailContent(
                subject=f"Spendova: {heading}",
                heading=heading,
                paragraphs=[detail],
                button=("Open Spendova", get_settings().app_url.rstrip("/") + path),
                footnote="Manage reminder emails in Spendova Settings.",
            )
            subject, text, html = email_templates.render(content)
            outbox.enqueue(db, user.email, subject, text, html, "reminder", ttl)
            db.flush()
    except IntegrityError:
        return False
    return True


def run_once(now: datetime | None = None) -> dict[str, int]:
    if not get_settings().reminders_enabled:
        return {"queued": 0}
    now = now or datetime.now(UTC)
    queued = 0
    with SessionLocal() as db:
        users = db.execute(
            select(User, Preferences)
            .join(Preferences, Preferences.user_id == User.id)
            .where(User.email_verified.is_(True))
        ).all()
        for user, prefs in users:
            try:
                today = now.astimezone(ZoneInfo(user.time_zone)).date()
            except (ZoneInfoNotFoundError, ValueError):
                today = now.astimezone(ZoneInfo("Asia/Kolkata")).date()
            if prefs.bills:
                rules = db.scalars(
                    select(RecurringRule).where(
                        RecurringRule.user_id == user.id,
                        RecurringRule.active.is_(True),
                        RecurringRule.kind.in_(["expense", "transfer"]),
                    )
                ).all()
                for rule in rules:
                    due_stage = stage((rule.next_due_on - today).days)
                    if due_stage:
                        queued += _enqueue(
                            db,
                            user,
                            f"bill:{rule.id}:{rule.next_due_on}:{due_stage}",
                            "Payment reminder",
                            f"A bill or planned contribution is due {rule.next_due_on} ({due_stage}).",
                            "/plan",
                        )
                loans = db.scalars(
                    select(Loan).where(
                        Loan.user_id == user.id, Loan.status == "active", Loan.recurring_rule_id.is_(None)
                    )
                ).all()
                for loan in loans:
                    read, _ = loans_service.read_loan(db, user.id, loan.id)
                    due = read.summary.next_due_on
                    due_stage = stage((due - today).days) if due else None
                    if due_stage:
                        queued += _enqueue(
                            db,
                            user,
                            f"loan:{loan.id}:{due}:{due_stage}",
                            "EMI reminder",
                            f"A loan instalment is due {due} ({due_stage}).",
                            "/loans",
                        )
            if prefs.deposits:
                accounts = db.scalars(
                    select(Account).where(
                        Account.user_id == user.id,
                        Account.archived.is_(False),
                        Account.account_type.in_(["fixed_deposit", "recurring_deposit"]),
                        Account.maturity_on.is_not(None),
                    )
                ).all()
                for account in accounts:
                    due = account.maturity_on
                    if due is None:
                        continue
                    due_stage = stage((due - today).days)
                    if due_stage:
                        queued += _enqueue(
                            db,
                            user,
                            f"deposit:{account.id}:{due}:{due_stage}",
                            "Deposit maturity reminder",
                            f"An FD or RD matures on {due} ({due_stage}).",
                            "/accounts",
                        )
            if prefs.budgets:
                month = today.replace(day=1)
                budget = db.scalar(select(Budget).where(Budget.user_id == user.id, Budget.month == month))
                if budget:
                    spent = Decimal(
                        db.scalar(
                            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                                Transaction.user_id == user.id,
                                Transaction.currency == user.base_currency,
                                Transaction.kind == "expense",
                                Transaction.status == "cleared",
                                Transaction.occurred_on >= month,
                                Transaction.occurred_on <= today,
                            )
                        )
                        or 0
                    )
                    threshold = (
                        100
                        if spent >= budget.total_limit
                        else 80
                        if spent >= budget.total_limit * Decimal("0.8")
                        else 0
                    )
                    if threshold:
                        queued += _enqueue(
                            db,
                            user,
                            f"budget:{budget.id}:{threshold}",
                            "Budget alert",
                            f"Your monthly spending has reached the {threshold}% budget threshold.",
                            "/plan",
                        )
            if prefs.weekly and today.weekday() == 0:
                queued += _enqueue(
                    db,
                    user,
                    f"weekly:{today}",
                    "Your weekly money review",
                    "Review your spending, upcoming bills, deposits and savings goals for the week.",
                    "/reports",
                )
            db.commit()
    return {"queued": queued}


async def run_loop(stop: asyncio.Event):
    while not stop.is_set():
        try:
            await asyncio.to_thread(run_once)
        except Exception:
            logger.warning("Reminder scan failed; retrying on the next interval")
        try:
            await asyncio.wait_for(stop.wait(), timeout=get_settings().reminder_poll_seconds)
        except TimeoutError:
            pass
