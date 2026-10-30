"""Feedback tags on trips ("Too crowded", "Worth the drive", ...).

They tune the person's recommendations (app/recommender.py) and show on
the trip for friends.

Revision ID: 0019
Revises: 0018
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "trip_entries",
        sa.Column("feedback", ARRAY(sa.String(30)), nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("trip_entries", "feedback")
