"""Add loan, FD, and RD account details.

Revision ID: 20261021_0010
Revises: 20261021_0009
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20261021_0010"
down_revision: str | None = "20261021_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("institution", sa.String(100)))
    op.add_column("accounts", sa.Column("principal_amount", sa.Numeric(19, 4)))
    op.add_column("accounts", sa.Column("annual_interest_rate", sa.Numeric(7, 4)))
    op.add_column("accounts", sa.Column("started_on", sa.Date()))
    op.add_column("accounts", sa.Column("maturity_on", sa.Date()))
    op.add_column("accounts", sa.Column("tenure_months", sa.Integer()))
    op.add_column("accounts", sa.Column("installment_amount", sa.Numeric(19, 4)))


def downgrade() -> None:
    for column in ("installment_amount", "tenure_months", "maturity_on", "started_on", "annual_interest_rate", "principal_amount", "institution"):
        op.drop_column("accounts", column)
