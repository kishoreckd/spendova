from fastapi import APIRouter, Depends, Request, Response

from app.core.deps import DbSession, SignedIn
from app.core.rate_limit import auth_limit
from app.schemas.two_factor import (
    RecoveryCodes,
    TotpEnableRequest,
    TotpSetup,
    TwoFactorDisableRequest,
    TwoFactorPasswordRequest,
    TwoFactorStatus,
)
from app.services import two_factor_service as service
from app.services.audit_service import AuditAction, record
from app.services.auth_service import find_user

router = APIRouter(prefix="/auth/2fa", tags=["authentication"])


@router.get("", response_model=TwoFactorStatus)
def get_status(identity: SignedIn, db: DbSession):
    return service.status(db, identity.id)


@router.post("/totp/setup", response_model=TotpSetup, dependencies=[Depends(auth_limit)])
def totp_setup(payload: TwoFactorPasswordRequest, identity: SignedIn, db: DbSession):
    secret, uri = service.start_totp(db, find_user(db, identity.id), payload.password)
    db.commit()
    return TotpSetup(secret=secret, otpauth_uri=uri)


@router.post("/totp/enable", response_model=RecoveryCodes, dependencies=[Depends(auth_limit)])
def totp_enable(payload: TotpEnableRequest, request: Request, identity: SignedIn, db: DbSession):
    codes = service.enable_totp(db, find_user(db, identity.id), payload.code)
    record(db, request, AuditAction.TWO_FACTOR_ENABLE, user_id=identity.id, details={"method": "totp"})
    db.commit()
    return RecoveryCodes(recovery_codes=codes)


@router.post("/email/enable", response_model=RecoveryCodes, dependencies=[Depends(auth_limit)])
def email_enable(payload: TwoFactorPasswordRequest, request: Request, identity: SignedIn, db: DbSession):
    codes = service.enable_email(db, find_user(db, identity.id), payload.password)
    record(db, request, AuditAction.TWO_FACTOR_ENABLE, user_id=identity.id, details={"method": "email"})
    db.commit()
    return RecoveryCodes(recovery_codes=codes)


@router.post("/disable", status_code=204, dependencies=[Depends(auth_limit)])
def disable(payload: TwoFactorDisableRequest, request: Request, identity: SignedIn, db: DbSession) -> Response:
    service.disable(db, identity.id, payload.password)
    record(db, request, AuditAction.TWO_FACTOR_DISABLE, user_id=identity.id)
    db.commit()
    return Response(status_code=204)
