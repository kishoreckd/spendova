from datetime import date

from fastapi import APIRouter, Header, Query, Request, Response

from app.core.deps import Auth, DbSession
from app.schemas.transactions import TransactionCreate, TransactionRead
from app.services import transactions_service as service
from app.services.audit_service import AuditAction, record

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionRead])
def list_transactions(
    auth: Auth,
    db: DbSession,
    from_date: date | None = None,
    to_date: date | None = None,
    category_id: str | None = None,
    account_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    filters = service.TransactionFilters(from_date, to_date, category_id, account_id, limit, offset)
    return service.list_transactions(db, auth.id, filters)


@router.post("", response_model=TransactionRead, status_code=201)
def create_transaction(
    payload: TransactionCreate,
    request: Request,
    auth: Auth,
    db: DbSession,
    idempotency_key: str = Header(min_length=8, max_length=100),
):
    """A repeated Idempotency-Key returns the original transaction instead of a duplicate."""
    transaction, created = service.create_transaction(db, auth.id, payload, idempotency_key)
    if created:
        record(
            db,
            request,
            AuditAction.TRANSACTION_CREATE,
            user_id=auth.id,
            target_type="transaction",
            target_id=transaction.id,
            details={"kind": transaction.kind},
        )
        db.commit()
        db.refresh(transaction)
    return transaction


@router.delete("/{transaction_id}", status_code=204)
def void_transaction(transaction_id: str, request: Request, auth: Auth, db: DbSession) -> Response:
    _, changed = service.void_transaction(db, auth.id, transaction_id)
    if changed:
        record(
            db,
            request,
            AuditAction.TRANSACTION_VOID,
            user_id=auth.id,
            target_type="transaction",
            target_id=transaction_id,
        )
        db.commit()
    return Response(status_code=204)
