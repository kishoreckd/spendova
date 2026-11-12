from datetime import datetime

from pydantic import Field

from app.core.schema import ApiModel, RequestModel


class PreferencesUpdate(RequestModel):
    daily_token_limit: int = Field(ge=0, le=1000000)
    bills: bool
    deposits: bool
    budgets: bool
    weekly: bool


class PreferencesRead(ApiModel):
    daily_token_limit: int
    max_daily_tokens: int
    bills: bool
    deposits: bool
    budgets: bool
    weekly: bool
    tokens_used: int
    tokens_remaining: int
    resets_at: datetime
    reset_timezone: str
    ai_available: bool
