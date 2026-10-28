from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.constants.finance import TRANSACTION_STATUS_CLEARED
from app.core.errors import AppError
from app.db.models.budget_line_model import BudgetLine
from app.db.models.budget_model import Budget
from app.db.models.category_model import Category
from app.db.models.transaction_model import Transaction
from app.schemas.budgets import BudgetCreate, BudgetLineStatus, BudgetStatus


def month_bounds(month_start: date) -> tuple[date, date]:
    end = date(month_start.year + (month_start.month == 12), 1 if month_start.month == 12 else month_start.month + 1, 1)
    return month_start, end


def list_budgets(db: Session, user_id: str) -> list[Budget]:
    return list(db.scalars(select(Budget).where(Budget.user_id == user_id).order_by(Budget.month.desc())).all())


def get_owned_budget(db: Session, user_id: str, budget_id: str) -> Budget:
    budget = db.scalar(select(Budget).where(Budget.id == budget_id, Budget.user_id == user_id))
    if not budget:
        raise AppError.not_found("Budget not found")
    return budget


def create_budget(db: Session, user_id: str, payload: BudgetCreate) -> Budget:
    category_ids = {line.category_id for line in payload.lines}
    owned = set(
        db.scalars(
            select(Category.id).where(
                Category.user_id == user_id, Category.category_type == "expense", Category.id.in_(category_ids)
            )
        ).all()
    )
    if owned != category_ids:
        raise AppError.bad_request("One or more categories are invalid")
    budget = Budget(
        user_id=user_id, name=payload.name, month=payload.month.replace(day=1), total_limit=payload.total_limit
    )
    budget.lines = [BudgetLine(category_id=line.category_id, amount_limit=line.amount_limit) for line in payload.lines]
    try:
        with db.begin_nested():
            db.add(budget)
    except IntegrityError:
        raise AppError.conflict("A budget already exists for this month") from None
    return budget


def budget_status(db: Session, user_id: str, budget_id: str) -> BudgetStatus:
    budget = get_owned_budget(db, user_id, budget_id)
    start, end = month_bounds(budget.month)
    period = (
        Transaction.user_id == user_id,
        Transaction.kind == "expense",
        Transaction.status == TRANSACTION_STATUS_CLEARED,
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
    return BudgetStatus(
        budget_id=budget.id, limit=budget.total_limit, spent=spent, remaining=budget.total_limit - spent, lines=lines
    )


def delete_budget(db: Session, user_id: str, budget_id: str) -> Budget:
    budget = get_owned_budget(db, user_id, budget_id)
    db.delete(budget)
    return budget
