from fastapi import APIRouter, Request, Response

from app.core.deps import Auth, DbSession
from app.schemas.accounts import AccountCreate, AccountRead
from app.services import accounts_service as service
from app.services.audit_service import AuditAction, record

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountRead])
def list_accounts(auth: Auth, db: DbSession):
    return service.list_accounts(db, auth.id)


@router.post("", response_model=AccountRead, status_code=201)
def create_account(payload: AccountCreate, request: Request, auth: Auth, db: DbSession):
    account = service.create_account(db, auth.id, payload)
    record(
        db,
        request,
        AuditAction.ACCOUNT_CREATE,
        user_id=auth.id,
        target_type="account",
        target_id=account.id,
        details={"type": account.account_type},
    )
    db.commit()
    db.refresh(account)
    return service.to_read(account, [])


@router.delete("/{account_id}", status_code=204)
def archive_account(account_id: str, request: Request, auth: Auth, db: DbSession) -> Response:
    service.archive_account(db, auth.id, account_id)
    record(db, request, AuditAction.ACCOUNT_ARCHIVE, user_id=auth.id, target_type="account", target_id=account_id)
    db.commit()
    return Response(status_code=204)
