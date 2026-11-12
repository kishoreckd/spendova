import json
from unittest.mock import MagicMock

import pytest

from app.api.health import health
from app.services import health_service


@pytest.mark.parametrize(
    ("tables", "applied", "schema", "migrations"),
    [
        ([], [], "missing_tables", "not_initialized"),
        (["users", "alembic_version"], ["old"], "missing_tables", "out_of_date"),
        (None, ["current"], "ready", "up_to_date"),
        (None, ["unexpected"], "ready", "out_of_date"),
    ],
)
def test_readiness_checks_tables_and_revision(monkeypatch, tables, applied, schema, migrations):
    if tables is None:
        tables = [*health_service.Base.metadata.tables, "alembic_version"]
    inspector = MagicMock()
    inspector.get_table_names.return_value = tables
    monkeypatch.setattr(health_service, "inspect", lambda connection: inspector)
    monkeypatch.setattr(health_service, "expected_migrations", lambda: frozenset({"current"}))
    db = MagicMock()
    db.execute.return_value.scalars.return_value = applied
    assert health_service.database_readiness(db) == {"schema": schema, "migrations": migrations}


def test_missing_schema_returns_degraded_health_without_secrets(monkeypatch):
    monkeypatch.setattr(
        "app.api.health.database_readiness",
        lambda db: {"schema": "missing_tables", "migrations": "not_initialized"},
    )
    response = health(MagicMock())
    assert response.status_code == 503
    data = json.loads(response.body)["data"]
    assert data["db"] == "ok" and data["status"] == "degraded"
    assert "DATABASE_URL" not in str(data)
