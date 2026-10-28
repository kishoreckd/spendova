from fastapi import APIRouter, Request, Response

from app.core.deps import Auth, DbSession
from app.schemas.assets import AssetCreate, AssetRead, AssetUpdate
from app.services import assets_service as service
from app.services.audit_service import AuditAction, record

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=list[AssetRead])
def list_assets(auth: Auth, db: DbSession):
    return service.list_assets(db, auth.id)


@router.post("", response_model=AssetRead, status_code=201)
def create_asset(payload: AssetCreate, request: Request, auth: Auth, db: DbSession):
    asset = service.create_asset(db, auth.id, payload)
    record(db, request, AuditAction.ASSET_CREATE, user_id=auth.id, target_type="asset", target_id=asset.id)
    db.commit()
    db.refresh(asset)
    return asset


@router.patch("/{asset_id}", response_model=AssetRead)
def update_asset(asset_id: str, payload: AssetUpdate, request: Request, auth: Auth, db: DbSession):
    asset = service.update_asset(db, auth.id, asset_id, payload)
    record(
        db,
        request,
        AuditAction.ASSET_UPDATE,
        user_id=auth.id,
        target_type="asset",
        target_id=asset.id,
        details={"fields": sorted(payload.model_dump(exclude_unset=True))},
    )
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=204)
def archive_asset(asset_id: str, request: Request, auth: Auth, db: DbSession) -> Response:
    service.archive_asset(db, auth.id, asset_id)
    record(db, request, AuditAction.ASSET_ARCHIVE, user_id=auth.id, target_type="asset", target_id=asset_id)
    db.commit()
    return Response(status_code=204)
