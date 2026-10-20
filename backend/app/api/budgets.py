from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import CurrentUser, get_current_user
from ..db.session import get_db
from ..models import Budget, BudgetLine, Category, Transaction
from ..schemas import BudgetCreate, BudgetRead
from ..utils.validation.json_validator import ApiResponse, JsonResponse

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("", response_model=ApiResponse[list[BudgetRead]])
def list_budgets(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.scalars(select(Budget).where(Budget.user_id == user.id).order_by(Budget.month.desc())).all()
    return JsonResponse.success("Budgets retrieved", records)


@router.post("", response_model=ApiResponse[BudgetRead], status_code=status.HTTP_201_CREATED)
def create_budget(payload: BudgetCreate, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    month = payload.month.replace(day=1)
    category_ids = {line.category_id for line in payload.lines}
    owned_ids = set(db.scalars(select(Category.id).where(Category.user_id == user.id, Category.id.in_(category_ids))).all())
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


@router.get("/{budget_id}/status")
def budget_status(budget_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    budget = db.scalar(select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id))
    if not budget:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Budget not found")
    start = budget.month
    end = date(start.year + (start.month == 12), 1 if start.month == 12 else start.month + 1, 1)
    spent_value = db.scalar(select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        Transaction.user_id == user.id, Transaction.kind == "expense", Transaction.status == "cleared",
        Transaction.occurred_on >= start, Transaction.occurred_on < end,
    ))
    spent = Decimal(spent_value or 0)
    return JsonResponse.success("Budget status retrieved", {"budget_id": budget.id, "limit": budget.total_limit, "spent": spent, "remaining": budget.total_limit - spent})
