"""Two-step sign-in with an authenticator app (TOTP) or an emailed code, plus single-use backup codes.

The TOTP seed is sealed at rest; codes and backup codes are stored only as keyed digests.
"""

import hmac
from datetime import timedelta

from fastapi import BackgroundTasks
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core import totp
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.passwords import verify_password
from app.core.security import code_digest, one_time_code, random_token, seal, sha256_hex, unseal
from app.db.model_helpers import as_utc, utcnow
from app.db.models.auth_model import PasswordCredential
from app.db.models.two_factor_model import TrustedTwoFactorDevice, TwoFactor, TwoFactorChallenge
from app.db.models.user_model import User
from app.schemas.two_factor import TwoFactorChallengeRead, TwoFactorCodeSent, TwoFactorStatus
from app.services import notifications_service as notify

CHALLENGE_MINUTES = 10
MAX_ATTEMPTS = 5
RESEND_AFTER_SECONDS = 60
RECOVERY_PURPOSE = "2fa-recovery"
LOGIN_CODE_PURPOSE = "2fa-login"


def enabled_for(db: Session, user_id: str) -> TwoFactor | None:
    row = db.get(TwoFactor, user_id)
    return row if row and row.enabled else None


def status(db: Session, user_id: str) -> TwoFactorStatus:
    row = enabled_for(db, user_id)
    return TwoFactorStatus(
        enabled=row is not None,
        method=row.method if row else None,  # type: ignore[arg-type]
        recovery_codes_left=len(row.recovery_hashes or []) if row else 0,
    )


def _issue_recovery_codes(row: TwoFactor) -> list[str]:
    codes = totp.new_recovery_codes()
    row.recovery_hashes = [
        code_digest(row.user_id, totp.normalize_recovery_code(code), RECOVERY_PURPOSE) for code in codes
    ]
    return codes


def _require_password(db: Session, user_id: str, password: str) -> None:
    credential = db.get(PasswordCredential, user_id)
    if not credential or not verify_password(password, credential.password_hash):
        raise AppError.bad_request("Incorrect password")


def start_totp(db: Session, user: User, password: str) -> tuple[str, str]:
    _require_password(db, user.id, password)
    row = db.get(TwoFactor, user.id)
    if row and row.enabled:
        raise AppError.conflict("Two-step sign-in is already on")
    secret = totp.new_secret()
    if row is None:
        row = TwoFactor(user_id=user.id, method="totp", enabled=False)
        db.add(row)
    row.method, row.totp_secret, row.totp_last_counter = "totp", seal(secret), None
    db.flush()
    return secret, totp.otpauth_uri(secret, user.email)


def enable_totp(db: Session, user: User, code: str) -> list[str]:
    row = db.get(TwoFactor, user.id)
    if row and row.enabled:
        raise AppError.conflict("Two-step sign-in is already on")
    if not row or row.method != "totp" or not row.totp_secret:
        raise AppError.bad_request("Start the authenticator setup first")
    counter = totp.matching_counter(unseal(row.totp_secret), code)
    if counter is None:
        raise AppError.bad_request("That code isn't right. Check the time on your phone and try again.")
    row.totp_last_counter, row.enabled = counter, True
    return _issue_recovery_codes(row)


def enable_email(db: Session, user: User, password: str) -> list[str]:
    _require_password(db, user.id, password)
    if not user.email_verified:
        raise AppError.bad_request("Verify your email first")
    row = db.get(TwoFactor, user.id)
    if row and row.enabled:
        raise AppError.conflict("Two-step sign-in is already on")
    if row is None:
        row = TwoFactor(user_id=user.id, method="email", enabled=True)
        db.add(row)
    row.method, row.enabled, row.totp_secret, row.totp_last_counter = "email", True, None, None
    db.flush()
    return _issue_recovery_codes(row)


def disable(db: Session, user_id: str, password: str) -> None:
    _require_password(db, user_id, password)
    db.execute(delete(TwoFactor).where(TwoFactor.user_id == user_id))
    db.execute(delete(TwoFactorChallenge).where(TwoFactorChallenge.user_id == user_id))
    revoke_trusted_devices(db, user_id)


def trust_device(db: Session, user_id: str, user_agent: str | None) -> str:
    token = random_token()
    db.add(
        TrustedTwoFactorDevice(
            user_id=user_id,
            token_digest=sha256_hex(token),
            expires_at=utcnow() + timedelta(days=get_settings().trusted_device_ttl_days),
            user_agent=user_agent[:512] if user_agent else None,
        )
    )
    db.flush()
    return token


def is_trusted_device(db: Session, user_id: str, token: str | None) -> bool:
    if not token:
        return False
    device = db.scalar(
        select(TrustedTwoFactorDevice).where(
            TrustedTwoFactorDevice.user_id == user_id,
            TrustedTwoFactorDevice.token_digest == sha256_hex(token),
        )
    )
    if not device:
        return False
    if as_utc(device.expires_at) <= utcnow():
        db.delete(device)
        return False
    return True


