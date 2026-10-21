"""Add an optional replacement goal to owned assets.

Revision ID: 20261020_0006
Revises: 20261020_0005
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20261020_0006"
down_revision: str | None = "20261020_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("assets")}
    with op.batch_alter_table("assets") as batch:
        if "expected_life_months" not in columns:
            batch.add_column(sa.Column("expected_life_months", sa.Integer(), nullable=True))
        if "target_cost_per_day" not in columns:
            batch.add_column(sa.Column("target_cost_per_day", sa.Numeric(19, 4), nullable=True))
        batch.create_check_constraint(
            "ck_assets_single_replacement_goal",
            "expected_life_months IS NULL OR target_cost_per_day IS NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("assets") as batch:
        batch.drop_constraint("ck_assets_single_replacement_goal", type_="check")
        batch.drop_column("target_cost_per_day")
        batch.drop_column("expected_life_months")
