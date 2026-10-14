"""add park_maps.places and brochure_maps

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "park_maps",
        sa.Column("places", postgresql.JSONB(), nullable=False, server_default="[]"),
    )
    op.create_table(
        "brochure_maps",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "site_id",
            sa.Integer(),
            sa.ForeignKey("sites.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("asset_id", sa.String(length=64), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("image", sa.LargeBinary(), nullable=False),
        sa.Column(
            "synced_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("site_id", "asset_id", name="uq_brochure_maps_site_asset"),
    )
    op.create_index("ix_brochure_maps_site_id", "brochure_maps", ["site_id"])


def downgrade() -> None:
    op.drop_index("ix_brochure_maps_site_id", table_name="brochure_maps")
    op.drop_table("brochure_maps")
    op.drop_column("park_maps", "places")
