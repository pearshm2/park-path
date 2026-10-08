"""add sites.is_named_park

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Curated, like terrain_group: set by `python -m app.curate_sites`,
    # never by the NPS sync.
    op.add_column(
        "sites",
        sa.Column(
            "is_named_park", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )


def downgrade() -> None:
    op.drop_column("sites", "is_named_park")
