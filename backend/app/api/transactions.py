from datetime import date

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from ..auth import CurrentUser, get_current_user
from ..db.session import get_db
from ..domain import assert_balanced, create_posting
from ..models import Account, Category, LedgerEntry, RecurringRule, Transaction
from .recurring import next_due
from ..schemas import TransactionCreate, TransactionRead
from ..utils.validation.json_validator import ApiResponse, JsonResponse

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=ApiResponse[list[TransactionRead]])
def list_transactions(
    from_date: date | None = None,
    to_date: date | None = None,
    category_id: str | None = None,
    account_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = select(Transaction).where(Transaction.user_id == user.id)
    if from_date:
        query = query.where(Transaction.occurred_on >= from_date)
    if to_date:
        query = query.where(Transaction.occurred_on <= to_date)
    if category_id:
        query = query.where(Transaction.category_id == category_id)
    if account_id:
        selected_account = db.scalar(
            select(Account).where(
                Account.id == account_id,
                Account.user_id == user.id,
                Account.archived.is_(False),
            )
        )
        if not selected_account:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
        query = query.where(
            or_(
                Transaction.source_account_id == selected_account.id,
                Transaction.destination_account_id == selected_account.id,
                and_(Transaction.source_account_id.is_(None), Transaction.source == selected_account.name),
                and_(Transaction.destination_account_id.is_(None), Transaction.destination == selected_account.name),
            )
        )
    query = query.order_by(Transaction.occurred_on.desc(), Transaction.created_at.desc()).offset(offset).limit(limit)
    return JsonResponse.success("Transactions retrieved", db.scalars(query).all())


@router.post("", response_model=ApiResponse[TransactionRead], status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: TransactionCreate,
    idempotency_key: str = Header(min_length=8, max_length=100),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.scalar(select(Transaction).where(
        Transaction.user_id == user.id,
        Transaction.idempotency_key == idempotency_key,
    ))
    if existing:
        return JsonResponse.success("Existing transaction returned", existing)
    if payload.category_id:
        category = db.scalar(select(Category).where(Category.id == payload.category_id, Category.user_id == user.id))
        if not category:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Category does not belong to this user")
        if category.category_type != payload.kind.value:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"An {payload.kind.value} transaction requires an {payload.kind.value} category",
            )

    recurring_rule = None
    if payload.recurring_rule_id:
        recurring_rule = db.scalar(select(RecurringRule).where(
            RecurringRule.id == payload.recurring_rule_id,
            RecurringRule.user_id == user.id,
            RecurringRule.active.is_(True),
        ))
        if not recurring_rule:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Linked commitment was not found")
        if recurring_rule.kind != payload.kind.value:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Transaction type does not match the linked commitment")
        if recurring_rule.currency != payload.currency:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Transaction currency does not match the linked commitment")
        if (
            recurring_rule.source_account_id and recurring_rule.source_account_id != payload.source_account_id
        ) or (
            recurring_rule.destination_account_id and recurring_rule.destination_account_id != payload.destination_account_id
        ):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Accounts do not match the linked commitment")

    account_ids = [value for value in (payload.source_account_id, payload.destination_account_id) if value]
    accounts = list(db.scalars(select(Account).where(
        Account.user_id == user.id,
        Account.id.in_(account_ids),
        Account.archived.is_(False),
    )).all()) if account_ids else []
    if len(accounts) != len(set(account_ids)):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "An account does not belong to this user")
    by_id = {account.id: account for account in accounts}
    source_name = by_id[payload.source_account_id].name if payload.source_account_id else payload.source
    destination_name = by_id[payload.destination_account_id].name if payload.destination_account_id else payload.destination
    if payload.kind.value == "transfer" and len(accounts) == 2 and accounts[0].currency != accounts[1].currency:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Cross-currency transfers require exchange-rate support",
        )
    if accounts and any(account.currency != payload.currency for account in accounts):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Transaction currency must match the selected account currency",
        )

    try:
        posting = create_posting(payload.kind, payload.amount, source_name, destination_name)
        assert_balanced(posting)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    values = payload.model_dump()
    values["kind"] = payload.kind.value
    values["source"] = source_name
    values["destination"] = destination_name
    record = Transaction(user_id=user.id, **values, idempotency_key=idempotency_key)
    record.entries = [
        LedgerEntry(sequence=index, target=entry.target, side=entry.side.value, amount=entry.amount)
        for index, entry in enumerate(posting, 1)
    ]
    db.add(record)
    if recurring_rule:
        recurring_rule.amount = payload.amount
        recurring_rule.next_due_on = next_due(
            recurring_rule.next_due_on,
            recurring_rule.frequency,
            recurring_rule.interval,
        )
    db.commit()
    db.refresh(record)
    return JsonResponse.success("Transaction created", record, status.HTTP_201_CREATED)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def void_transaction(transaction_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    record = db.scalar(select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == user.id))
    if not record:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transaction not found")
    if record.status == "voided":
        return
    record.status = "voided"
    db.commit()
