from fastapi import APIRouter, Request, Response

from app.core.deps import Auth, DbSession
from app.schemas.budgets import BudgetCreate, BudgetRead, BudgetStatus
from app.services import budgets_service as service
from app.services.audit_service import AuditAction, record

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("", response_model=list[BudgetRead])
def list_budgets(auth: Auth, db: DbSession):
    return service.list_budgets(db, auth.id)


@router.post("", response_model=BudgetRead, status_code=201)
def create_budget(payload: BudgetCreate, request: Request, auth: Auth, db: DbSession):
    budget = service.create_budget(db, auth.id, payload)
    record(db, request, AuditAction.BUDGET_CREATE, user_id=auth.id, target_type="budget", target_id=budget.id)
    db.commit()
    db.refresh(budget)
    return budget


@router.get("/{budget_id}/status", response_model=BudgetStatus)
def budget_status(budget_id: str, auth: Auth, db: DbSession):
    return service.budget_status(db, auth.id, budget_id)


@router.delete("/{budget_id}", status_code=204)
def delete_budget(budget_id: str, request: Request, auth: Auth, db: DbSession) -> Response:
    service.delete_budget(db, auth.id, budget_id)
    record(db, request, AuditAction.BUDGET_DELETE, user_id=auth.id, target_type="budget", target_id=budget_id)
    db.commit()
    return Response(status_code=204)
