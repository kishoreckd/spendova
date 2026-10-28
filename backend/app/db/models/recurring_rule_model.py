"""RecurringRule database mapping: bills, expected income, and investment plans."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.model_helpers import created_at_column, new_id
from app.db.session import Base


class RecurringRule(Base):
    __tablename__ = "recurring_rules"
    __table_args__ = (Index("ix_recurring_user_due", "user_id", "active", "next_due_on"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(20))
    amount: Mapped[Decimal] = mapped_column(Numeric(19, 4))
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    frequency: Mapped[str] = mapped_column(String(20))
    interval: Mapped[int] = mapped_column(Integer, default=1)
    next_due_on: Mapped[date] = mapped_column(Date)
    source: Mapped[str] = mapped_column(String(100))
    destination: Mapped[str] = mapped_column(String(100))
    source_account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id", ondelete="SET NULL"), index=True)
    destination_account_id: Mapped[str | None] = mapped_column(
        ForeignKey("accounts.id", ondelete="SET NULL"), index=True
    )
    category_id: Mapped[str | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), index=True)
    plan_type: Mapped[str] = mapped_column(String(20), default="bill")
    cost_amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 4))
    annual_return_rate: Mapped[Decimal | None] = mapped_column(Numeric(7, 4))
    tenure_months: Mapped[int | None] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = created_at_column()
