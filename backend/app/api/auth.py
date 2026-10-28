from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response

from app.core.deps import DbSession, SignedIn
from app.core.errors import AppError
from app.core.rate_limit import auth_limit
from app.schemas.auth import GoogleAuthRequest, UserRead, UserUpdate, VerificationCodeRequest, VerificationCodeSent
from app.services import auth_service as service
from app.services.audit_service import AuditAction, record

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/google", response_model=UserRead)
def sign_up_or_sign_in(payload: GoogleAuthRequest, request: Request, identity: SignedIn, db: DbSession):
    """Creates the profile on first sign-in and keeps name and photo current afterwards."""
    user, created = service.sync_signed_in_user(db, identity, payload)
    if created:
        record(db, request, AuditAction.USER_SIGN_UP, user_id=user.id, details={"provider": identity.provider})
    db.commit()
    db.refresh(user)
    return user


@router.post("/verification/send", response_model=VerificationCodeSent, dependencies=[Depends(auth_limit)])
def send_email_verification(background: BackgroundTasks, identity: SignedIn, db: DbSession):
    result = service.send_verification_code(db, background, identity.id)
    db.commit()
    return result


@router.post("/verification/confirm", response_model=UserRead, dependencies=[Depends(auth_limit)])
def confirm_email_verification(payload: VerificationCodeRequest, request: Request, identity: SignedIn, db: DbSession):
    try:
        user, verified = service.confirm_verification_code(db, identity.id, payload.code)
    except AppError:
        db.commit()  # Keep the attempt count and expired-code cleanup.
        raise
    if verified:
        record(db, request, AuditAction.EMAIL_VERIFIED, user_id=user.id)
    db.commit()
    db.refresh(user)
    return user


@router.get("/me", response_model=UserRead)
def get_profile(identity: SignedIn, db: DbSession):
    return service.find_user(db, identity.id)


@router.patch("/me", response_model=UserRead)
def update_profile(payload: UserUpdate, request: Request, identity: SignedIn, db: DbSession):
    user = service.update_profile(db, identity.id, payload)
    record(
        db,
        request,
        AuditAction.PROFILE_UPDATE,
        user_id=user.id,
        details={"fields": sorted(payload.model_dump(exclude_unset=True))},
    )
    db.commit()
    db.refresh(user)
    return user


@router.post("/logout", status_code=204)
def logout() -> Response:
    # Firebase ID tokens are stateless. The client signs out locally and discards its token.
    return Response(status_code=204)
