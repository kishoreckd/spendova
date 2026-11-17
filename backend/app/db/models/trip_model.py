"""Trip planning, participant, expense and allocation mappings."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.model_helpers import created_at_column, new_id, updated_at_column
from app.db.session import Base


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    destination: Mapped[str | None] = mapped_column(String(160))
    start_on: Mapped[date | None] = mapped_column(Date)
    end_on: Mapped[date | None] = mapped_column(Date)
    mode: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="planning", index=True)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    budget: Mapped[Decimal | None] = mapped_column(Numeric(19, 4))
    notes: Mapped[str | None] = mapped_column(Text)
    # Bumped on every reopen so the next close posts fresh ledger transactions.
    revision: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()

    participants: Mapped[list["TripParticipant"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="TripParticipant.created_at"
    )
    expenses: Mapped[list["TripExpense"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="TripExpense.occurred_on"
    )
    settlements: Mapped[list["TripSettlement"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="TripSettlement.created_at"
    )


class TripParticipant(Base):
    __tablename__ = "trip_participants"
    __table_args__ = (UniqueConstraint("trip_id", "name", name="uq_trip_participant_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    trip_id: Mapped[str] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    is_user: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = created_at_column()


class TripExpense(Base):
    __tablename__ = "trip_expenses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    trip_id: Mapped[str] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    description: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(60))
    amount: Mapped[Decimal] = mapped_column(Numeric(19, 4))
    occurred_on: Mapped[date] = mapped_column(Date)
    payer_participant_id: Mapped[str] = mapped_column(
        ForeignKey("trip_participants.id", ondelete="RESTRICT"), index=True
    )
    category_id: Mapped[str] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"), index=True)
    split_mode: Mapped[str] = mapped_column(String(20))
    notes: Mapped[str | None] = mapped_column(Text)
    posted_transaction_id: Mapped[str | None] = mapped_column(
        ForeignKey("transactions.id", ondelete="SET NULL"), unique=True
    )
    created_at: Mapped[datetime] = created_at_column()
    shares: Mapped[list["TripExpenseShare"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class TripSettlement(Base):
    """Money one traveller paid another to settle up. Never income or spending in the ledger."""

    __tablename__ = "trip_settlements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    trip_id: Mapped[str] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    from_participant_id: Mapped[str] = mapped_column(ForeignKey("trip_participants.id", ondelete="CASCADE"), index=True)
    to_participant_id: Mapped[str] = mapped_column(ForeignKey("trip_participants.id", ondelete="CASCADE"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(19, 4))
    occurred_on: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = created_at_column()


class TripExpenseShare(Base):
    __tablename__ = "trip_expense_shares"

    expense_id: Mapped[str] = mapped_column(ForeignKey("trip_expenses.id", ondelete="CASCADE"), primary_key=True)
    participant_id: Mapped[str] = mapped_column(
        ForeignKey("trip_participants.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(19, 4))
