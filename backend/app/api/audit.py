from fastapi import APIRouter, Query

from app.core.deps import Auth, DbSession
from app.schemas.audit import AuditEntry, AuditPage
from app.services import audit_service as service

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=AuditPage)
def list_audit(auth: Auth, db: DbSession, limit: int = Query(default=50, ge=1, le=100), cursor: str | None = None):
    """The signed-in user's own activity, newest first."""
    items, next_cursor = service.list_entries(db, auth.id, limit, cursor)
    return AuditPage(items=[AuditEntry.model_validate(row) for row in items], next_cursor=next_cursor)
