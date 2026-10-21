"""Reference accounts by ID instead of ambiguous names.

Revision ID: 20261021_0011
Revises: 20261021_0010
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20261021_0011"
down_revision: str | None = "20261021_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _add_account_references(table: str) -> None:
    for side in ("source", "destination"):
        column = f"{side}_account_id"
        op.add_column(table, sa.Column(column, sa.String(36), nullable=True))
        op.create_foreign_key(
            f"fk_{table}_{column}", table, "accounts", [column], ["id"], ondelete="SET NULL"
        )
        op.create_index(f"ix_{table}_{column}", table, [column])
        op.execute(sa.text(f"""
            UPDATE {table} AS item
            SET {column} = (
                SELECT MIN(account.id)
                FROM accounts AS account
                WHERE account.user_id = item.user_id
                  AND account.name = item.{side}
            )
        """))


def upgrade() -> None:
    _add_account_references("transactions")
    _add_account_references("recurring_rules")


def downgrade() -> None:
    for table in ("recurring_rules", "transactions"):
        for side in ("destination", "source"):
            column = f"{side}_account_id"
            op.drop_index(f"ix_{table}_{column}", table_name=table)
            op.drop_constraint(f"fk_{table}_{column}", table, type_="foreignkey")
            op.drop_column(table, column)
