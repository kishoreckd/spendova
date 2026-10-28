from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.constants.finance import DEFAULT_CATEGORIES
from app.core.errors import AppError
from app.db.models.category_model import Category
from app.schemas.categories import CategoryCreate, CategoryUpdate

DUPLICATE_NAME = "A category with this name already exists"


def ensure_default_categories(db: Session, user_id: str) -> None:
    """Seeds any missing defaults. Safe when two first requests race each other."""
    existing = set(
        db.execute(select(Category.name, Category.category_type).where(Category.user_id == user_id)).tuples()
    )
    missing = [
        Category(user_id=user_id, name=name, category_type=kind, icon=icon, color=color, is_default=True)
        for name, kind, icon, color in DEFAULT_CATEGORIES
        if (name, kind) not in existing
    ]
    if not missing:
        return
    try:
        with db.begin_nested():
            db.add_all(missing)
    except IntegrityError:
        pass  # A concurrent request seeded them first.


def list_categories(db: Session, user_id: str) -> list[Category]:
    ensure_default_categories(db, user_id)
    return list(
        db.scalars(
            select(Category)
            .where(Category.user_id == user_id, Category.archived.is_(False))
            .order_by(Category.category_type, Category.name)
        ).all()
    )


def get_owned_category(db: Session, user_id: str, category_id: str) -> Category:
    category = db.scalar(select(Category).where(Category.id == category_id, Category.user_id == user_id))
    if not category:
        raise AppError.not_found("Category not found")
    return category


def require_category(db: Session, user_id: str, category_id: str, kind: str, mismatch: str) -> Category:
    """For transactions and commitments: the category must be the user's and match the money flow."""
    category = db.scalar(select(Category).where(Category.id == category_id, Category.user_id == user_id))
    if not category:
        raise AppError.bad_request("Category does not belong to this user")
    if category.category_type != kind:
        raise AppError.bad_request(mismatch)
    return category


def create_category(db: Session, user_id: str, payload: CategoryCreate) -> Category:
    category = Category(user_id=user_id, **payload.model_dump())
    try:
        with db.begin_nested():
            db.add(category)
    except IntegrityError:
        raise AppError.conflict(DUPLICATE_NAME) from None
    return category


def update_category(db: Session, user_id: str, category_id: str, payload: CategoryUpdate) -> Category:
    category = get_owned_category(db, user_id, category_id)
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is None:
        raise AppError.bad_request("Name cannot be empty")
    try:
        with db.begin_nested():
            for field, value in changes.items():
                setattr(category, field, value)
    except IntegrityError:
        raise AppError.conflict(DUPLICATE_NAME) from None
    return category


def archive_category(db: Session, user_id: str, category_id: str) -> Category:
    category = get_owned_category(db, user_id, category_id)
    category.archived = True
    return category
