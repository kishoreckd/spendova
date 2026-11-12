from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from sqlalchemy import delete

from app.core.config import get_settings
from app.core.deps import DbSession, SignedIn
from app.core.errors import AppError
from app.core.rate_limit import auth_limit, refresh_limit
from app.core.security import sha256_hex
from app.db.models.auth_model import UserSession
from app.schemas.auth import (
    GoogleAuthRequest,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    TokenResponse,
    UserRead,
    UserUpdate,
    VerificationCodeRequest,
    VerificationCodeSent,
)
from app.services import auth_service as service
from app.services import session_service
from app.services.audit_service import AuditAction, record

router = APIRouter(prefix="/auth", tags=["authentication"])

COOKIE_PATH = "/api/v1/auth"


def check_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    allowed = {*get_settings().cors_origins, str(request.base_url).rstrip("/")}
    if origin is not None and origin not in allowed:
        raise AppError.forbidden("Untrusted request origin")
    if (
        request.url.path.endswith(("/refresh", "/logout"))
        and request.cookies.get(get_settings().refresh_cookie_name)
        and not origin
    ):
        raise AppError.forbidden("Origin is required for cookie authentication")


def set_refresh_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        settings.refresh_cookie_name,
        token,
        max_age=settings.refresh_token_ttl_days * 86400,
        path=COOKIE_PATH,
        httponly=True,
        secure=settings.is_production,
        samesite="strict",
    )


def login_result(
    db: DbSession, request: Request, response: Response, background: BackgroundTasks, user
) -> LoginResponse:
    session, token = session_service.create_session(db, user.id, request.headers.get("user-agent"))
    code = None
    if not user.email_verified:
        try:
            code = service.send_verification_code(db, background, user.id).development_code
        except AppError as exc:
            if exc.status_code != 429:
                raise
    set_refresh_cookie(response, token)
    return LoginResponse(
        access_token=session_service.access_token(session),
        expires_in_seconds=get_settings().access_token_ttl_minutes * 60,
        account=UserRead.model_validate(user),
        development_code=code,
    )


@router.post(
    "/register",
    response_model=LoginResponse,
    status_code=201,
    dependencies=[Depends(auth_limit), Depends(check_origin)],
)
def register(
    payload: RegisterRequest, request: Request, response: Response, background: BackgroundTasks, db: DbSession
):
    user = session_service.register(db, payload)
    result = login_result(db, request, response, background, user)
    record(db, request, AuditAction.USER_SIGN_UP, user_id=user.id, details={"provider": "password"})
    db.commit()
    return result


@router.post("/login", response_model=LoginResponse, dependencies=[Depends(auth_limit), Depends(check_origin)])
def login(payload: LoginRequest, request: Request, response: Response, background: BackgroundTasks, db: DbSession):
    try:
        user = session_service.check_password(db, payload.email, payload.password)
    except AppError:
        record(db, request, AuditAction.USER_LOGIN_FAILED, user_id=None)
        db.commit()  # Persist per-account failed attempts and lockouts.
        raise
    result = login_result(db, request, response, background, user)
    record(db, request, AuditAction.USER_LOGIN, user_id=user.id)
    db.commit()
    return result


@router.post("/refresh", response_model=TokenResponse, dependencies=[Depends(refresh_limit), Depends(check_origin)])
def refresh(request: Request, response: Response, db: DbSession):
    token = request.cookies.get(get_settings().refresh_cookie_name)
    if not token:
        raise AppError.unauthorized("Session expired. Sign in again.")
    session, next_token = session_service.rotate(db, token)
    db.commit()
    set_refresh_cookie(response, next_token)
    return TokenResponse(
        access_token=session_service.access_token(session),
        expires_in_seconds=get_settings().access_token_ttl_minutes * 60,
    )


@router.post("/google", response_model=UserRead, include_in_schema=False)
def sign_up_or_sign_in(payload: GoogleAuthRequest, request: Request, identity: SignedIn, db: DbSession):
    """Creates the profile on first sign-in and keeps name and photo current afterwards."""
    if get_settings().auth_required:
        raise AppError.bad_request("Use /auth/register or /auth/login")
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


@router.post("/logout", status_code=204, dependencies=[Depends(check_origin)])
def logout(request: Request, db: DbSession) -> Response:
    token = request.cookies.get(get_settings().refresh_cookie_name)
    if token:
        db.execute(delete(UserSession).where(UserSession.refresh_digest == sha256_hex(token)))
        db.commit()
    response = Response(status_code=204)
    response.delete_cookie(
        get_settings().refresh_cookie_name,
        path=COOKIE_PATH,
        httponly=True,
        secure=get_settings().is_production,
        samesite="strict",
    )
    return response
