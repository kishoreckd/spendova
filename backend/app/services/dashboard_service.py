from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.constants.finance import TRANSACTION_STATUS_CLEARED
from app.db.models.category_model import Category
from app.db.models.transaction_model import Transaction
from app.schemas.dashboard import DashboardCategory, DashboardPeriod, DashboardSummary
from app.services import accounts_service
from app.services.budgets_service import month_bounds


def monthly_summary(
    db: Session, user_id: str, year: int | None, month: int | None, account_id: str | None
) -> DashboardSummary:
    today = date.today()
    year, month = year or today.year, month or today.month
    start, end = month_bounds(date(year, month, 1))
    period = [
        Transaction.user_id == user_id,
        Transaction.occurred_on >= start,
        Transaction.occurred_on < end,
        Transaction.status == TRANSACTION_STATUS_CLEARED,
    ]
    if account_id:
        account = accounts_service.get_active_account(db, user_id, account_id)
        period.append(accounts_service.touches_account(account))

    totals: dict[str, Decimal] = {
        kind: Decimal(amount)
        for kind, amount in db.execute(
            select(Transaction.kind, func.coalesce(func.sum(Transaction.amount), 0))
            .where(*period)
            .group_by(Transaction.kind)
        ).tuples()
    }
    income = totals.get("income", Decimal(0))
    spending = totals.get("expense", Decimal(0))
    category_rows = db.execute(
        select(Category.id, Category.name, Category.color, func.sum(Transaction.amount).label("amount"))
        .join(Transaction, Transaction.category_id == Category.id)
        .where(*period, Transaction.kind == "expense")
        .group_by(Category.id, Category.name, Category.color)
        .order_by(func.sum(Transaction.amount).desc())
    ).all()
    return DashboardSummary(
        period=DashboardPeriod(year=year, month=month),
        income=income,
        spending=spending,
        cash_flow=income - spending,
        transaction_count=db.scalar(select(func.count(Transaction.id)).where(*period)) or 0,
        categories=[
            DashboardCategory(id=row.id, name=row.name, color=row.color, amount=row.amount) for row in category_rows
        ],
    )
