from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import CurrentUser, get_current_user
from ..db.session import get_db
from ..models import Account, Transaction
from ..schemas import AccountCreate, AccountRead
from ..utils.validation.json_validator import ApiResponse, JsonResponse

router = APIRouter(prefix="/accounts", tags=["accounts"])


def account_payload(account: Account, transactions: list[Transaction]) -> dict:
    balance = account.opening_balance
    for transaction in transactions:
        if transaction.status == "voided":
            continue
        if transaction.source_account_id == account.id or (
            transaction.source_account_id is None and transaction.source == account.name
        ):
            balance -= transaction.amount
        if transaction.destination_account_id == account.id or (
            transaction.destination_account_id is None and transaction.destination == account.name
        ):
            balance += transaction.amount
    return {**{column.name: getattr(account, column.name) for column in Account.__table__.columns}, "current_balance": balance}


@router.get("", response_model=ApiResponse[list[AccountRead]])
def list_accounts(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    query = select(Account).where(Account.user_id == user.id, Account.archived.is_(False)).order_by(Account.created_at)
    accounts = list(db.scalars(query).all())
    transactions = list(db.scalars(select(Transaction).where(Transaction.user_id == user.id)).all())
    return JsonResponse.success("Accounts retrieved", [account_payload(account, transactions) for account in accounts])


@router.post("", response_model=ApiResponse[AccountRead], status_code=status.HTTP_201_CREATED)
def create_account(payload: AccountCreate, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    record = Account(user_id=user.id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return JsonResponse.success("Account created", account_payload(record, []), status.HTTP_201_CREATED)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_account(account_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    record = db.scalar(select(Account).where(Account.id == account_id, Account.user_id == user.id))
    if not record:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    record.archived = True
    db.commit()
