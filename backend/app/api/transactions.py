from datetime import date

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import CurrentUser, get_current_user
from ..db.session import get_db
from ..domain import assert_balanced, create_posting
from ..models import Category, LedgerEntry, Transaction
from ..schemas import TransactionCreate, TransactionRead
from ..utils.validation.json_validator import ApiResponse, JsonResponse

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=ApiResponse[list[TransactionRead]])
def list_transactions(
    from_date: date | None = None,
    to_date: date | None = None,
    category_id: str | None = None,
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

    posting = create_posting(payload.kind, payload.amount, payload.source, payload.destination)
    assert_balanced(posting)
    values = payload.model_dump()
    values["kind"] = payload.kind.value
    record = Transaction(user_id=user.id, **values, idempotency_key=idempotency_key)
    record.entries = [
        LedgerEntry(sequence=index, target=entry.target, side=entry.side.value, amount=entry.amount)
        for index, entry in enumerate(posting, 1)
    ]
    db.add(record)
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
