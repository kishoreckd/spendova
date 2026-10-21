from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from ..auth import CurrentUser, get_current_user
from ..db.session import get_db
from ..models import Account, Category, Transaction
from ..utils.validation.json_validator import JsonResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard(
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    account_id: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    year = year or today.year
    month = month or today.month
    start = date(year, month, 1)
    end = date(year + (month == 12), 1 if month == 12 else month + 1, 1)
    period_filter = [
        Transaction.user_id == user.id,
        Transaction.occurred_on >= start,
        Transaction.occurred_on < end,
        Transaction.status == "cleared",
    ]
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
        period_filter.append(
            or_(
                Transaction.source_account_id == selected_account.id,
                Transaction.destination_account_id == selected_account.id,
                and_(Transaction.source_account_id.is_(None), Transaction.source == selected_account.name),
                and_(Transaction.destination_account_id.is_(None), Transaction.destination == selected_account.name),
            )
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
