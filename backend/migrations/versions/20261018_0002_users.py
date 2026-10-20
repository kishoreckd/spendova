"""Add authenticated user profiles.

Revision ID: 20261018_0002
Revises: 20261018_0001
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20261018_0002"
down_revision: str | None = "20261018_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("display_name", sa.String(120)),
        sa.Column("photo_url", sa.String(1000)),
        sa.Column("base_currency", sa.String(3), nullable=False),
        sa.Column("country_code", sa.String(2)),
        sa.Column("locale", sa.String(20), nullable=False),
        sa.Column("time_zone", sa.String(80), nullable=False),
        sa.Column("onboarding_completed", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)


def downgrade() -> None:
    op.drop_table("users")
