from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import CurrentUser, get_current_user
from ..db.session import get_db
from ..models import Category, Transaction
from ..utils.validation.json_validator import JsonResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard(
    year: int | None = None,
    month: int | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    year = year or today.year
    month = month or today.month
    start = date(year, month, 1)
    end = date(year + (month == 12), 1 if month == 12 else month + 1, 1)
    period_filter = (
        Transaction.user_id == user.id,
        Transaction.occurred_on >= start,
        Transaction.occurred_on < end,
        Transaction.status == "cleared",
    )
    total_rows = db.execute(
        select(Transaction.kind, func.coalesce(func.sum(Transaction.amount), 0))
        .where(*period_filter)
        .group_by(Transaction.kind)
    ).tuples()
    totals: dict[str, Decimal] = {
        kind: Decimal(amount) for kind, amount in total_rows
    }
    income = Decimal(totals.get("income", 0))
    spending = Decimal(totals.get("expense", 0))
    category_rows = db.execute(
        select(Category.id, Category.name, Category.color, func.sum(Transaction.amount).label("amount"))
        .join(Transaction, Transaction.category_id == Category.id)
        .where(*period_filter, Transaction.kind == "expense")
        .group_by(Category.id, Category.name, Category.color)
        .order_by(func.sum(Transaction.amount).desc())
    ).all()
    return JsonResponse.success("Dashboard summary retrieved", {
        "period": {"year": year, "month": month},
        "income": income,
        "spending": spending,
        "cash_flow": income - spending,
        "transaction_count": db.scalar(select(func.count(Transaction.id)).where(*period_filter)),
        "categories": [
            {"id": row.id, "name": row.name, "color": row.color, "amount": row.amount}
            for row in category_rows
        ],
    })
