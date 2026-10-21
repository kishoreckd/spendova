from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import CurrentUser, get_current_user
from ..db.session import get_db
from ..models import Budget, BudgetLine, Category, Transaction
from ..schemas import BudgetCreate, BudgetLineStatus, BudgetRead, BudgetStatus
from ..utils.validation.json_validator import ApiResponse, JsonResponse

router = APIRouter(prefix="/budgets", tags=["budgets"])


def find_budget(db: Session, budget_id: str, user_id: str) -> Budget:
    budget = db.scalar(select(Budget).where(Budget.id == budget_id, Budget.user_id == user_id))
    if not budget:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Budget not found")
    return budget


@router.get("", response_model=ApiResponse[list[BudgetRead]])
def list_budgets(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.scalars(select(Budget).where(Budget.user_id == user.id).order_by(Budget.month.desc())).all()
    return JsonResponse.success("Budgets retrieved", records)


@router.post("", response_model=ApiResponse[BudgetRead], status_code=status.HTTP_201_CREATED)
def create_budget(payload: BudgetCreate, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    month = payload.month.replace(day=1)
    category_ids = {line.category_id for line in payload.lines}
    owned_ids = set(db.scalars(select(Category.id).where(
        Category.user_id == user.id,
        Category.category_type == "expense",
        Category.id.in_(category_ids),
    )).all())
    if owned_ids != category_ids:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "One or more categories are invalid")
    record = Budget(user_id=user.id, name=payload.name, month=month, total_limit=payload.total_limit)
    record.lines = [BudgetLine(category_id=line.category_id, amount_limit=line.amount_limit) for line in payload.lines]
    db.add(record)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "A budget already exists for this month") from exc
    db.refresh(record)
    return JsonResponse.success("Budget created", record, status.HTTP_201_CREATED)


@router.get("/{budget_id}/status", response_model=ApiResponse[BudgetStatus])
def budget_status(budget_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    budget = find_budget(db, budget_id, user.id)
    start = budget.month
    end = date(start.year + (start.month == 12), 1 if start.month == 12 else start.month + 1, 1)
    period = (
        Transaction.user_id == user.id,
        Transaction.kind == "expense",
        Transaction.status == "cleared",
        Transaction.occurred_on >= start,
        Transaction.occurred_on < end,
    )
    spent = Decimal(db.scalar(select(func.coalesce(func.sum(Transaction.amount), 0)).where(*period)) or 0)
    by_category: dict[str | None, Decimal] = {
        category_id: Decimal(amount or 0)
        for category_id, amount in db.execute(
            select(Transaction.category_id, func.sum(Transaction.amount))
            .where(*period)
            .group_by(Transaction.category_id)
        ).tuples()
    }
    lines = [
        BudgetLineStatus(
            category_id=line.category_id,
            limit=line.amount_limit,
            spent=by_category.get(line.category_id, Decimal(0)),
            remaining=line.amount_limit - by_category.get(line.category_id, Decimal(0)),
        )
        for line in budget.lines
    ]
    return JsonResponse.success("Budget status retrieved", BudgetStatus(
        budget_id=budget.id,
        limit=budget.total_limit,
        spent=spent,
        remaining=budget.total_limit - spent,
        lines=lines,
    ))


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(budget_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    db.delete(find_budget(db, budget_id, user.id))
    db.commit()
