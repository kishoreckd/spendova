"""trip planner

Revision ID: 20261117_0018
Revises: 20261113_0017
Create Date: 2026-11-17
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261117_0018"
down_revision: str | None = "20261113_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "trips",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("destination", sa.String(length=160), nullable=True),
        sa.Column("start_on", sa.Date(), nullable=True),
        sa.Column("end_on", sa.Date(), nullable=True),
        sa.Column("mode", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("budget", sa.Numeric(precision=19, scale=4), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_trips_user_id", "trips", ["user_id"])
    op.create_index("ix_trips_status", "trips", ["status"])
    op.create_table(
        "trip_participants",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("trip_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("is_user", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("trip_id", "name", name="uq_trip_participant_name"),
    )
    op.create_index("ix_trip_participants_trip_id", "trip_participants", ["trip_id"])
    op.create_table(
        "trip_expenses",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("trip_id", sa.String(length=36), nullable=False),
        sa.Column("description", sa.String(length=160), nullable=False),
        sa.Column("category", sa.String(length=60), nullable=False),
        sa.Column("amount", sa.Numeric(precision=19, scale=4), nullable=False),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("payer_participant_id", sa.String(length=36), nullable=False),
        sa.Column("category_id", sa.String(length=36), nullable=False),
        sa.Column("split_mode", sa.String(length=20), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("posted_transaction_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["payer_participant_id"], ["trip_participants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["posted_transaction_id"], ["transactions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("posted_transaction_id"),
    )
    op.create_index("ix_trip_expenses_trip_id", "trip_expenses", ["trip_id"])
    op.create_index("ix_trip_expenses_payer_participant_id", "trip_expenses", ["payer_participant_id"])
    op.create_index("ix_trip_expenses_category_id", "trip_expenses", ["category_id"])
    op.create_table(
        "trip_expense_shares",
        sa.Column("expense_id", sa.String(length=36), nullable=False),
        sa.Column("participant_id", sa.String(length=36), nullable=False),
        sa.Column("amount", sa.Numeric(precision=19, scale=4), nullable=False),
        sa.ForeignKeyConstraint(["expense_id"], ["trip_expenses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["participant_id"], ["trip_participants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("expense_id", "participant_id"),
    )
    op.create_index("ix_trip_expense_shares_participant_id", "trip_expense_shares", ["participant_id"])


def downgrade() -> None:
    op.drop_index("ix_trip_expense_shares_participant_id", table_name="trip_expense_shares")
    op.drop_table("trip_expense_shares")
    op.drop_index("ix_trip_expenses_category_id", table_name="trip_expenses")
    op.drop_index("ix_trip_expenses_payer_participant_id", table_name="trip_expenses")
    op.drop_index("ix_trip_expenses_trip_id", table_name="trip_expenses")
    op.drop_table("trip_expenses")
    op.drop_index("ix_trip_participants_trip_id", table_name="trip_participants")
    op.drop_table("trip_participants")
    op.drop_index("ix_trips_status", table_name="trips")
    op.drop_index("ix_trips_user_id", table_name="trips")
    op.drop_table("trips")
