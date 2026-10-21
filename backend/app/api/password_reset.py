"""Forgot-password flow: email a code, verify it, then set a new password.

Safeguards:
- `request` answers identically for every address and sends mail in the
  background, so neither the body nor the timing reveals whether an account exists.
- Codes and reset tokens are stored only as keyed/sha256 digests.
- A code allows five attempts and is spent on success; the reset token it
  yields is single-use and expires quickly.
- Completing a reset signs out every other session and sends a security notice.
"""

import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import email_templates
from ..core.config import get_settings
from ..db.session import get_db
from ..email import send_in_background
from ..models import PasswordResetCode, User
from ..schemas import (
    PasswordResetComplete,
    PasswordResetRequest,
    PasswordResetRequested,
    PasswordResetVerified,
    PasswordResetVerify,
)
from ..services.auth_service import token_digest, verification_code_digest
from ..services.identity import IdentityError, IdentityProvider, optional_identity_provider
from ..utils.validation.json_validator import ApiResponse, JsonResponse

router = APIRouter(prefix="/auth/password-reset", tags=["authentication"])
logger = logging.getLogger(__name__)

RESEND_AFTER_SECONDS = 60
MAX_ATTEMPTS = 5
PURPOSE = "reset-password"
INVALID_CODE = "That code is incorrect or has expired"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    # SQLite returns naive datetimes; PostgreSQL returns aware ones.
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def find_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(func.lower(User.email) == email.lower()))


@router.post("/request", response_model=ApiResponse[PasswordResetRequested])
def request_password_reset(
    payload: PasswordResetRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    identity: IdentityProvider | None = Depends(optional_identity_provider),
):
    settings = get_settings()
    if identity is None and settings.environment == "production":
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Password reset is temporarily unavailable")
    result = PasswordResetRequested(
        sent=True,
        expires_in_seconds=settings.password_reset_code_minutes * 60,
        resend_after_seconds=RESEND_AFTER_SECONDS,
    )
    reply = JsonResponse.success("If an account exists for this email, a code is on its way", result)

    user = find_user_by_email(db, payload.email)
    if not user:
        return reply
    now = utcnow()
    existing = db.get(PasswordResetCode, user.id)
    if existing and (now - as_utc(existing.created_at)).total_seconds() < RESEND_AFTER_SECONDS:
        return reply

    try:
        methods = identity.sign_in_methods(user.id) if identity else {"password"}
    except IdentityError:
        logger.warning("Password reset skipped: identity lookup failed")
        return reply
    if "password" not in methods:
        background.add_task(
            send_in_background,
            user.email,
            email_templates.google_account_notice(name=user.display_name, app_url=settings.app_url),
        )
        return reply

    code = f"{secrets.randbelow(1_000_000):06d}"
    digest = verification_code_digest(user.id, code, PURPOSE)
    expires_at = now + timedelta(minutes=settings.password_reset_code_minutes)
    if existing:
        existing.code_digest = digest
        existing.code_expires_at = expires_at
        existing.attempts = 0
        existing.token_digest = None
        existing.token_expires_at = None
        existing.created_at = now
    else:
        db.add(PasswordResetCode(
            user_id=user.id, code_digest=digest, code_expires_at=expires_at, attempts=0, created_at=now,
        ))
    db.commit()
    background.add_task(
        send_in_background,
        user.email,
        email_templates.password_reset_code(
            name=user.display_name, code=code, minutes=settings.password_reset_code_minutes,
        ),
    )
    if settings.environment == "development" and settings.email_delivery_mode == "console":
        result.development_code = code
    return reply


@router.post("/verify", response_model=ApiResponse[PasswordResetVerified])
def verify_password_reset_code(payload: PasswordResetVerify, db: Session = Depends(get_db)):
    settings = get_settings()
    user = find_user_by_email(db, payload.email)
    record = db.get(PasswordResetCode, user.id) if user else None
    now = utcnow()
    if not user or not record or not record.code_digest:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, INVALID_CODE)
    if as_utc(record.code_expires_at) < now:
        db.delete(record)
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, INVALID_CODE)
    if record.attempts >= MAX_ATTEMPTS:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts. Request a new code.")
    if not hmac.compare_digest(record.code_digest, verification_code_digest(user.id, payload.code, PURPOSE)):
        record.attempts += 1
        db.commit()
        left = MAX_ATTEMPTS - record.attempts
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Incorrect code. {left} attempt{'s' if left != 1 else ''} left." if left else "Too many attempts. Request a new code.",
        )

    token = secrets.token_urlsafe(32)
    record.code_digest = ""
    record.token_digest = token_digest(token)
    record.token_expires_at = now + timedelta(minutes=settings.password_reset_token_minutes)
    db.commit()
    return JsonResponse.success(
        "Code verified",
        PasswordResetVerified(reset_token=token, expires_in_seconds=settings.password_reset_token_minutes * 60),
    )


@router.post("/complete", response_model=ApiResponse[dict])
def complete_password_reset(
    payload: PasswordResetComplete,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    identity: IdentityProvider | None = Depends(optional_identity_provider),
):
    settings = get_settings()
    record = db.scalar(select(PasswordResetCode).where(
        PasswordResetCode.token_digest == token_digest(payload.reset_token)
    ))
    now = utcnow()
    if not record or not record.token_expires_at or as_utc(record.token_expires_at) < now:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset session has expired. Start again.")
    if identity is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Password reset is not configured on the server")
    user = db.get(User, record.user_id)
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset session has expired. Start again.")

    try:
        identity.set_password(user.id, payload.new_password)
    except IdentityError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not update your password. Try again.") from exc
    try:
        identity.sign_out_everywhere(user.id)
    except IdentityError:
        logger.warning("Password changed but other sessions could not be revoked")

    db.delete(record)
    db.commit()
    background.add_task(
        send_in_background,
        user.email,
        email_templates.password_changed(name=user.display_name, app_url=settings.app_url, changed_at=now),
    )
    return JsonResponse.success("Password updated", {"email": user.email})
