"""Budget database mapping: one monthly limit per user and month."""

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.model_helpers import created_at_column, new_id
from app.db.session import Base

if TYPE_CHECKING:
    from app.db.models.budget_line_model import BudgetLine


class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (UniqueConstraint("user_id", "month", name="uq_budget_user_month"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    month: Mapped[date] = mapped_column(Date)
    total_limit: Mapped[Decimal] = mapped_column(Numeric(19, 4))
    created_at: Mapped[datetime] = created_at_column()
    lines: Mapped[list["BudgetLine"]] = relationship(cascade="all, delete-orphan", lazy="selectin")
