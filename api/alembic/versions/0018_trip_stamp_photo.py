"""A photo of the park's passport stamp on a trip.

It was kept on the phone only; now it's uploaded to S3 like the trip's
photos, so it survives a new phone and friends see it too.

Revision ID: 0018
Revises: 0017
"""

from alembic import op
import sqlalchemy as sa

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("trip_entries", sa.Column("stamp_photo_key", sa.String(300), nullable=True))


def downgrade() -> None:
    op.drop_column("trip_entries", "stamp_photo_key")
