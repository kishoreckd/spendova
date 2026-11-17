"""trusted two-factor devices

Revision ID: 20261117_0019
Revises: 20261117_0018
Create Date: 2026-11-17
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261117_0019"
down_revision: str | None = "20261117_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "trusted_two_factor_devices",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("token_digest", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_trusted_two_factor_devices_user_id", "trusted_two_factor_devices", ["user_id"])
    op.create_index(
        "ix_trusted_two_factor_devices_token_digest",
        "trusted_two_factor_devices",
        ["token_digest"],
        unique=True,
    )
    op.create_index(
        "ix_trusted_two_factor_devices_expires_at",
        "trusted_two_factor_devices",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_trusted_two_factor_devices_expires_at", table_name="trusted_two_factor_devices")
    op.drop_index("ix_trusted_two_factor_devices_token_digest", table_name="trusted_two_factor_devices")
    op.drop_index("ix_trusted_two_factor_devices_user_id", table_name="trusted_two_factor_devices")
    op.drop_table("trusted_two_factor_devices")
