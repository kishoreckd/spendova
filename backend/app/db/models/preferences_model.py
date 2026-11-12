"""User controls and persistent, atomic AI accounting."""

from datetime import date, datetime

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.model_helpers import created_at_column, new_id
from app.db.session import Base


class Preferences(Base):
    __tablename__ = "preferences"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    daily_token_limit: Mapped[int] = mapped_column(Integer, default=20000)
    bills: Mapped[bool] = mapped_column(Boolean, default=False)
    deposits: Mapped[bool] = mapped_column(Boolean, default=False)
    budgets: Mapped[bool] = mapped_column(Boolean, default=False)
    weekly: Mapped[bool] = mapped_column(Boolean, default=False)


class AiDay(Base):
    __tablename__ = "ai_daily_usage"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    charged_tokens: Mapped[int] = mapped_column(Integer, default=0)


class AiCharge(Base):
    __tablename__ = "ai_charges"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date)
    reserved: Mapped[int] = mapped_column(Integer)
    settled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = created_at_column()


class ReminderReceipt(Base):
    __tablename__ = "reminder_receipts"
    __table_args__ = (UniqueConstraint("user_id", "event_key", name="uq_reminder_user_event"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    event_key: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = created_at_column()
