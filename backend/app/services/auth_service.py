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


def verification_code_digest(user_id: str, code: str) -> str:
    secret = get_settings().otp_secret.encode()
    return hmac.new(secret, f"{user_id}:{code}".encode(), sha256).hexdigest()
