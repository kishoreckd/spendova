from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import CurrentUser, get_current_user
from ..db.session import get_db
from ..models import Asset
from ..schemas import AssetCreate, AssetRead
from ..utils.validation.json_validator import ApiResponse, JsonResponse

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=ApiResponse[list[AssetRead]])
def list_assets(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.scalars(select(Asset).where(Asset.user_id == user.id, Asset.status == "active").order_by(Asset.purchased_on.desc())).all()
    return JsonResponse.success("Assets retrieved", records)


@router.post("", response_model=ApiResponse[AssetRead], status_code=status.HTTP_201_CREATED)
def create_asset(payload: AssetCreate, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.purchased_on > date.today():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Purchase date cannot be in the future")
    record = Asset(user_id=user.id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return JsonResponse.success("Asset created", record, status.HTTP_201_CREATED)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_asset(asset_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    record = db.scalar(select(Asset).where(Asset.id == asset_id, Asset.user_id == user.id))
    if not record:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asset not found")
    record.status = "archived"
    db.commit()
