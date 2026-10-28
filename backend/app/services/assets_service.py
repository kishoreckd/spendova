from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants.finance import ASSET_STATUS_ACTIVE, ASSET_STATUS_ARCHIVED
from app.core.errors import AppError
from app.db.models.asset_model import Asset
from app.schemas.assets import GOAL_CONFLICT, AssetCreate, AssetUpdate

REQUIRED_FIELDS = ("name", "asset_type", "purchase_price", "purchased_on")


def _ensure_valid(asset: Asset) -> None:
    if asset.purchased_on > date.today():
        raise AppError.bad_request("Purchase date cannot be in the future")
    if asset.expected_life_months and asset.target_cost_per_day:
        raise AppError.bad_request(GOAL_CONFLICT.capitalize())


def list_assets(db: Session, user_id: str) -> list[Asset]:
    return list(
        db.scalars(
            select(Asset)
            .where(Asset.user_id == user_id, Asset.status == ASSET_STATUS_ACTIVE)
            .order_by(Asset.purchased_on.desc())
        ).all()
    )


def get_owned_asset(db: Session, user_id: str, asset_id: str) -> Asset:
    asset = db.scalar(select(Asset).where(Asset.id == asset_id, Asset.user_id == user_id))
    if not asset:
        raise AppError.not_found("Asset not found")
    return asset


def create_asset(db: Session, user_id: str, payload: AssetCreate) -> Asset:
    asset = Asset(user_id=user_id, **payload.model_dump())
    _ensure_valid(asset)
    db.add(asset)
    db.flush()
    return asset


def update_asset(db: Session, user_id: str, asset_id: str, payload: AssetUpdate) -> Asset:
    asset = get_owned_asset(db, user_id, asset_id)
    changes = payload.model_dump(exclude_unset=True)
    for field in REQUIRED_FIELDS:
        if field in changes and changes[field] is None:
            raise AppError.bad_request(f"{field.replace('_', ' ').capitalize()} cannot be empty")
    for field, value in changes.items():
        setattr(asset, field, value)
    _ensure_valid(asset)
    return asset


def archive_asset(db: Session, user_id: str, asset_id: str) -> Asset:
    asset = get_owned_asset(db, user_id, asset_id)
    asset.status = ASSET_STATUS_ARCHIVED
    return asset
