"""Add budgets, recurring rules, and goal contributions.

Revision ID: 20261020_0003
Revises: 20261018_0002
"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "20261020_0003"
down_revision: str | None = "20261018_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "budgets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(128), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("month", sa.Date(), nullable=False),
        sa.Column("total_limit", sa.Numeric(19, 4), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "month", name="uq_budget_user_month"),
    )
    op.create_index("ix_budgets_user_id", "budgets", ["user_id"])
    op.create_table(
        "budget_lines",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("budget_id", sa.String(36), sa.ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", sa.String(36), sa.ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("amount_limit", sa.Numeric(19, 4), nullable=False),
        sa.UniqueConstraint("budget_id", "category_id", name="uq_budget_line_category"),
    )
    op.create_index("ix_budget_lines_budget_id", "budget_lines", ["budget_id"])
    op.create_index("ix_budget_lines_category_id", "budget_lines", ["category_id"])
    op.create_table(
        "recurring_rules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(128), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("amount", sa.Numeric(19, 4), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("frequency", sa.String(20), nullable=False),
        sa.Column("interval", sa.Integer(), nullable=False),
        sa.Column("next_due_on", sa.Date(), nullable=False),
        sa.Column("source", sa.String(100), nullable=False),
        sa.Column("destination", sa.String(100), nullable=False),
        sa.Column("category_id", sa.String(36), sa.ForeignKey("categories.id", ondelete="SET NULL")),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_recurring_rules_user_id", "recurring_rules", ["user_id"])
    op.create_index("ix_recurring_rules_category_id", "recurring_rules", ["category_id"])
    op.create_index("ix_recurring_user_due", "recurring_rules", ["user_id", "active", "next_due_on"])
    op.create_table(
        "goal_contributions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("goal_id", sa.String(36), sa.ForeignKey("goals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(128), nullable=False),
        sa.Column("amount", sa.Numeric(19, 4), nullable=False),
        sa.Column("contributed_on", sa.Date(), nullable=False),
        sa.Column("note", sa.String(250)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_goal_contributions_goal_id", "goal_contributions", ["goal_id"])
    op.create_index("ix_goal_contributions_user_id", "goal_contributions", ["user_id"])


def downgrade() -> None:
    op.drop_table("goal_contributions")
    op.drop_table("recurring_rules")
    op.drop_table("budget_lines")
    op.drop_table("budgets")
