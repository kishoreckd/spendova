from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import Identity, verify_firebase_token
from app.db.models.user_model import User
from app.db.session import get_db


def get_identity(
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None),
) -> Identity:
    """Verifies the Firebase ID token. Local development may pass X-User-Id instead."""
    if not get_settings().auth_required:
        return Identity(id=x_user_id or "local-development-user")
    if not authorization or not authorization.startswith("Bearer "):
        raise AppError.unauthorized("Bearer token is required")
    try:
        return verify_firebase_token(authorization.removeprefix("Bearer ").strip())
    except ValueError:
        raise AppError.unauthorized("Invalid authentication token") from None


def get_verified_identity(
    identity: Identity = Depends(get_identity),
    db: Session = Depends(get_db),
) -> Identity:
    """Financial routes need a profile whose email has been verified."""
    if not get_settings().auth_required:
        return identity
    user = db.get(User, identity.id)
    if not user or not user.email_verified:
        raise AppError(403, "EMAIL_NOT_VERIFIED", "Verify your email address to continue")
    return identity


DbSession = Annotated[Session, Depends(get_db)]
# Signed in (profile setup and email verification routes).
SignedIn = Annotated[Identity, Depends(get_identity)]
# Signed in with a verified email (every financial route).
Auth = Annotated[Identity, Depends(get_verified_identity)]
