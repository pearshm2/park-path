"""trip trails as a list; photo captions and video lengths

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-22

A trip had one trail (`stamp`); it now has a list (`trails`), and each
existing trip's trail becomes the first in its list. Photos (and now
videos) gain a caption and, for videos, a length.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "trip_entries",
        sa.Column(
            "trails",
            postgresql.ARRAY(sa.String(200)),
            nullable=False,
            server_default="{}",
        ),
    )
    op.execute("UPDATE trip_entries SET trails = ARRAY[stamp] WHERE stamp IS NOT NULL")
    op.drop_column("trip_entries", "stamp")

    op.add_column(
        "trip_photos",
        sa.Column("caption", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column("trip_photos", sa.Column("duration_ms", sa.Integer()))


def downgrade() -> None:
    op.drop_column("trip_photos", "duration_ms")
    op.drop_column("trip_photos", "caption")

    op.add_column("trip_entries", sa.Column("stamp", sa.String(200)))
    # Only the first trail fits back in the old column.
    op.execute("UPDATE trip_entries SET stamp = trails[1] WHERE cardinality(trails) > 0")
    op.drop_column("trip_entries", "trails")
