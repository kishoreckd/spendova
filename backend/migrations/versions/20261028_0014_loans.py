"""Track loans and products bought on EMI.

Revision ID: 20261028_0014
Revises: 20261028_0013
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261028_0014"
down_revision: str | None = "20261028_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "loans",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("loan_type", sa.String(30), nullable=False),
        sa.Column("lender", sa.String(100), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("principal", sa.Numeric(19, 4), nullable=False),
        sa.Column("annual_interest_rate", sa.Numeric(7, 4), nullable=True),
        sa.Column("emi_amount", sa.Numeric(19, 4), nullable=False),
        sa.Column("tenure_months", sa.Integer(), nullable=False),
        sa.Column("first_due_on", sa.Date(), nullable=False),
        sa.Column("processing_fee", sa.Numeric(19, 4), nullable=False),
        sa.Column("installments_paid_before", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.String(36), sa.ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("asset_id", sa.String(36), sa.ForeignKey("assets.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "recurring_rule_id",
            sa.String(36),
            sa.ForeignKey("recurring_rules.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_loans_user_id", "loans", ["user_id"])
    op.create_index("ix_loans_user_status", "loans", ["user_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_loans_user_status", table_name="loans")
    op.drop_index("ix_loans_user_id", table_name="loans")
    op.drop_table("loans")
