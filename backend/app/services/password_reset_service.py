"""Forgot-password flow: email a code, verify it, then set a new password.

Safeguards:
- `request_reset` answers identically for every address and sends mail in the background,
  so neither the body nor the timing reveals whether an account exists.
- Codes and reset tokens are stored only as keyed/sha256 digests.
- A code allows five attempts and is spent on success; the reset token it yields is
  single-use and expires quickly.
- Completing a reset signs out every other session and sends a security notice.
"""

import hmac
import logging
from datetime import timedelta

from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import code_digest, one_time_code, random_token, sha256_hex
from app.db.model_helpers import as_utc, utcnow
from app.db.models.password_reset_code_model import PasswordResetCode
from app.db.models.user_model import User
from app.schemas.password_reset import PasswordResetRequested, PasswordResetVerified
from app.services import notifications_service as notify
from app.services.auth_service import find_user_by_email
from app.services.identity_service import IdentityError, IdentityProvider

logger = logging.getLogger("spendova.password_reset")

RESEND_AFTER_SECONDS = 60
MAX_ATTEMPTS = 5
PURPOSE = "reset-password"
INVALID_CODE = "That code is incorrect or has expired"
SESSION_EXPIRED = "This reset session has expired. Start again."


def request_reset(
    db: Session, background: BackgroundTasks, identity: IdentityProvider | None, email: str
) -> tuple[PasswordResetRequested, User | None]:
    """Returns the public answer and, for audit only, the user a code was sent to."""
    settings = get_settings()
    if identity is None and settings.is_production:
        raise AppError.unavailable("Password reset is temporarily unavailable")
    result = PasswordResetRequested(
        sent=True,
        expires_in_seconds=settings.password_reset_code_minutes * 60,
        resend_after_seconds=RESEND_AFTER_SECONDS,
    )
    user = find_user_by_email(db, email)
    if not user:
        return result, None
    now = utcnow()
    record = db.get(PasswordResetCode, user.id)
    if record and (now - as_utc(record.created_at)).total_seconds() < RESEND_AFTER_SECONDS:
        return result, None
    try:
        methods = identity.sign_in_methods(user.id) if identity else {"password"}
    except IdentityError:
        logger.warning("Password reset skipped: identity lookup failed")
        return result, None
    if "password" not in methods:
        notify.google_sign_in_notice(db, background, user)
        return result, None

    code = one_time_code()
    digest = code_digest(user.id, code, PURPOSE)
    expires_at = now + timedelta(minutes=settings.password_reset_code_minutes)
    if record:
        record.code_digest, record.code_expires_at, record.attempts = digest, expires_at, 0
        record.token_digest, record.token_expires_at, record.created_at = None, None, now
    else:
        db.add(
            PasswordResetCode(
                user_id=user.id, code_digest=digest, code_expires_at=expires_at, attempts=0, created_at=now
            )
        )
    notify.forgot_password(db, background, user, code)
    if settings.show_development_codes:
        result.development_code = code
    return result, user


def verify_code(db: Session, email: str, code: str) -> PasswordResetVerified:
    """Wrong attempts are counted even though the call fails; the router commits either way."""
    settings = get_settings()
    user = find_user_by_email(db, email)
    record = db.get(PasswordResetCode, user.id) if user else None
    now = utcnow()
    if not user or not record or not record.code_digest:
        raise AppError.bad_request(INVALID_CODE)
    if as_utc(record.code_expires_at) < now:
        db.delete(record)
        raise AppError.bad_request(INVALID_CODE)
    if record.attempts >= MAX_ATTEMPTS:
        raise AppError.rate_limited("Too many attempts. Request a new code.")
    if not hmac.compare_digest(record.code_digest, code_digest(user.id, code, PURPOSE)):
        record.attempts += 1
        left = MAX_ATTEMPTS - record.attempts
        if not left:
            raise AppError.rate_limited("Too many attempts. Request a new code.")
        raise AppError.bad_request(f"Incorrect code. {left} attempt{'s' if left != 1 else ''} left.")

    token = random_token()
    record.code_digest = ""
    record.token_digest = sha256_hex(token)
    record.token_expires_at = now + timedelta(minutes=settings.password_reset_token_minutes)
    return PasswordResetVerified(reset_token=token, expires_in_seconds=settings.password_reset_token_minutes * 60)


def complete_reset(
    db: Session, background: BackgroundTasks, identity: IdentityProvider | None, reset_token: str, new_password: str
) -> User:
    record = db.scalar(select(PasswordResetCode).where(PasswordResetCode.token_digest == sha256_hex(reset_token)))
    if not record or not record.token_expires_at or as_utc(record.token_expires_at) < utcnow():
        raise AppError.bad_request(SESSION_EXPIRED)
    if identity is None:
        raise AppError.unavailable("Password reset is not configured on the server")
    user = db.get(User, record.user_id)
    if not user:
        raise AppError.bad_request(SESSION_EXPIRED)
    try:
        identity.set_password(user.id, new_password)
    except IdentityError as exc:
        raise AppError(502, "IDENTITY_UNAVAILABLE", "Could not update your password. Try again.") from exc
    try:
        identity.sign_out_everywhere(user.id)
    except IdentityError:
        logger.warning("Password changed but other sessions could not be revoked")
    db.delete(record)
    notify.password_changed(db, background, user)
    return user
