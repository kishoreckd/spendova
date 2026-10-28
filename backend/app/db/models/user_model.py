"""User database mapping. The primary key is the Firebase UID."""

from datetime import datetime

from sqlalchemy import Boolean, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.model_helpers import created_at_column, updated_at_column
from app.db.session import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("email", name="uq_users_email"),)

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    # Matches migrations 0001/0002: a unique index plus a named unique constraint.
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(120))
    photo_url: Mapped[str | None] = mapped_column(String(1000))
    base_currency: Mapped[str] = mapped_column(String(3), default="INR")
    country_code: Mapped[str | None] = mapped_column(String(2))
    locale: Mapped[str] = mapped_column(String(20), default="en-IN")
    time_zone: Mapped[str] = mapped_column(String(80), default="Asia/Kolkata")
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()
