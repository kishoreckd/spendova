"""Operational response DTOs; shared envelope is added in the OpenAPI document."""

from datetime import datetime
from typing import Literal

from app.core.schema import ApiModel


class HealthRead(ApiModel):
    status: Literal["ok"]
    version: str
    time: datetime
    db: Literal["ok"]
    email: Literal["configured", "not_configured"]


class EmailHealthRead(ApiModel):
    stage: Literal["complete"]
    host: str
    port: str
    cache_seconds: int


class TestEmailRead(ApiModel):
    submission: Literal["accepted"]
    message_id: str | None
    test_id: str
