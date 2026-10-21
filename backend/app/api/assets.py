from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import CurrentUser, get_current_user
from ..db.session import get_db
from ..models import Asset
from ..schemas import GOAL_CONFLICT, AssetCreate, AssetRead, AssetUpdate
from ..utils.validation.json_validator import ApiResponse, JsonResponse

router = APIRouter(prefix="/assets", tags=["assets"])


def find_asset(db: Session, asset_id: str, user_id: str) -> Asset:
    record = db.scalar(select(Asset).where(Asset.id == asset_id, Asset.user_id == user_id))
    if not record:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asset not found")
    return record


def ensure_valid(record: Asset) -> None:
    if record.purchased_on > date.today():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Purchase date cannot be in the future")
    if record.expected_life_months and record.target_cost_per_day:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, GOAL_CONFLICT.capitalize())


@router.get("", response_model=ApiResponse[list[AssetRead]])
def list_assets(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.scalars(select(Asset).where(Asset.user_id == user.id, Asset.status == "active").order_by(Asset.purchased_on.desc())).all()
    return JsonResponse.success("Assets retrieved", records)


@router.post("", response_model=ApiResponse[AssetRead], status_code=status.HTTP_201_CREATED)
def create_asset(payload: AssetCreate, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    record = Asset(user_id=user.id, **payload.model_dump())
    ensure_valid(record)
    db.add(record)
    db.commit()
    db.refresh(record)
    return JsonResponse.success("Asset created", record, status.HTTP_201_CREATED)


@router.patch("/{asset_id}", response_model=ApiResponse[AssetRead])
def update_asset(
    asset_id: str,
    payload: AssetUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = find_asset(db, asset_id, user.id)
    changes = payload.model_dump(exclude_unset=True)
    for field in ("name", "asset_type", "purchase_price", "purchased_on"):
        if field in changes and changes[field] is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{field.replace('_', ' ').capitalize()} cannot be empty")
    for field, value in changes.items():
        setattr(record, field, value)
    ensure_valid(record)
    db.commit()
    db.refresh(record)
    return JsonResponse.success("Asset updated", record)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_asset(asset_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    record = find_asset(db, asset_id, user.id)
    record.status = "archived"
    db.commit()
