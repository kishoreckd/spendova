from hashlib import sha256
import hmac

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..models import User


def find_user(db: Session, user_id: str) -> User:
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User profile not found; complete sign-in first")
    return user


def verification_code_digest(user_id: str, code: str, purpose: str = "verify-email") -> str:
    """Keyed hash of a one-time code. `purpose` keeps reset and signup codes separate."""
    secret = get_settings().otp_secret.encode()
    message = f"{user_id}:{code}" if purpose == "verify-email" else f"{purpose}:{user_id}:{code}"
    return hmac.new(secret, message.encode(), sha256).hexdigest()


def token_digest(token: str) -> str:
    return sha256(token.encode()).hexdigest()
