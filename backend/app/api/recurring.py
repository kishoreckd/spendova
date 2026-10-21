from datetime import date, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import CurrentUser, get_current_user
from ..db.session import get_db
from ..domain import TransactionType, add_months, assert_balanced, create_posting
from ..models import Account, Category, LedgerEntry, RecurringRule, Transaction
from ..schemas import RecurringPaymentCreate, RecurringPaymentRead, RecurringRuleCreate, RecurringRuleRead
from ..utils.validation.json_validator import ApiResponse, JsonResponse

router = APIRouter(prefix="/recurring-rules", tags=["recurring money"])


def next_due(current: date, frequency: str, interval: int) -> date:
    if frequency == "daily":
        return current + timedelta(days=interval)
    if frequency == "weekly":
        return current + timedelta(weeks=interval)
    if frequency == "monthly":
        return add_months(current, interval)
    return add_months(current, interval * 12)


@router.get("", response_model=ApiResponse[list[RecurringRuleRead]])
def list_rules(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.scalars(select(RecurringRule).where(RecurringRule.user_id == user.id, RecurringRule.active.is_(True)).order_by(RecurringRule.next_due_on)).all()
    return JsonResponse.success("Recurring rules retrieved", records)


@router.post("", response_model=ApiResponse[RecurringRuleRead], status_code=status.HTTP_201_CREATED)
def create_rule(payload: RecurringRuleCreate, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    plan_type = payload.plan_type or {"expense": "bill", "income": "income", "transfer": "investment"}[payload.kind.value]
    expected_kind = {"bill": "expense", "income": "income", "investment": "transfer"}[plan_type]
    if payload.kind.value != expected_kind:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Commitment type does not match its transaction type")
    if plan_type != "income" and payload.cost_amount is not None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Costs apply only to an income plan")
    if plan_type != "investment" and (payload.annual_return_rate is not None or payload.tenure_months is not None):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Return and tenure apply only to an investment plan")
    if plan_type == "investment" and payload.plan_type is not None and payload.tenure_months is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Investment tenure is required")
    if payload.source == payload.destination:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Source and destination must differ")
    if payload.category_id:
        category = db.scalar(select(Category).where(Category.id == payload.category_id, Category.user_id == user.id))
        if not category:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Category does not belong to this user")
        if category.category_type != payload.kind.value:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Category type does not match this commitment")
    account_ids = [value for value in (payload.source_account_id, payload.destination_account_id) if value]
    accounts = list(db.scalars(select(Account).where(
        Account.user_id == user.id,
        Account.id.in_(account_ids),
        Account.archived.is_(False),
    )).all()) if account_ids else []
    if len(accounts) != len(set(account_ids)):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "An account does not belong to this user")
    if payload.kind.value == "transfer" and len(accounts) == 2 and accounts[0].currency != accounts[1].currency:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Investment transfers must use the same currency")
    if accounts and any(account.currency != payload.currency for account in accounts):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Commitment currency must match the selected account")
    values = payload.model_dump()
    values["kind"] = payload.kind.value
    values["plan_type"] = plan_type
    by_id = {account.id: account for account in accounts}
    if payload.source_account_id:
        values["source"] = by_id[payload.source_account_id].name
    if payload.destination_account_id:
        values["destination"] = by_id[payload.destination_account_id].name
    record = RecurringRule(user_id=user.id, **values)
    db.add(record)
    db.commit()
    db.refresh(record)
    return JsonResponse.success("Recurring rule created", record, status.HTTP_201_CREATED)


@router.post("/{rule_id}/pay", response_model=ApiResponse[RecurringPaymentRead])
def pay_rule(
    rule_id: str,
    payload: RecurringPaymentCreate,
    idempotency_key: str = Header(min_length=8, max_length=100),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rule = db.scalar(select(RecurringRule).where(
        RecurringRule.id == rule_id,
        RecurringRule.user_id == user.id,
        RecurringRule.active.is_(True),
    ))
    if not rule:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commitment not found")
    if payload.paid_on > date.today():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Payment date cannot be in the future")

    existing = db.scalar(select(Transaction).where(
        Transaction.user_id == user.id,
        Transaction.idempotency_key == idempotency_key,
    ))
    if existing:
        return JsonResponse.success("Commitment was already paid", {
            "commitment": rule,
            "transaction": existing,
        })

    payment_amount = payload.amount or rule.amount
    posting = create_posting(TransactionType(rule.kind), payment_amount, rule.source, rule.destination)
    assert_balanced(posting)
    transaction = Transaction(
        user_id=user.id,
        kind=rule.kind,
        amount=payment_amount,
        currency=rule.currency,
        source=rule.source,
        destination=rule.destination,
        source_account_id=rule.source_account_id,
        destination_account_id=rule.destination_account_id,
        merchant=rule.name,
        occurred_on=payload.paid_on,
        category_id=rule.category_id,
        notes="Created from recurring commitment",
        idempotency_key=idempotency_key,
    )
    transaction.entries = [
        LedgerEntry(sequence=index, target=entry.target, side=entry.side.value, amount=entry.amount)
        for index, entry in enumerate(posting, 1)
    ]
    rule.amount = payment_amount
    rule.next_due_on = next_due(rule.next_due_on, rule.frequency, rule.interval)
    db.add(transaction)
    db.commit()
    db.refresh(rule)
    db.refresh(transaction)
    return JsonResponse.success("Payment recorded and next due date scheduled", {
        "commitment": rule,
        "transaction": transaction,
    })


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_rule(rule_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    record = db.scalar(select(RecurringRule).where(RecurringRule.id == rule_id, RecurringRule.user_id == user.id))
    if not record:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recurring rule not found")
    record.active = False
    db.commit()
