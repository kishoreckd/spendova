"""Database-atomic allowance. Reserve before network I/O; settle only known usage.

Reservations use UTF-8 bytes of the complete request plus protocol overhead and output cap.
They deliberately overestimate tokens. Ambiguous/failed calls keep their reservation to avoid
free repeated requests after timeouts. Settlement is idempotent. No scheduler resets counters:
the next configured calendar day uses a new (user, day) row.
"""

from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.core.config import get_settings
from app.core.errors import AppError
from app.db.models.preferences_model import AiCharge, AiDay, Preferences
from app.db.session import SessionLocal


def period(now: datetime | None = None):
    zone = ZoneInfo(get_settings().finance_assistant_reset_timezone)
    today = (now or datetime.now(UTC)).astimezone(zone).date()
    reset = datetime.combine(today + timedelta(days=1), time.min, zone)
    return today, reset


def limit_for(preferences: Preferences | None) -> int:
    config = get_settings()
    selected = preferences.daily_token_limit if preferences else config.finance_assistant_daily_token_limit
    return min(selected, config.finance_assistant_max_daily_tokens)


def reserve(user_id: str, tokens: int, now: datetime | None = None) -> str:
    day, reset = period(now)
    with SessionLocal() as db:
        preferences = db.get(Preferences, user_id)
        limit = limit_for(preferences)
        insert = pg_insert if db.get_bind().dialect.name == "postgresql" else sqlite_insert
        db.execute(insert(AiDay).values(user_id=user_id, day=day, charged_tokens=0).on_conflict_do_nothing())
        changed = db.execute(
            update(AiDay)
            .where(AiDay.user_id == user_id, AiDay.day == day, AiDay.charged_tokens + tokens <= limit)
            .values(charged_tokens=AiDay.charged_tokens + tokens)
        )
        if changed.rowcount != 1:
            raise AppError(429, "AI_DAILY_LIMIT", f"Daily AI allowance is insufficient. Resets at {reset.isoformat()}.")
        charge = AiCharge(user_id=user_id, day=day, reserved=tokens)
        db.add(charge)
        db.commit()
        return charge.id


def settle(charge_id: str, actual: int | None) -> None:
    if actual is None:
        return
    with SessionLocal() as db:
        charge = db.get(AiCharge, charge_id)
        if not charge or actual < 0 or actual > charge.reserved:
            return
        changed = db.execute(
            update(AiCharge).where(AiCharge.id == charge_id, AiCharge.settled.is_(False)).values(settled=True)
        )
        if changed.rowcount == 1:
            db.execute(
                update(AiDay)
                .where(AiDay.user_id == charge.user_id, AiDay.day == charge.day)
                .values(charged_tokens=AiDay.charged_tokens - (charge.reserved - actual))
            )
        db.commit()
