"""Goal database mapping: a savings target such as a planned purchase."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.model_helpers import created_at_column, new_id
from app.db.session import Base


class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (Index("ix_goals_user_created", "user_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    target_amount: Mapped[Decimal] = mapped_column(Numeric(19, 4))
    saved_amount: Mapped[Decimal] = mapped_column(Numeric(19, 4), default=0)
    months: Mapped[int] = mapped_column(Integer)
    monthly_required: Mapped[Decimal] = mapped_column(Numeric(19, 4))
    created_at: Mapped[datetime] = created_at_column()
