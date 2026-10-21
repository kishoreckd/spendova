from datetime import datetime, timedelta, timezone
import hmac
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import CurrentUser, get_current_user
from ..core.config import get_settings
from ..db.session import get_db
from ..email import send_verification_code
from ..models import EmailVerificationCode, User
from ..schemas import (
    GoogleAuthRequest,
    UserRead,
    UserUpdate,
    VerificationCodeRequest,
    VerificationCodeSent,
)
from ..services.auth_service import find_user, verification_code_digest
from ..utils.validation.json_validator import ApiResponse, JsonResponse

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/google", response_model=ApiResponse[UserRead])
def google_sign_up_or_login(
    payload: GoogleAuthRequest,
    identity: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    email = identity.email
    name = identity.name or payload.name
    photo_url = identity.photo_url
    if not settings.auth_required:
        email = payload.email or f"{identity.id}@local.spendova"
        name = payload.name
        photo_url = payload.photo_url
    if not email:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Google account did not provide an email address")

    user = db.get(User, identity.id)
    provider_verified = identity.email_verified or identity.provider == "google.com"
    if not user:
        user = User(
            id=identity.id,
            email=email,
            display_name=name,
            photo_url=photo_url,
            email_verified=provider_verified,
        )
        db.add(user)
    else:
        user.email = email
        user.display_name = name or user.display_name
        user.photo_url = photo_url or user.photo_url
        user.email_verified = user.email_verified or provider_verified
    db.commit()
    db.refresh(user)
    return JsonResponse.success("User signed in", user)


@router.post("/verification/send", response_model=ApiResponse[VerificationCodeSent])
def send_email_verification(
    identity: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = find_user(db, identity.id)
    settings = get_settings()
    if user.email_verified:
        return JsonResponse.success("Email is already verified", VerificationCodeSent(sent=False, expires_in_seconds=0))

    now = datetime.now(timezone.utc)
    existing = db.get(EmailVerificationCode, user.id)
    if existing and (now - existing.created_at.replace(tzinfo=timezone.utc)).total_seconds() < 60:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Wait one minute before requesting another code")

    code = f"{secrets.randbelow(1_000_000):06d}"
    expires_at = now + timedelta(minutes=settings.otp_expiry_minutes)
    if existing:
        existing.code_digest = verification_code_digest(user.id, code)
        existing.expires_at = expires_at
        existing.attempts = 0
        existing.created_at = now
    else:
        db.add(
            EmailVerificationCode(
                user_id=user.id,
                code_digest=verification_code_digest(user.id, code),
                expires_at=expires_at,
                attempts=0,
                created_at=now,
            )
        )
    db.commit()
    try:
        send_verification_code(user.email, code, user.display_name)
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    result = VerificationCodeSent(
        sent=True,
        expires_in_seconds=settings.otp_expiry_minutes * 60,
        development_code=code if settings.environment == "development" and settings.email_delivery_mode == "console" else None,
    )
    return JsonResponse.success("Verification code sent", result)


@router.post("/verification/confirm", response_model=ApiResponse[UserRead])
def confirm_email_verification(
    payload: VerificationCodeRequest,
    identity: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = find_user(db, identity.id)
    if user.email_verified:
        return JsonResponse.success("Email is already verified", user)
    record = db.get(EmailVerificationCode, user.id)
    now = datetime.now(timezone.utc)
    if not record or record.expires_at.replace(tzinfo=timezone.utc) < now:
        if record:
            db.delete(record)
            db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Verification code expired; request a new code")
    if record.attempts >= 5:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts; request a new code")
    if not hmac.compare_digest(record.code_digest, verification_code_digest(user.id, payload.code)):
        record.attempts += 1
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Incorrect verification code")

    user.email_verified = True
    db.delete(record)
    db.commit()
    db.refresh(user)
    return JsonResponse.success("Email verified", user)


@router.get("/me", response_model=ApiResponse[UserRead])
def get_profile(identity: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return JsonResponse.success("Profile retrieved", find_user(db, identity.id))


@router.patch("/me", response_model=ApiResponse[UserRead])
def update_profile(
    payload: UserUpdate,
    identity: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = find_user(db, identity.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return JsonResponse.success("Profile updated", user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout() -> None:
    # Firebase ID tokens are stateless. The client signs out locally and discards
    # its token; global revocation is reserved for account-security operations.
    return None
