import hmac
from datetime import timedelta

from fastapi import BackgroundTasks
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import Identity, code_digest, one_time_code
from app.db.model_helpers import as_utc, utcnow
from app.db.models.email_verification_code_model import EmailVerificationCode
from app.db.models.user_model import User
from app.schemas.auth import GoogleAuthRequest, UserUpdate, VerificationCodeSent
from app.services import notifications_service as notify

RESEND_AFTER_SECONDS = 60
MAX_CODE_ATTEMPTS = 5


def find_user(db: Session, user_id: str) -> User:
    user = db.get(User, user_id)
    if not user:
        raise AppError.not_found("User profile not found; complete sign-in first")
    return user


def find_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(func.lower(User.email) == email.lower()))


def sync_signed_in_user(db: Session, identity: Identity, payload: GoogleAuthRequest) -> tuple[User, bool]:
    """Creates or refreshes the profile for a Firebase identity. Returns (user, created)."""
    settings = get_settings()
    email, name, photo_url = identity.email, identity.name or payload.name, identity.photo_url
    if not settings.auth_required:
        email = payload.email or f"{identity.id}@local.spendova"
        name, photo_url = payload.name, payload.photo_url
    if not email:
        raise AppError.bad_request("Your sign-in provider did not share an email address")

    provider_verified = identity.email_verified or identity.provider == "google.com"
    user = db.get(User, identity.id)
    if not user:
        user = User(
            id=identity.id, email=email, display_name=name, photo_url=photo_url, email_verified=provider_verified
        )
        db.add(user)
        db.flush()
        return user, True
    user.email = email
    user.display_name = name or user.display_name
    user.photo_url = photo_url or user.photo_url
    user.email_verified = user.email_verified or provider_verified
    return user, False


def update_profile(db: Session, user_id: str, payload: UserUpdate) -> User:
    user = find_user(db, user_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    return user


def send_verification_code(db: Session, background: BackgroundTasks, user_id: str) -> VerificationCodeSent:
    settings = get_settings()
    user = find_user(db, user_id)
    if user.email_verified:
        return VerificationCodeSent(sent=False, expires_in_seconds=0)
    now = utcnow()
    record = db.get(EmailVerificationCode, user.id)
    if record and (now - as_utc(record.created_at)).total_seconds() < RESEND_AFTER_SECONDS:
        raise AppError.rate_limited("Wait one minute before requesting another code")

    code = one_time_code()
    expires_at = now + timedelta(minutes=settings.otp_expiry_minutes)
    if record:
        record.code_digest, record.expires_at, record.attempts, record.created_at = (
            code_digest(user.id, code),
            expires_at,
            0,
            now,
        )
    else:
        db.add(
            EmailVerificationCode(
                user_id=user.id,
                code_digest=code_digest(user.id, code),
                expires_at=expires_at,
                attempts=0,
                created_at=now,
            )
        )
    notify.verify_email(db, background, user, code)
    return VerificationCodeSent(
        sent=True,
        expires_in_seconds=settings.otp_expiry_minutes * 60,
        development_code=code if settings.show_development_codes else None,
    )


def confirm_verification_code(db: Session, user_id: str, code: str) -> tuple[User, bool]:
    """Returns (user, newly_verified). Wrong attempts are counted even though the call fails."""
    user = find_user(db, user_id)
    if user.email_verified:
        return user, False
    record = db.get(EmailVerificationCode, user.id)
    if not record or as_utc(record.expires_at) < utcnow():
        if record:
            db.delete(record)
        raise AppError.bad_request("Verification code expired; request a new code")
    if record.attempts >= MAX_CODE_ATTEMPTS:
        raise AppError.rate_limited("Too many attempts; request a new code")
    if not hmac.compare_digest(record.code_digest, code_digest(user.id, code)):
        record.attempts += 1
        raise AppError.bad_request("Incorrect verification code")
    user.email_verified = True
    db.delete(record)
    return user, True
