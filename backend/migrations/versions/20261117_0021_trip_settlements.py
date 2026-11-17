"""trip_settlements

Revision ID: 20261117_0021
Revises: 20261117_0020
Create Date: 2026-11-17 20:40:05.509250
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261117_0021"
down_revision: str | None = "20261117_0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "trip_settlements",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("trip_id", sa.String(length=36), nullable=False),
        sa.Column("from_participant_id", sa.String(length=36), nullable=False),
        sa.Column("to_participant_id", sa.String(length=36), nullable=False),
        sa.Column("amount", sa.Numeric(precision=19, scale=4), nullable=False),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["from_participant_id"], ["trip_participants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_participant_id"], ["trip_participants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("trip_settlements", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_trip_settlements_from_participant_id"), ["from_participant_id"])
        batch_op.create_index(batch_op.f("ix_trip_settlements_to_participant_id"), ["to_participant_id"])
        batch_op.create_index(batch_op.f("ix_trip_settlements_trip_id"), ["trip_id"])


def downgrade() -> None:
    with op.batch_alter_table("trip_settlements", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_trip_settlements_trip_id"))
        batch_op.drop_index(batch_op.f("ix_trip_settlements_to_participant_id"))
        batch_op.drop_index(batch_op.f("ix_trip_settlements_from_participant_id"))
    op.drop_table("trip_settlements")
