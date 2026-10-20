from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from google.auth.transport import requests
from google.oauth2 import id_token
from sqlalchemy.orm import Session

from .core.config import get_settings
from .db.session import get_db
from .models import User


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None = None
    name: str | None = None
    photo_url: str | None = None
    email_verified: bool = False
    provider: str | None = None


def get_current_user(
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None),
) -> CurrentUser:
    settings = get_settings()
    if not settings.auth_required:
        return CurrentUser(id=x_user_id or "local-development-user")

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bearer token is required")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        claims = id_token.verify_firebase_token(
            token,
            requests.Request(),
            audience=settings.firebase_project_id,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid authentication token") from exc

    user_id = claims.get("sub") or claims.get("user_id")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token has no user identity")
    return CurrentUser(
        id=user_id,
        email=claims.get("email"),
        name=claims.get("name"),
        photo_url=claims.get("picture"),
        email_verified=bool(claims.get("email_verified")),
        provider=(claims.get("firebase") or {}).get("sign_in_provider"),
    )


def get_verified_current_user(
    identity: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CurrentUser:
    if not get_settings().auth_required:
        return identity
    user = db.get(User, identity.id)
    if not user or not user.email_verified:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Email verification is required")
    return identity
