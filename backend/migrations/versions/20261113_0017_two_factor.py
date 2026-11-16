"""two_factor

Revision ID: 20261113_0017
Revises: 20261111_0016
Create Date: 2026-11-13 16:42:00.926148
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261113_0017"
down_revision: str | None = "20261111_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "two_factor",
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("method", sa.String(length=10), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("totp_secret", sa.Text(), nullable=True),
        sa.Column("totp_last_counter", sa.Integer(), nullable=True),
        sa.Column("recovery_hashes", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_table(
        "two_factor_challenges",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("code_digest", sa.String(length=64), nullable=True),
        sa.Column("code_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("two_factor_challenges", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_two_factor_challenges_user_id"), ["user_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("two_factor_challenges", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_two_factor_challenges_user_id"))
    op.drop_table("two_factor_challenges")
    op.drop_table("two_factor")
