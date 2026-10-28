"""Asset database mapping: an owned product, its cost per day, and replacement goal."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core import finance
from app.db.model_helpers import created_at_column, new_id
from app.db.session import Base


class Asset(Base):
    __tablename__ = "assets"
    __table_args__ = (
        Index("ix_assets_user_status", "user_id", "status"),
        CheckConstraint(
            "expected_life_months IS NULL OR target_cost_per_day IS NULL",
            name="ck_assets_single_replacement_goal",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    asset_type: Mapped[str] = mapped_column(String(50))
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(19, 4))
    purchased_on: Mapped[date] = mapped_column(Date)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="active")
    expected_life_months: Mapped[int | None] = mapped_column(Integer)
    target_cost_per_day: Mapped[Decimal | None] = mapped_column(Numeric(19, 4))
    created_at: Mapped[datetime] = created_at_column()

    @property
    def age_days(self) -> int:
        return finance.days_owned(self.purchased_on, date.today())

    @property
    def cost_per_day(self) -> Decimal:
        return finance.cost_per_day(self.purchase_price, self.purchased_on, date.today())

    @property
    def replacement_goal(self) -> finance.ReplacementGoal | None:
        return finance.replacement_goal(
            self.purchase_price,
            self.purchased_on,
            date.today(),
            self.expected_life_months,
            self.target_cost_per_day,
        )
