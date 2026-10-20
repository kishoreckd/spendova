"""Enforce user ownership on all user-scoped records.

Revision ID: 20261020_0005
Revises: 20261020_0004
"""
from collections.abc import Sequence

from alembic import op

revision: str = "20261020_0005"
down_revision: str | None = "20261020_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = (
    "accounts",
    "categories",
    "transactions",
    "goals",
    "assets",
    "budgets",
    "recurring_rules",
    "goal_contributions",
)


def upgrade() -> None:
    for table in TABLES:
        with op.batch_alter_table(table) as batch:
            batch.create_foreign_key(
                f"fk_{table}_user_id_users",
                "users",
                ["user_id"],
                ["id"],
                ondelete="CASCADE",
            )


def downgrade() -> None:
    for table in reversed(TABLES):
        with op.batch_alter_table(table) as batch:
            batch.drop_constraint(f"fk_{table}_user_id_users", type_="foreignkey")
