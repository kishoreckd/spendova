from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from . import domain
from .db.session import Base


def new_id() -> str:
    return str(uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(120))
    photo_url: Mapped[str | None] = mapped_column(String(1000))
    base_currency: Mapped[str] = mapped_column(String(3), default="INR")
    country_code: Mapped[str | None] = mapped_column(String(2))
    locale: Mapped[str] = mapped_column(String(20), default="en-IN")
    time_zone: Mapped[str] = mapped_column(String(80), default="Asia/Kolkata")
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class EmailVerificationCode(Base):
    __tablename__ = "email_verification_codes"
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    code_digest: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class PasswordResetCode(Base):
    """One active reset per user: an emailed code, then a single-use reset token."""

    __tablename__ = "password_reset_codes"
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    code_digest: Mapped[str] = mapped_column(String(64))
    code_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    token_digest: Mapped[str | None] = mapped_column(String(64), unique=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("user_id", "name", "category_type", name="uq_category_user_name_type"),
        Index("ix_categories_user_active", "user_id", "archived"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    category_type: Mapped[str] = mapped_column(String(20))
    icon: Mapped[str | None] = mapped_column(String(50))
    color: Mapped[str | None] = mapped_column(String(20))
    monthly_budget: Mapped[Decimal | None] = mapped_column(Numeric(19, 4))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


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
    destination_account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id", ondelete="SET NULL"), index=True)
    merchant: Mapped[str | None] = mapped_column(String(160))
    occurred_on: Mapped[date] = mapped_column(Date)
    category_id: Mapped[str | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), index=True)
    recurring_rule_id: Mapped[str | None] = mapped_column(ForeignKey("recurring_rules.id", ondelete="SET NULL"), index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="cleared")
    idempotency_key: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    entries: Mapped[list["LedgerEntry"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    __table_args__ = (UniqueConstraint("transaction_id", "sequence", name="uq_entry_transaction_sequence"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    transaction_id: Mapped[str] = mapped_column(ForeignKey("transactions.id", ondelete="CASCADE"), index=True)
    sequence: Mapped[int] = mapped_column(Integer)
    target: Mapped[str] = mapped_column(String(100))
    side: Mapped[str] = mapped_column(String(10))
    amount: Mapped[Decimal] = mapped_column(Numeric(19, 4))


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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    @property
    def age_days(self) -> int:
        return domain.days_owned(self.purchased_on, date.today())

    @property
    def cost_per_day(self) -> Decimal:
        return domain.cost_per_day(self.purchase_price, self.purchased_on, date.today())

    @property
    def replacement_goal(self) -> domain.ReplacementGoal | None:
        return domain.replacement_goal(
            self.purchase_price,
            self.purchased_on,
            date.today(),
            self.expected_life_months,
            self.target_cost_per_day,
        )


class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (UniqueConstraint("user_id", "month", name="uq_budget_user_month"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    month: Mapped[date] = mapped_column(Date)
    total_limit: Mapped[Decimal] = mapped_column(Numeric(19, 4))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    lines: Mapped[list["BudgetLine"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class BudgetLine(Base):
    __tablename__ = "budget_lines"
    __table_args__ = (UniqueConstraint("budget_id", "category_id", name="uq_budget_line_category"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    budget_id: Mapped[str] = mapped_column(ForeignKey("budgets.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[str] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"), index=True)
    amount_limit: Mapped[Decimal] = mapped_column(Numeric(19, 4))


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
    destination_account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id", ondelete="SET NULL"), index=True)
    category_id: Mapped[str | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), index=True)
    plan_type: Mapped[str] = mapped_column(String(20), default="bill")
    cost_amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 4))
    annual_return_rate: Mapped[Decimal | None] = mapped_column(Numeric(7, 4))
    tenure_months: Mapped[int | None] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class GoalContribution(Base):
    __tablename__ = "goal_contributions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    goal_id: Mapped[str] = mapped_column(ForeignKey("goals.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(19, 4))
    contributed_on: Mapped[date] = mapped_column(Date, default=date.today)
    note: Mapped[str | None] = mapped_column(String(250))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
