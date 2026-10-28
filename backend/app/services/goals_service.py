from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.finance import monthly_goal_amount
from app.db.models.goal_contribution_model import GoalContribution
from app.db.models.goal_model import Goal
from app.schemas.goals import GoalContributionCreate, GoalCreate


def list_goals(db: Session, user_id: str) -> list[Goal]:
    return list(db.scalars(select(Goal).where(Goal.user_id == user_id).order_by(Goal.created_at)).all())


def get_owned_goal(db: Session, user_id: str, goal_id: str) -> Goal:
    goal = db.scalar(select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id))
    if not goal:
        raise AppError.not_found("Goal not found")
    return goal


def create_goal(db: Session, user_id: str, payload: GoalCreate) -> Goal:
    goal = Goal(
        user_id=user_id,
        **payload.model_dump(),
        monthly_required=monthly_goal_amount(payload.target_amount, payload.saved_amount, payload.months),
    )
    db.add(goal)
    db.flush()
    return goal


def delete_goal(db: Session, user_id: str, goal_id: str) -> Goal:
    goal = get_owned_goal(db, user_id, goal_id)
    db.delete(goal)
    return goal


def add_contribution(db: Session, user_id: str, goal_id: str, payload: GoalContributionCreate) -> GoalContribution:
    goal = get_owned_goal(db, user_id, goal_id)
    if goal.saved_amount + payload.amount > goal.target_amount:
        raise AppError.bad_request("Contribution exceeds the remaining goal amount")
    contribution = GoalContribution(goal_id=goal.id, user_id=user_id, **payload.model_dump())
    goal.saved_amount += payload.amount
    goal.monthly_required = monthly_goal_amount(goal.target_amount, goal.saved_amount, goal.months)
    db.add(contribution)
    db.flush()
    return contribution
