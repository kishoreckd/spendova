"""Account database mapping: banks, cards, cash, loans, deposits, and investments."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.model_helpers import created_at_column, new_id
from app.db.session import Base


class Account(Base):
    __tablename__ = "accounts"
    __table_args__ = (Index("ix_accounts_user_active", "user_id", "archived"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    account_type: Mapped[str] = mapped_column(String(30))
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    opening_balance: Mapped[Decimal] = mapped_column(Numeric(19, 4), default=0)
    institution: Mapped[str | None] = mapped_column(String(100))
    principal_amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 4))
    annual_interest_rate: Mapped[Decimal | None] = mapped_column(Numeric(7, 4))
    started_on: Mapped[date | None] = mapped_column(Date)
    maturity_on: Mapped[date | None] = mapped_column(Date)
    tenure_months: Mapped[int | None] = mapped_column(Integer)
    installment_amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 4))
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = created_at_column()
