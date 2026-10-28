from fastapi import APIRouter, Request, Response

from app.core.deps import Auth, DbSession
from app.schemas.categories import CategoryCreate, CategoryRead, CategoryUpdate
from app.services import categories_service as service
from app.services.audit_service import AuditAction, record

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead])
def list_categories(auth: Auth, db: DbSession):
    categories = service.list_categories(db, auth.id)
    db.commit()  # Persist any default categories seeded on first use.
    return categories


@router.post("", response_model=CategoryRead, status_code=201)
def create_category(payload: CategoryCreate, request: Request, auth: Auth, db: DbSession):
    category = service.create_category(db, auth.id, payload)
    record(db, request, AuditAction.CATEGORY_CREATE, user_id=auth.id, target_type="category", target_id=category.id)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=CategoryRead)
def update_category(category_id: str, payload: CategoryUpdate, request: Request, auth: Auth, db: DbSession):
    category = service.update_category(db, auth.id, category_id, payload)
    record(
        db,
        request,
        AuditAction.CATEGORY_UPDATE,
        user_id=auth.id,
        target_type="category",
        target_id=category.id,
        details={"fields": sorted(payload.model_dump(exclude_unset=True))},
    )
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=204)
def archive_category(category_id: str, request: Request, auth: Auth, db: DbSession) -> Response:
    service.archive_category(db, auth.id, category_id)
    record(db, request, AuditAction.CATEGORY_ARCHIVE, user_id=auth.id, target_type="category", target_id=category_id)
    db.commit()
    return Response(status_code=204)
