from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import CurrentUser, get_current_user
from ..db.session import get_db
from ..models import Category, RecurringRule
from ..schemas import RecurringRuleCreate, RecurringRuleRead
from ..utils.validation.json_validator import ApiResponse, JsonResponse

router = APIRouter(prefix="/recurring-rules", tags=["recurring money"])


@router.get("", response_model=ApiResponse[list[RecurringRuleRead]])
def list_rules(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.scalars(select(RecurringRule).where(RecurringRule.user_id == user.id, RecurringRule.active.is_(True)).order_by(RecurringRule.next_due_on)).all()
    return JsonResponse.success("Recurring rules retrieved", records)


@router.post("", response_model=ApiResponse[RecurringRuleRead], status_code=status.HTTP_201_CREATED)
def create_rule(payload: RecurringRuleCreate, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.source == payload.destination:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Source and destination must differ")
    if payload.category_id and not db.scalar(select(Category.id).where(Category.id == payload.category_id, Category.user_id == user.id)):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Category does not belong to this user")
    values = payload.model_dump()
    values["kind"] = payload.kind.value
    record = RecurringRule(user_id=user.id, **values)
    db.add(record)
    db.commit()
    db.refresh(record)
    return JsonResponse.success("Recurring rule created", record, status.HTTP_201_CREATED)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_rule(rule_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    record = db.scalar(select(RecurringRule).where(RecurringRule.id == rule_id, RecurringRule.user_id == user.id))
    if not record:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recurring rule not found")
    record.active = False
    db.commit()
