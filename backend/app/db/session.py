from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool, StaticPool

from app.core.config import get_settings

settings = get_settings()
DATABASE_URL = settings.database_url
engine_options: dict[str, object] = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}
    if DATABASE_URL.endswith(":memory:"):
        engine_options["poolclass"] = StaticPool
else:
    # Supabase's transaction pooler (port 6543) can't keep server-side prepared statements.
    engine_options["connect_args"] = {"prepare_threshold": None}
    if settings.vercel:
        # Each serverless instance is short-lived; let Supabase's pooler do the pooling.
        engine_options["poolclass"] = NullPool

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)

if engine.dialect.name == "sqlite":

    @event.listens_for(engine, "connect")
    def _enforce_foreign_keys(connection, _record) -> None:
        # SQLite ignores foreign keys unless asked; PostgreSQL always enforces them.
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """One session per request. Routers commit; services only add/flush."""
    with SessionLocal() as session:
        yield session
