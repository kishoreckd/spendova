from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import CurrentUser, get_current_user
from ..db.session import get_db
from ..domain import monthly_goal_amount
from ..models import Goal, GoalContribution
from ..schemas import GoalContributionCreate, GoalContributionRead, GoalCreate, GoalRead
from ..utils.validation.json_validator import ApiResponse, JsonResponse

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=ApiResponse[list[GoalRead]])
def list_goals(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.scalars(select(Goal).where(Goal.user_id == user.id).order_by(Goal.created_at)).all()
    return JsonResponse.success("Goals retrieved", records)


@router.post("", response_model=ApiResponse[GoalRead], status_code=status.HTTP_201_CREATED)
def create_goal(payload: GoalCreate, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    record = Goal(
        user_id=user.id,
        **payload.model_dump(),
        monthly_required=monthly_goal_amount(payload.target_amount, payload.saved_amount, payload.months),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return JsonResponse.success("Goal created", record, status.HTTP_201_CREATED)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    record = db.scalar(select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id))
    if not record:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Goal not found")
    db.delete(record)
    db.commit()


@router.post("/{goal_id}/contributions", response_model=ApiResponse[GoalContributionRead], status_code=status.HTTP_201_CREATED)
def add_contribution(payload: GoalContributionCreate, goal_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    goal = db.scalar(select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id))
    if not goal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Goal not found")
    if goal.saved_amount + payload.amount > goal.target_amount:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Contribution exceeds the remaining goal amount")
    record = GoalContribution(goal_id=goal.id, user_id=user.id, **payload.model_dump())
    goal.saved_amount += payload.amount
    goal.monthly_required = monthly_goal_amount(goal.target_amount, goal.saved_amount, goal.months)
    db.add(record)
    db.commit()
    db.refresh(record)
    return JsonResponse.success("Goal contribution added", record, status.HTTP_201_CREATED)