def revoke_trusted_devices(db: Session, user_id: str) -> None:
    db.execute(delete(TrustedTwoFactorDevice).where(TrustedTwoFactorDevice.user_id == user_id))


# --- Sign-in --------------------------------------------------------------------------------------


def _send_login_code(db: Session, background: BackgroundTasks, user: User, challenge: TwoFactorChallenge) -> str:
    code = one_time_code()
    challenge.code_digest = code_digest(user.id, code, LOGIN_CODE_PURPOSE)
    challenge.code_sent_at = utcnow()
    challenge.attempts = 0
    notify.sign_in_code(db, background, user, code, CHALLENGE_MINUTES)
    return code


def start_challenge(db: Session, background: BackgroundTasks, user: User, row: TwoFactor) -> TwoFactorChallengeRead:
    """Called after a correct password. No session exists until the second step succeeds."""
    db.execute(delete(TwoFactorChallenge).where(TwoFactorChallenge.user_id == user.id))
    token = random_token()
    challenge = TwoFactorChallenge(
        id=sha256_hex(token), user_id=user.id, expires_at=utcnow() + timedelta(minutes=CHALLENGE_MINUTES), attempts=0
    )
    db.add(challenge)
    code = _send_login_code(db, background, user, challenge) if row.method == "email" else None
    db.flush()
    return TwoFactorChallengeRead(
        challenge_token=token,
        method=row.method,  # type: ignore[arg-type]
        expires_in_seconds=CHALLENGE_MINUTES * 60,
        development_code=code if code and get_settings().show_development_codes else None,
    )


def _load_challenge(db: Session, token: str) -> tuple[TwoFactorChallenge, User, TwoFactor]:
    challenge = db.scalar(
        select(TwoFactorChallenge).where(TwoFactorChallenge.id == sha256_hex(token)).with_for_update()
    )
    if not challenge or as_utc(challenge.expires_at) <= utcnow() or challenge.attempts >= MAX_ATTEMPTS:
        if challenge:
            db.delete(challenge)
        raise AppError.unauthorized("Your sign-in expired. Enter your password again.")
    user = db.get(User, challenge.user_id)
    row = enabled_for(db, challenge.user_id)
    if not user or not row:
        db.delete(challenge)
        raise AppError.unauthorized("Your sign-in expired. Enter your password again.")
    return challenge, user, row


def resend_code(db: Session, background: BackgroundTasks, token: str) -> TwoFactorCodeSent:
    challenge, user, row = _load_challenge(db, token)
    if row.method != "email":
        raise AppError.bad_request("This account uses an authenticator app")
    if challenge.code_sent_at and (utcnow() - as_utc(challenge.code_sent_at)).total_seconds() < RESEND_AFTER_SECONDS:
        raise AppError.rate_limited("Wait one minute before requesting another code")
    code = _send_login_code(db, background, user, challenge)
    return TwoFactorCodeSent(sent=True, development_code=code if get_settings().show_development_codes else None)


def _check(user: User, row: TwoFactor, challenge: TwoFactorChallenge, method: str, code: str) -> bool:
    if method == "recovery":
        digest = code_digest(user.id, totp.normalize_recovery_code(code), RECOVERY_PURPOSE)
        remaining = list(row.recovery_hashes or [])
        if digest not in remaining:
            return False
        remaining.remove(digest)
        row.recovery_hashes = remaining  # each backup code works once
        return True
    if method != row.method:
        return False
    if method == "totp":
        if not row.totp_secret:
            return False
        counter = totp.matching_counter(unseal(row.totp_secret), code)
        if counter is None or (row.totp_last_counter is not None and counter <= row.totp_last_counter):
            return False  # wrong, or already used (replay)
        row.totp_last_counter = counter
        return True
    return bool(
        challenge.code_digest
        and hmac.compare_digest(challenge.code_digest, code_digest(user.id, code.strip(), LOGIN_CODE_PURPOSE))
    )


def complete_challenge(db: Session, token: str, method: str, code: str) -> tuple[User, bool]:
    """Returns (user, ok). A wrong code counts an attempt; the router commits either way."""
    challenge, user, row = _load_challenge(db, token)
    if not _check(user, row, challenge, method, code):
        challenge.attempts += 1
        return user, False
    db.delete(challenge)
    return user, True


def verify_password_recovery_factor(db: Session, user: User, method: str, code: str) -> bool:
    """Verify a pre-enrolled non-email factor without creating a login session."""
    row = enabled_for(db, user.id)
    if not row:
        return False
    if method == "totp":
        if row.method != "totp" or not row.totp_secret:
            return False
        counter = totp.matching_counter(unseal(row.totp_secret), code)
        if counter is None or (row.totp_last_counter is not None and counter <= row.totp_last_counter):
            return False
        row.totp_last_counter = counter
        return True
    if method == "recovery":
        digest = code_digest(user.id, totp.normalize_recovery_code(code), RECOVERY_PURPOSE)
        remaining = list(row.recovery_hashes or [])
        if digest not in remaining:
            return False
        remaining.remove(digest)
        row.recovery_hashes = remaining
        return True
    return False
