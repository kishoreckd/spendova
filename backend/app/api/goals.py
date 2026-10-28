from fastapi import APIRouter, Request, Response

from app.core.deps import Auth, DbSession
from app.schemas.goals import GoalContributionCreate, GoalContributionRead, GoalCreate, GoalRead
from app.services import goals_service as service
from app.services.audit_service import AuditAction, record

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=list[GoalRead])
def list_goals(auth: Auth, db: DbSession):
    return service.list_goals(db, auth.id)


@router.post("", response_model=GoalRead, status_code=201)
def create_goal(payload: GoalCreate, request: Request, auth: Auth, db: DbSession):
    goal = service.create_goal(db, auth.id, payload)
    record(db, request, AuditAction.GOAL_CREATE, user_id=auth.id, target_type="goal", target_id=goal.id)
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=204)
def delete_goal(goal_id: str, request: Request, auth: Auth, db: DbSession) -> Response:
    service.delete_goal(db, auth.id, goal_id)
    record(db, request, AuditAction.GOAL_DELETE, user_id=auth.id, target_type="goal", target_id=goal_id)
    db.commit()
    return Response(status_code=204)


@router.post("/{goal_id}/contributions", response_model=GoalContributionRead, status_code=201)
def add_contribution(goal_id: str, payload: GoalContributionCreate, request: Request, auth: Auth, db: DbSession):
    contribution = service.add_contribution(db, auth.id, goal_id, payload)
    record(
        db,
        request,
        AuditAction.GOAL_CONTRIBUTE,
        user_id=auth.id,
        target_type="goal",
        target_id=goal_id,
        details={"contribution_id": contribution.id},
    )
    db.commit()
    db.refresh(contribution)
    return contribution
