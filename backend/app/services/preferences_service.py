from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.db.models.preferences_model import AiDay, Preferences
from app.db.models.user_model import User
from app.schemas.preferences import PreferencesRead, PreferencesUpdate
from app.services.ai_quota_service import limit_for, period


def read(db: Session, user_id: str) -> PreferencesRead:
    if not db.get(User, user_id):
        raise AppError.not_found("Profile not found")
    prefs = db.get(Preferences, user_id)
    day, reset = period()
    usage = db.get(AiDay, (user_id, day))
    used = usage.charged_tokens if usage else 0
    limit = limit_for(prefs)
    return PreferencesRead(
        daily_token_limit=limit,
        max_daily_tokens=get_settings().finance_assistant_max_daily_tokens,
        bills=prefs.bills if prefs else False,
        deposits=prefs.deposits if prefs else False,
        budgets=prefs.budgets if prefs else False,
        weekly=prefs.weekly if prefs else False,
        tokens_used=used,
        tokens_remaining=max(0, limit - used),
        resets_at=reset,
        reset_timezone=get_settings().finance_assistant_reset_timezone,
        ai_available=bool(get_settings().openai_api_key),
    )


def save(db: Session, user_id: str, payload: PreferencesUpdate):
    if not db.get(User, user_id):
        raise AppError.not_found("Profile not found")
    if payload.daily_token_limit > get_settings().finance_assistant_max_daily_tokens:
        raise AppError.bad_request("Daily token limit exceeds the server maximum")
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert

    insert = pg_insert if db.get_bind().dialect.name == "postgresql" else sqlite_insert
    values = payload.model_dump()
    db.execute(
        insert(Preferences)
        .values(user_id=user_id, **values)
        .on_conflict_do_update(index_elements=[Preferences.user_id], set_=values)
    )
