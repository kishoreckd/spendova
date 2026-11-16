"""Two-step sign-in: the chosen method per user and short-lived sign-in challenges."""

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.model_helpers import created_at_column, updated_at_column
from app.db.session import Base


class TwoFactor(Base):
    __tablename__ = "two_factor"

    user_id: Mapped[str] = mapped_column(String(128), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    # "totp" (authenticator app) or "email" (code sent to the verified address).
    method: Mapped[str] = mapped_column(String(10))
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    totp_secret: Mapped[str | None] = mapped_column(Text)  # sealed with DATA_ENCRYPTION_KEY
    totp_last_counter: Mapped[int | None] = mapped_column(Integer)  # blocks replay of a used code
    recovery_hashes: Mapped[list[str] | None] = mapped_column(JSON)  # HMAC digests; each code works once
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()


class TwoFactorChallenge(Base):
    """Issued after a correct password when two-step sign-in is on. The id is a digest of the token."""

    __tablename__ = "two_factor_challenges"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    code_digest: Mapped[str | None] = mapped_column(String(64))  # email method only
    code_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = created_at_column()
