from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants.finance import KIND_PLAN, PLAN_KIND
from app.core.errors import AppError
from app.core.finance import TransactionType
from app.db.models.recurring_rule_model import RecurringRule
from app.db.models.transaction_model import Transaction
from app.schemas.recurring import RecurringPaymentCreate, RecurringRuleCreate
from app.services import accounts_service, categories_service
from app.services.recurring_schedule import next_due
from app.services.transactions_service import find_by_idempotency_key, ledger_entries


def list_rules(db: Session, user_id: str) -> list[RecurringRule]:
    return list(
        db.scalars(
            select(RecurringRule)
            .where(RecurringRule.user_id == user_id, RecurringRule.active.is_(True))
            .order_by(RecurringRule.next_due_on)
        ).all()
    )


def get_active_rule(db: Session, user_id: str, rule_id: str) -> RecurringRule:
    rule = db.scalar(
        select(RecurringRule).where(
            RecurringRule.id == rule_id, RecurringRule.user_id == user_id, RecurringRule.active.is_(True)
        )
    )
    if not rule:
        raise AppError.not_found("Commitment not found")
    return rule


def create_rule(db: Session, user_id: str, payload: RecurringRuleCreate) -> RecurringRule:
    kind = payload.kind.value
    plan_type = payload.plan_type or KIND_PLAN[kind]
    if kind != PLAN_KIND[plan_type]:
        raise AppError.bad_request("Commitment type does not match its transaction type")
    if plan_type != "income" and payload.cost_amount is not None:
        raise AppError.bad_request("Costs apply only to an income plan")
    if plan_type != "investment" and (payload.annual_return_rate is not None or payload.tenure_months is not None):
        raise AppError.bad_request("Return and tenure apply only to an investment plan")
    if plan_type == "investment" and payload.plan_type is not None and payload.tenure_months is None:
        raise AppError.bad_request("Investment tenure is required")
    if payload.source == payload.destination:
        raise AppError.bad_request("Source and destination must differ")
    if payload.category_id:
        categories_service.require_category(
            db, user_id, payload.category_id, kind, "Category type does not match this commitment"
        )
    account_ids = [value for value in (payload.source_account_id, payload.destination_account_id) if value]
    accounts = accounts_service.owned_accounts(db, user_id, account_ids)
    currencies = {account.currency for account in accounts.values()}
    if payload.kind == TransactionType.TRANSFER and len(currencies) > 1:
        raise AppError.bad_request("Investment transfers must use the same currency")
    if currencies and currencies != {payload.currency}:
        raise AppError.bad_request("Commitment currency must match the selected account")

    values = payload.model_dump()
    values.update(kind=kind, plan_type=plan_type)
    if payload.source_account_id:
        values["source"] = accounts[payload.source_account_id].name
    if payload.destination_account_id:
        values["destination"] = accounts[payload.destination_account_id].name
    rule = RecurringRule(user_id=user_id, **values)
    db.add(rule)
    db.flush()
    return rule


def pay_rule(
    db: Session, user_id: str, rule_id: str, payload: RecurringPaymentCreate, idempotency_key: str
) -> tuple[RecurringRule, Transaction, bool]:
    """Posts the payment and schedules the next due date. Returns (rule, transaction, created)."""
    rule = get_active_rule(db, user_id, rule_id)
    if payload.paid_on > date.today():
        raise AppError.bad_request("Payment date cannot be in the future")
    existing = find_by_idempotency_key(db, user_id, idempotency_key)
    if existing:
        return rule, existing, False

    amount = payload.amount or rule.amount
    transaction = Transaction(
        user_id=user_id,
        kind=rule.kind,
        amount=amount,
        currency=rule.currency,
        source=rule.source,
        destination=rule.destination,
        source_account_id=rule.source_account_id,
        destination_account_id=rule.destination_account_id,
        merchant=rule.name,
        occurred_on=payload.paid_on,
        category_id=rule.category_id,
        recurring_rule_id=rule.id,
        notes="Created from recurring commitment",
        idempotency_key=idempotency_key,
    )
    transaction.entries = ledger_entries(TransactionType(rule.kind), amount, rule.source, rule.destination)
    db.add(transaction)
    rule.amount = amount
    rule.next_due_on = next_due(rule.next_due_on, rule.frequency, rule.interval)
    db.flush()
    return rule, transaction, True


def stop_rule(db: Session, user_id: str, rule_id: str) -> RecurringRule:
    rule = db.scalar(select(RecurringRule).where(RecurringRule.id == rule_id, RecurringRule.user_id == user_id))
    if not rule:
        raise AppError.not_found("Recurring rule not found")
    rule.active = False
    return rule
