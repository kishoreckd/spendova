from fastapi import APIRouter, Request

from app.core.deps import Auth, DbSession
from app.schemas.preferences import PreferencesRead, PreferencesUpdate
from app.services import preferences_service
from app.services.audit_service import AuditAction, record

router = APIRouter(prefix="/preferences", tags=["settings"])


@router.get("", response_model=PreferencesRead)
def read(auth: Auth, db: DbSession):
    return preferences_service.read(db, auth.id)


@router.put("", response_model=PreferencesRead)
def save(payload: PreferencesUpdate, request: Request, auth: Auth, db: DbSession):
    preferences_service.save(db, auth.id, payload)
    record(db, request, AuditAction.PREFERENCES_UPDATE, user_id=auth.id)
    db.commit()
    return preferences_service.read(db, auth.id)
