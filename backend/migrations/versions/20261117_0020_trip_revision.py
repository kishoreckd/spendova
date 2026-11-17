"""trip_revision

Revision ID: 20261117_0020
Revises: 20261117_0019
Create Date: 2026-11-17 20:40:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261117_0020"
down_revision: str | None = "20261117_0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("trips", schema=None) as batch_op:
        batch_op.add_column(sa.Column("revision", sa.Integer(), server_default="0", nullable=False))


def downgrade() -> None:
    with op.batch_alter_table("trips", schema=None) as batch_op:
        batch_op.drop_column("revision")
