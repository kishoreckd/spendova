"""Add income and investment planning details.

Revision ID: 20261021_0008
Revises: 20261021_0007
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261021_0008"
down_revision: str | None = "20261021_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("recurring_rules", sa.Column("plan_type", sa.String(20), nullable=False, server_default="bill"))
    op.add_column("recurring_rules", sa.Column("cost_amount", sa.Numeric(19, 4)))
    op.add_column("recurring_rules", sa.Column("annual_return_rate", sa.Numeric(7, 4)))
    op.add_column("recurring_rules", sa.Column("tenure_months", sa.Integer()))
    op.execute(
        "UPDATE recurring_rules SET plan_type = CASE WHEN kind = 'income' THEN 'income' WHEN kind = 'transfer' THEN 'investment' ELSE 'bill' END"
    )
    # Batch mode lets SQLite (tests, local dev) apply the same change PostgreSQL runs directly.
    with op.batch_alter_table("recurring_rules") as batch:
        batch.alter_column("plan_type", server_default=None)


def downgrade() -> None:
    op.drop_column("recurring_rules", "tenure_months")
    op.drop_column("recurring_rules", "annual_return_rate")
    op.drop_column("recurring_rules", "cost_amount")
    op.drop_column("recurring_rules", "plan_type")
