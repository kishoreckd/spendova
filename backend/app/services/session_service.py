"""Local login with locked password checks and rotating, revocable sessions."""

from datetime import timedelta

import jwt
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.passwords import dummy_password_hash, hash_password, verify_password
from app.core.security import Identity, random_token, sha256_hex
from app.db.model_helpers import as_utc, new_id, utcnow
from app.db.models.auth_model import PasswordCredential, UserSession
from app.db.models.user_model import User
from app.schemas.auth import RegisterRequest
from app.services.auth_service import find_user_by_email


def register(db: Session, payload: RegisterRequest) -> User:
    if find_user_by_email(db, payload.email):
        raise AppError.conflict("An account with this email already exists. Sign in or reset your password.")
    user = User(id=new_id(), email=payload.email, display_name=payload.name.strip())
    try:
        with db.begin_nested():
            db.add(user)
            db.flush()
            db.add(PasswordCredential(user_id=user.id, password_hash=hash_password(payload.password)))
            db.flush()
    except IntegrityError:
        raise AppError.conflict("An account with this email already exists. Sign in or reset your password.") from None
    return user


def check_password(db: Session, email: str, password: str) -> User:
    user = find_user_by_email(db, email)
    credential = (
        db.scalar(select(PasswordCredential).where(PasswordCredential.user_id == user.id).with_for_update())
        if user
        else None
    )
    valid = verify_password(password, credential.password_hash if credential else dummy_password_hash())
    if credential and credential.locked_until and as_utc(credential.locked_until) > utcnow():
        raise AppError(429, "ACCOUNT_LOCKED", "Too many failed attempts. Try again in 15 minutes.")
    if not user or not credential or not valid:
        if credential:
            credential.failed_logins += 1
            if credential.failed_logins >= 5:
                credential.locked_until = utcnow() + timedelta(minutes=15)
                credential.failed_logins = 0
        raise AppError.unauthorized("Invalid email or password")
    credential.failed_logins = 0
    credential.locked_until = None
    return user


def create_session(db: Session, user_id: str, user_agent: str | None) -> tuple[UserSession, str]:
    token = random_token()
    session = UserSession(
        user_id=user_id,
        refresh_digest=sha256_hex(token),
        expires_at=utcnow() + timedelta(days=get_settings().refresh_token_ttl_days),
        user_agent=user_agent[:512] if user_agent else None,
    )
    db.add(session)
    db.flush()
    return session, token


def access_token(session: UserSession) -> str:
    now = utcnow()
    return jwt.encode(
        {
            "typ": "access",
            "sub": session.user_id,
            "sid": session.id,
            "iat": now,
            "exp": now + timedelta(minutes=get_settings().access_token_ttl_minutes),
            "iss": "spendova",
            "aud": "spendova-api",
        },
        get_settings().jwt_access_secret,
        algorithm="HS256",
    )


def identity_from_token(db: Session, token: str) -> Identity:
    try:
        claims = jwt.decode(
            token,
            get_settings().jwt_access_secret,
            algorithms=["HS256"],
            issuer="spendova",
            audience="spendova-api",
            options={"require": ["exp", "iat", "sub", "sid", "typ"]},
        )
        if claims["typ"] != "access":
            raise ValueError("Wrong token type")
        session = db.get(UserSession, claims["sid"])
        if not session or session.user_id != claims["sub"] or as_utc(session.expires_at) <= utcnow():
            raise ValueError("Session expired")
        user = db.get(User, session.user_id)
        if not user:
            raise ValueError("Account missing")
        return Identity(
            id=user.id,
            email=user.email,
            name=user.display_name,
            email_verified=user.email_verified,
            provider="password",
        )
    except (jwt.PyJWTError, ValueError, TypeError, KeyError):
        raise AppError.unauthorized("Session expired. Sign in again.") from None


def rotate(db: Session, token: str) -> tuple[UserSession, str]:
    session = db.scalar(select(UserSession).where(UserSession.refresh_digest == sha256_hex(token)).with_for_update())
    if not session or as_utc(session.expires_at) <= utcnow():
        raise AppError.unauthorized("Session expired. Sign in again.")
    next_token = random_token()
    session.refresh_digest = sha256_hex(next_token)
    db.flush()
    return session, next_token


def revoke_all(db: Session, user_id: str) -> None:
    db.execute(delete(UserSession).where(UserSession.user_id == user_id))
