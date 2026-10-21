"""Link transactions to recurring commitments.

Revision ID: 20261021_0009
Revises: 20261021_0008
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20261021_0009"
down_revision: str | None = "20261021_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("recurring_rule_id", sa.String(36), nullable=True))
    op.create_foreign_key(
        "fk_transactions_recurring_rule_id",
        "transactions", "recurring_rules",
        ["recurring_rule_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_transactions_recurring_rule_id", "transactions", ["recurring_rule_id"])


def downgrade() -> None:
    op.drop_index("ix_transactions_recurring_rule_id", table_name="transactions")
    op.drop_constraint("fk_transactions_recurring_rule_id", "transactions", type_="foreignkey")
    op.drop_column("transactions", "recurring_rule_id")
