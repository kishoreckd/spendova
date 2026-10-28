from fastapi import APIRouter, BackgroundTasks, Depends, Request

from app.core.deps import DbSession
from app.core.errors import AppError
from app.core.rate_limit import auth_limit
from app.schemas.password_reset import (
    PasswordResetComplete,
    PasswordResetCompleted,
    PasswordResetRequest,
    PasswordResetRequested,
    PasswordResetVerified,
    PasswordResetVerify,
)
from app.services import password_reset_service as service
from app.services.audit_service import AuditAction, record
from app.services.identity_service import IdentityProvider, optional_identity_provider

router = APIRouter(prefix="/auth/password-reset", tags=["authentication"], dependencies=[Depends(auth_limit)])


@router.post("/request", response_model=PasswordResetRequested)
def request_password_reset(
    payload: PasswordResetRequest,
    request: Request,
    background: BackgroundTasks,
    db: DbSession,
    identity: IdentityProvider | None = Depends(optional_identity_provider),
):
    """Same answer for every address; the email is sent after the response."""
    result, user = service.request_reset(db, background, identity, payload.email)
    if user:
        record(db, request, AuditAction.PASSWORD_RESET_REQUEST, user_id=user.id)
    db.commit()
    return result


@router.post("/verify", response_model=PasswordResetVerified)
def verify_password_reset_code(payload: PasswordResetVerify, db: DbSession):
    try:
        result = service.verify_code(db, payload.email, payload.code)
    except AppError:
        db.commit()  # Keep the attempt count and expired-code cleanup.
        raise
    db.commit()
    return result


@router.post("/complete", response_model=PasswordResetCompleted)
def complete_password_reset(
    payload: PasswordResetComplete,
    request: Request,
    background: BackgroundTasks,
    db: DbSession,
    identity: IdentityProvider | None = Depends(optional_identity_provider),
):
    user = service.complete_reset(db, background, identity, payload.reset_token, payload.new_password)
    record(db, request, AuditAction.PASSWORD_RESET_COMPLETE, user_id=user.id)
    db.commit()
    return PasswordResetCompleted(email=user.email)
