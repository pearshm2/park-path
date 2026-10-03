"""add sites table

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sites",
        sa.Column("id", sa.Integer(), primary_key=True),
        # From the NPS API (refreshed by the sync job)
        sa.Column("park_code", sa.String(length=10), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("designation", sa.String(length=100), nullable=True),
        sa.Column("states", sa.String(length=100), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("nps_url", sa.String(length=500), nullable=True),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        # Curated by us (recommendation engine inputs)
        sa.Column("terrain_group", sa.String(length=50), nullable=True),
        sa.Column("feature", sa.String(length=100), nullable=True),
        sa.Column("effort", sa.Integer(), nullable=True),
        sa.Column("typical_days", sa.Integer(), nullable=True),
        sa.Column("seasons", postgresql.ARRAY(sa.String(length=10)), nullable=True),
        sa.Column("permit_required", sa.Boolean(), nullable=True),
        sa.Column("annual_visits_millions", sa.Float(), nullable=True),
    )
    op.create_index("ix_sites_park_code", "sites", ["park_code"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_sites_park_code", table_name="sites")
    op.drop_table("sites")
