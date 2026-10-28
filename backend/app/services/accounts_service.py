from decimal import Decimal

from sqlalchemy import ColumnElement, and_, or_, select
from sqlalchemy.orm import Session

from app.constants.finance import TRANSACTION_STATUS_VOIDED
from app.core.errors import AppError
from app.db.models.account_model import Account
from app.db.models.transaction_model import Transaction
from app.schemas.accounts import AccountCreate, AccountRead


def current_balance(account: Account, transactions: list[Transaction]) -> Decimal:
    """Opening balance plus every non-voided transaction that moved money in or out."""
    balance = account.opening_balance
    for transaction in transactions:
        if transaction.status == TRANSACTION_STATUS_VOIDED:
            continue
        if transaction.source_account_id == account.id or (
            transaction.source_account_id is None and transaction.source == account.name
        ):
            balance -= transaction.amount
        if transaction.destination_account_id == account.id or (
            transaction.destination_account_id is None and transaction.destination == account.name
        ):
            balance += transaction.amount
    return balance


def to_read(account: Account, transactions: list[Transaction]) -> AccountRead:
    values = {column.name: getattr(account, column.name) for column in Account.__table__.columns}
    return AccountRead.model_validate({**values, "current_balance": current_balance(account, transactions)})


def touches_account(account: Account) -> ColumnElement[bool]:
    """Transactions that reference the account by id, or by name for older records."""
    return or_(
        Transaction.source_account_id == account.id,
        Transaction.destination_account_id == account.id,
        and_(Transaction.source_account_id.is_(None), Transaction.source == account.name),
        and_(Transaction.destination_account_id.is_(None), Transaction.destination == account.name),
    )


def list_accounts(db: Session, user_id: str) -> list[AccountRead]:
    accounts = db.scalars(
        select(Account).where(Account.user_id == user_id, Account.archived.is_(False)).order_by(Account.created_at)
    ).all()
    transactions = list(db.scalars(select(Transaction).where(Transaction.user_id == user_id)).all())
    return [to_read(account, transactions) for account in accounts]


def get_active_account(db: Session, user_id: str, account_id: str) -> Account:
    account = db.scalar(
        select(Account).where(Account.id == account_id, Account.user_id == user_id, Account.archived.is_(False))
    )
    if not account:
        raise AppError.not_found("Account not found")
    return account


def owned_accounts(db: Session, user_id: str, account_ids: list[str]) -> dict[str, Account]:
    """Active accounts by id; every requested id must belong to the user."""
    if not account_ids:
        return {}
    accounts = db.scalars(
        select(Account).where(Account.user_id == user_id, Account.id.in_(account_ids), Account.archived.is_(False))
    ).all()
    if len(accounts) != len(set(account_ids)):
        raise AppError.bad_request("An account does not belong to this user")
    return {account.id: account for account in accounts}


def create_account(db: Session, user_id: str, payload: AccountCreate) -> Account:
    account = Account(user_id=user_id, **payload.model_dump())
    db.add(account)
    db.flush()
    return account


def archive_account(db: Session, user_id: str, account_id: str) -> Account:
    account = db.scalar(select(Account).where(Account.id == account_id, Account.user_id == user_id))
    if not account:
        raise AppError.not_found("Account not found")
    account.archived = True
    return account
