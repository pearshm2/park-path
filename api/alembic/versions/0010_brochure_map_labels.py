"""add brochure_maps.labels

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # NULL means "not read yet": the next sync re-renders those maps from
    # their PDFs and fills this in.
    op.add_column("brochure_maps", sa.Column("labels", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("brochure_maps", "labels")
