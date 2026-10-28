from datetime import datetime
from enum import StrEnum

from fastapi import Request
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.db.models.audit_log_model import AuditLog


class AuditAction(StrEnum):
    USER_SIGN_UP = "USER_SIGN_UP"
    PROFILE_UPDATE = "PROFILE_UPDATE"
    EMAIL_VERIFIED = "EMAIL_VERIFIED"
    PASSWORD_RESET_REQUEST = "PASSWORD_RESET_REQUEST"  # noqa: S105 - action name, not a secret
    PASSWORD_RESET_COMPLETE = "PASSWORD_RESET_COMPLETE"  # noqa: S105

    ACCOUNT_CREATE = "ACCOUNT_CREATE"
    ACCOUNT_ARCHIVE = "ACCOUNT_ARCHIVE"
    CATEGORY_CREATE = "CATEGORY_CREATE"
    CATEGORY_UPDATE = "CATEGORY_UPDATE"
    CATEGORY_ARCHIVE = "CATEGORY_ARCHIVE"
    TRANSACTION_CREATE = "TRANSACTION_CREATE"
    TRANSACTION_VOID = "TRANSACTION_VOID"
    RECURRING_CREATE = "RECURRING_CREATE"
    RECURRING_PAY = "RECURRING_PAY"
    RECURRING_STOP = "RECURRING_STOP"
    BUDGET_CREATE = "BUDGET_CREATE"
    BUDGET_DELETE = "BUDGET_DELETE"
    GOAL_CREATE = "GOAL_CREATE"
    GOAL_DELETE = "GOAL_DELETE"
    GOAL_CONTRIBUTE = "GOAL_CONTRIBUTE"
    ASSET_CREATE = "ASSET_CREATE"
    ASSET_UPDATE = "ASSET_UPDATE"
    ASSET_ARCHIVE = "ASSET_ARCHIVE"
    LOAN_CREATE = "LOAN_CREATE"
    LOAN_PAY = "LOAN_PAY"
    LOAN_CLOSE = "LOAN_CLOSE"


def client_meta(request: Request) -> tuple[str | None, str | None]:
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return ip, user_agent[:512] if user_agent else None


def record(
    db: Session,
    request: Request,
    action: AuditAction,
    *,
    user_id: str | None,
    target_type: str | None = None,
    target_id: str | None = None,
    details: dict | None = None,
) -> None:
    """Adds an audit row to the current transaction; it commits with the change it describes.

    Never put codes, tokens, passwords, or full card/account numbers in `details`.
    """
    ip, user_agent = client_meta(request)
    db.add(
        AuditLog(
            user_id=user_id,
            action=action.value,
            target_type=target_type,
            target_id=str(target_id) if target_id else None,
            ip=ip,
            user_agent=user_agent,
            details=details,
        )
    )


def list_entries(db: Session, user_id: str, limit: int, cursor: str | None) -> tuple[list[AuditLog], str | None]:
    query = select(AuditLog).where(AuditLog.user_id == user_id)
    if cursor:
        anchor = db.get(AuditLog, cursor)
        if anchor and anchor.user_id == user_id:
            query = query.where(_older_than(anchor.created_at, anchor.id))
    rows = list(db.scalars(query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(limit + 1)))
    items = rows[:limit]
    return items, (items[-1].id if len(rows) > limit else None)


def _older_than(created_at: datetime, row_id: str):
    return or_(AuditLog.created_at < created_at, and_(AuditLog.created_at == created_at, AuditLog.id < row_id))
