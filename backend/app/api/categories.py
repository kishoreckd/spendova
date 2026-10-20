from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import CurrentUser, get_current_user
from ..db.session import get_db
from ..models import Category
from ..schemas import CategoryCreate, CategoryRead
from ..utils.validation.json_validator import ApiResponse, JsonResponse

router = APIRouter(prefix="/categories", tags=["categories"])

DEFAULT_CATEGORIES = (
    ("Housing", "expense", "house", "#0f766e"),
    ("Groceries", "expense", "shopping-basket", "#0891b2"),
    ("Transport", "expense", "car", "#7c3aed"),
    ("Utilities", "expense", "plug", "#ca8a04"),
    ("Healthcare", "expense", "heart-pulse", "#dc2626"),
    ("Entertainment", "expense", "clapperboard", "#db2777"),
    ("Salary", "income", "wallet-cards", "#059669"),
    ("Other income", "income", "circle-dollar-sign", "#16a34a"),
)


def ensure_default_categories(db: Session, user_id: str) -> None:
    if db.scalar(select(Category.id).where(Category.user_id == user_id).limit(1)):
        return
    db.add_all([
        Category(user_id=user_id, name=name, category_type=kind, icon=icon, color=color, is_default=True)
        for name, kind, icon, color in DEFAULT_CATEGORIES
    ])
    db.commit()


@router.get("", response_model=ApiResponse[list[CategoryRead]])
def list_categories(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_default_categories(db, user.id)
    query = select(Category).where(Category.user_id == user.id, Category.archived.is_(False)).order_by(Category.category_type, Category.name)
    return JsonResponse.success("Categories retrieved", db.scalars(query).all())


@router.post("", response_model=ApiResponse[CategoryRead], status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    record = Category(user_id=user.id, **payload.model_dump())
    db.add(record)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "A category with this name already exists") from exc
    db.refresh(record)
    return JsonResponse.success("Category created", record, status.HTTP_201_CREATED)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_category(category_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    record = db.scalar(select(Category).where(Category.id == category_id, Category.user_id == user.id))
    if not record:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    record.archived = True
    db.commit()
