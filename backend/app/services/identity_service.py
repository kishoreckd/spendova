"""Database-backed password changes and session revocation."""

from typing import Protocol

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.passwords import hash_password
from app.db.models.auth_model import PasswordCredential
from app.db.session import get_db
from app.services.session_service import revoke_all


class IdentityError(RuntimeError):
    """Account update failed."""


class IdentityProvider(Protocol):
    def sign_in_methods(self, uid: str) -> set[str]: ...
    def set_password(self, uid: str, password: str) -> None: ...
    def sign_out_everywhere(self, uid: str) -> None: ...


class LocalIdentity:
    def __init__(self, db: Session):
        self.db = db

    def sign_in_methods(self, uid: str) -> set[str]:
        return {"password"}

    def set_password(self, uid: str, password: str) -> None:
        credential = self.db.get(PasswordCredential, uid)
        if credential:
            credential.password_hash = hash_password(password)
            credential.failed_logins = 0
            credential.locked_until = None
        else:
            self.db.add(PasswordCredential(user_id=uid, password_hash=hash_password(password)))

    def sign_out_everywhere(self, uid: str) -> None:
        revoke_all(self.db, uid)


def optional_identity_provider(db: Session = Depends(get_db)) -> IdentityProvider:
    return LocalIdentity(db)
