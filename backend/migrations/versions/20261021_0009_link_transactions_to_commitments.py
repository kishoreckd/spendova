"""Link transactions to recurring commitments.

Revision ID: 20261021_0009
Revises: 20261021_0008
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261021_0009"
down_revision: str | None = "20261021_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Batch mode lets SQLite (tests, local dev) apply the same change PostgreSQL runs directly.
    with op.batch_alter_table("transactions") as batch:
        batch.add_column(sa.Column("recurring_rule_id", sa.String(36), nullable=True))
        batch.create_foreign_key(
            "fk_transactions_recurring_rule_id", "recurring_rules", ["recurring_rule_id"], ["id"], ondelete="SET NULL"
        )
        batch.create_index("ix_transactions_recurring_rule_id", ["recurring_rule_id"])


def downgrade() -> None:
    with op.batch_alter_table("transactions") as batch:
        batch.drop_index("ix_transactions_recurring_rule_id")
        batch.drop_constraint("fk_transactions_recurring_rule_id", type_="foreignkey")
        batch.drop_column("recurring_rule_id")
