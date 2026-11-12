"""Persistent preferences, daily AI quota, and reminder deduplication.
Revision ID: 20261105_0015
Revises: 20261028_0014
"""

import sqlalchemy as sa
from alembic import op

revision = "20261105_0015"
down_revision = "20261028_0014"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "preferences",
        sa.Column("user_id", sa.String(128), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("daily_token_limit", sa.Integer(), nullable=False),
        *[sa.Column(name, sa.Boolean(), nullable=False) for name in ("bills", "deposits", "budgets", "weekly")],
    )
    op.create_table(
        "ai_daily_usage",
        sa.Column("user_id", sa.String(128), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("day", sa.Date(), primary_key=True),
        sa.Column("charged_tokens", sa.Integer(), nullable=False),
    )
    op.create_table(
        "ai_charges",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("reserved", sa.Integer(), nullable=False),
        sa.Column("settled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_charges_user_id", "ai_charges", ["user_id"])
    op.create_table(
        "reminder_receipts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_key", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "event_key", name="uq_reminder_user_event"),
    )
    op.create_index("ix_reminder_receipts_user_id", "reminder_receipts", ["user_id"])


def downgrade():
    for table in ("reminder_receipts", "ai_charges", "ai_daily_usage", "preferences"):
        op.drop_table(table)
