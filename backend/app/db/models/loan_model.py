"""Loan database mapping: a cash loan or a product bought on EMI.

Only the terms are stored. The schedule, totals, and progress are recalculated from
them on every read (see app/core/finance.py), so they can never drift out of date.
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.model_helpers import created_at_column, new_id
from app.db.session import Base


class Loan(Base):
    __tablename__ = "loans"
    __table_args__ = (Index("ix_loans_user_status", "user_id", "status"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    loan_type: Mapped[str] = mapped_column(String(30))
    lender: Mapped[str | None] = mapped_column(String(100))
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    principal: Mapped[Decimal] = mapped_column(Numeric(19, 4))
    # As stated by the lender; null when only the EMI is known (the rate is then estimated).
    annual_interest_rate: Mapped[Decimal | None] = mapped_column(Numeric(7, 4))
    emi_amount: Mapped[Decimal] = mapped_column(Numeric(19, 4))
    tenure_months: Mapped[int] = mapped_column(Integer)
    first_due_on: Mapped[date] = mapped_column(Date)
    processing_fee: Mapped[Decimal] = mapped_column(Numeric(19, 4), default=0)
    # EMIs paid before the loan was added to Spendova; later payments are counted from transactions.
    installments_paid_before: Mapped[int] = mapped_column(Integer, default=0)
    account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id", ondelete="SET NULL"))
    asset_id: Mapped[str | None] = mapped_column(ForeignKey("assets.id", ondelete="SET NULL"))
    recurring_rule_id: Mapped[str | None] = mapped_column(ForeignKey("recurring_rules.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(20), default="active")
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = created_at_column()
