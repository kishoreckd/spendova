from fastapi import APIRouter, Query

from app.core.deps import Auth, DbSession
from app.schemas.dashboard import DashboardSummary
from app.services import dashboard_service as service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardSummary)
def get_dashboard(
    auth: Auth,
    db: DbSession,
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    account_id: str | None = None,
):
    return service.monthly_summary(db, auth.id, year, month, account_id)
