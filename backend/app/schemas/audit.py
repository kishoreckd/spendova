from datetime import datetime

from app.core.schema import ApiModel


class AuditEntry(ApiModel):
    id: str
    action: str
    target_type: str | None
    target_id: str | None
    ip: str | None
    user_agent: str | None
    details: dict | None
    created_at: datetime


class AuditPage(ApiModel):
    items: list[AuditEntry]
    next_cursor: str | None
