import os
import tempfile
from pathlib import Path

# Must be set before the app (and its settings/engine) is imported. These override backend/.env.
_SQLITE_FILE = Path(tempfile.gettempdir()) / f"spendova-test-{os.getpid()}.db"
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", f"sqlite:///{_SQLITE_FILE.as_posix()}")
os.environ["AUTH_REQUIRED"] = "false"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["EMAIL_OUTBOX_WORKER_ENABLED"] = "false"
# Never send real email or touch real Firebase from tests.
os.environ["EMAIL_DELIVERY_MODE"] = "console"
os.environ["SMTP_HOST"] = ""
os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = ""
os.environ["APP_URL"] = "http://localhost:5173"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.rate_limit import auth_limit, global_limit  # noqa: E402
from app.db.session import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services import email_service  # noqa: E402
from app.services.email_service import EmailDeliveryResult  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def database():
    """Fresh schema built by the real Alembic migrations (so migrations are tested too)."""
    if engine.dialect.name == "sqlite":
        engine.dispose()
        _SQLITE_FILE.unlink(missing_ok=True)
    else:
        with engine.begin() as conn:
            conn.execute(text("DROP SCHEMA public CASCADE"))
            conn.execute(text("CREATE SCHEMA public"))
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    config.attributes["configure_logger"] = False
    command.upgrade(config, "head")
    yield
    engine.dispose()
    _SQLITE_FILE.unlink(missing_ok=True)


@pytest.fixture
def api(database):
    """HTTP client against an emptied database."""
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
    global_limit.reset()
    auth_limit.reset()
    with TestClient(app) as client:
        yield client


@pytest.fixture
def mailbox(monkeypatch):
    """Captures every email the outbox delivers as (to, subject, text, html)."""
    sent: list[tuple[str, str, str, str | None]] = []

    def capture(to: str, subject: str, text: str, html: str | None = None) -> EmailDeliveryResult:
        sent.append((to, subject, text, html))
        return EmailDeliveryResult("accepted", "Captured by tests")

    monkeypatch.setattr(email_service, "send_email", capture)
    return sent
