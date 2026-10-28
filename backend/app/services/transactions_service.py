from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.constants.finance import TRANSACTION_STATUS_VOIDED
from app.core.errors import AppError
from app.core.finance import TransactionType, assert_balanced, create_posting
from app.db.models.ledger_entry_model import LedgerEntry
from app.db.models.recurring_rule_model import RecurringRule
from app.db.models.transaction_model import Transaction
from app.schemas.transactions import TransactionCreate
from app.services import accounts_service, categories_service
from app.services.recurring_schedule import next_due


@dataclass(frozen=True)
class TransactionFilters:
    from_date: date | None = None
    to_date: date | None = None
    category_id: str | None = None
    account_id: str | None = None
    limit: int = 100
    offset: int = 0


def ledger_entries(kind: TransactionType, amount: Decimal, source: str, destination: str) -> list[LedgerEntry]:
    """Balanced double-entry lines for one money movement."""
    try:
        posting = create_posting(kind, amount, source, destination)
        assert_balanced(posting)
    except ValueError as exc:
        raise AppError.bad_request(str(exc)) from exc
    return [
        LedgerEntry(sequence=index, target=entry.target, side=entry.side.value, amount=entry.amount)
        for index, entry in enumerate(posting, 1)
    ]


def find_by_idempotency_key(db: Session, user_id: str, key: str) -> Transaction | None:
    return db.scalar(select(Transaction).where(Transaction.user_id == user_id, Transaction.idempotency_key == key))


def list_transactions(db: Session, user_id: str, filters: TransactionFilters) -> list[Transaction]:
    query = select(Transaction).where(Transaction.user_id == user_id)
    if filters.from_date:
        query = query.where(Transaction.occurred_on >= filters.from_date)
    if filters.to_date:
        query = query.where(Transaction.occurred_on <= filters.to_date)
    if filters.category_id:
        query = query.where(Transaction.category_id == filters.category_id)
    if filters.account_id:
        account = accounts_service.get_active_account(db, user_id, filters.account_id)
        query = query.where(accounts_service.touches_account(account))
    query = (
        query.order_by(Transaction.occurred_on.desc(), Transaction.created_at.desc())
        .offset(filters.offset)
        .limit(filters.limit)
    )
    return list(db.scalars(query).all())


def _linked_commitment(db: Session, user_id: str, payload: TransactionCreate) -> RecurringRule | None:
    if not payload.recurring_rule_id:
        return None
    rule = db.scalar(
        select(RecurringRule).where(
            RecurringRule.id == payload.recurring_rule_id,
            RecurringRule.user_id == user_id,
            RecurringRule.active.is_(True),
        )
    )
    if not rule:
        raise AppError.bad_request("Linked commitment was not found")
    if rule.kind != payload.kind.value:
        raise AppError.bad_request("Transaction type does not match the linked commitment")
    if rule.currency != payload.currency:
        raise AppError.bad_request("Transaction currency does not match the linked commitment")
    if (rule.source_account_id and rule.source_account_id != payload.source_account_id) or (
        rule.destination_account_id and rule.destination_account_id != payload.destination_account_id
    ):
        raise AppError.bad_request("Accounts do not match the linked commitment")
    return rule


def create_transaction(
    db: Session, user_id: str, payload: TransactionCreate, idempotency_key: str
) -> tuple[Transaction, bool]:
    """Returns (transaction, created). A repeated idempotency key returns the original."""
    existing = find_by_idempotency_key(db, user_id, idempotency_key)
    if existing:
        return existing, False
    if payload.category_id:
        kind = payload.kind.value
        categories_service.require_category(
            db, user_id, payload.category_id, kind, f"An {kind} transaction requires an {kind} category"
        )
    rule = _linked_commitment(db, user_id, payload)

    account_ids = [value for value in (payload.source_account_id, payload.destination_account_id) if value]
    accounts = accounts_service.owned_accounts(db, user_id, account_ids)
    source = accounts[payload.source_account_id].name if payload.source_account_id else payload.source
    destination = (
        accounts[payload.destination_account_id].name if payload.destination_account_id else payload.destination
    )
    currencies = {account.currency for account in accounts.values()}
    if payload.kind == TransactionType.TRANSFER and len(currencies) > 1:
        raise AppError.bad_request("Cross-currency transfers require exchange-rate support")
    if currencies and currencies != {payload.currency}:
        raise AppError.bad_request("Transaction currency must match the selected account currency")

    values = payload.model_dump()
    values.update(kind=payload.kind.value, source=source, destination=destination)
    transaction = Transaction(user_id=user_id, **values, idempotency_key=idempotency_key)
    transaction.entries = ledger_entries(payload.kind, payload.amount, source, destination)
    try:
        with db.begin_nested():
            db.add(transaction)
    except IntegrityError:
        # A concurrent request with the same key won; return its transaction.
        winner = find_by_idempotency_key(db, user_id, idempotency_key)
        if winner is None:
            raise
        return winner, False
    if rule:
        rule.amount = payload.amount
        rule.next_due_on = next_due(rule.next_due_on, rule.frequency, rule.interval)
    return transaction, True


def void_transaction(db: Session, user_id: str, transaction_id: str) -> tuple[Transaction, bool]:
    """Returns (transaction, changed)."""
    transaction = db.scalar(select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == user_id))
    if not transaction:
        raise AppError.not_found("Transaction not found")
    if transaction.status == TRANSACTION_STATUS_VOIDED:
        return transaction, False
    transaction.status = TRANSACTION_STATUS_VOIDED
    return transaction, True
