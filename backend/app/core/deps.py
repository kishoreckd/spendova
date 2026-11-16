from typing import Annotated

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import Identity
from app.db.session import get_db
from app.services.session_service import identity_from_token

bearer_scheme = HTTPBearer(
    auto_error=False, scheme_name="SessionBearer", description="Access token returned by /auth/login or /auth/register"
)


def get_identity(
    authorization: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
    x_user_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Identity:
    """Verifies a local access token and its live database session."""
    if not get_settings().auth_required and authorization is None:
        return Identity(id=x_user_id or "local-development-user")
    if not authorization:
        raise AppError.unauthorized("Bearer token is required")
    return identity_from_token(db, authorization.credentials.strip())


DbSession = Annotated[Session, Depends(get_db)]
# Signed in (profile setup and email verification routes).
SignedIn = Annotated[Identity, Depends(get_identity)]
# Signed in (every financial route). Email verification is optional ("verify later"); scheduled
# reminder emails still go only to verified addresses.
Auth = Annotated[Identity, Depends(get_identity)]
