"""Transaction database mapping. Each cleared transaction owns balanced ledger entries."""

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.model_helpers import created_at_column, new_id
from app.db.session import Base

if TYPE_CHECKING:
    from app.db.models.ledger_entry_model import LedgerEntry


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_transaction_user_idempotency"),
        Index("ix_transactions_user_occurred", "user_id", "occurred_on", "id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    amount: Mapped[Decimal] = mapped_column(Numeric(19, 4))
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    source: Mapped[str] = mapped_column(String(100))
    destination: Mapped[str] = mapped_column(String(100))
    source_account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id", ondelete="SET NULL"), index=True)
    destination_account_id: Mapped[str | None] = mapped_column(
        ForeignKey("accounts.id", ondelete="SET NULL"), index=True
    )
    merchant: Mapped[str | None] = mapped_column(String(160))
    occurred_on: Mapped[date] = mapped_column(Date)
    category_id: Mapped[str | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), index=True)
    recurring_rule_id: Mapped[str | None] = mapped_column(
        ForeignKey("recurring_rules.id", ondelete="SET NULL"), index=True
    )
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="cleared")
    idempotency_key: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = created_at_column()
    entries: Mapped[list["LedgerEntry"]] = relationship(cascade="all, delete-orphan", lazy="selectin")
