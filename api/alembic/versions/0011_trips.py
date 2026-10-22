"""add trip_entries, trip_photos, trip_companions

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "trip_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "site_id",
            sa.Integer(),
            sa.ForeignKey("sites.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("visited_on", sa.Date(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False, server_default=""),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("rating", sa.SmallInteger()),
        sa.Column("stamp", sa.String(200)),
        sa.Column("visibility", sa.String(10), nullable=False, server_default="private"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("rating IS NULL OR rating BETWEEN 1 AND 5", name="ck_trip_entries_rating"),
        sa.CheckConstraint(
            "visibility IN ('private', 'friends')", name="ck_trip_entries_visibility"
        ),
    )
    op.create_index("ix_trip_entries_user_id", "trip_entries", ["user_id"])
    op.create_index("ix_trip_entries_site_id", "trip_entries", ["site_id"])
    op.create_index("ix_trip_entries_user_visited", "trip_entries", ["user_id", "visited_on"])

    op.create_table(
        "trip_photos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "entry_id",
            sa.Integer(),
            sa.ForeignKey("trip_entries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("storage_key", sa.String(300), nullable=False, unique=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_trip_photos_entry_id", "trip_photos", ["entry_id"])

    op.create_table(
        "trip_companions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "entry_id",
            sa.Integer(),
            sa.ForeignKey("trip_entries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.UniqueConstraint("entry_id", "user_id", name="uq_trip_companions_entry_user"),
    )
    op.create_index("ix_trip_companions_entry_id", "trip_companions", ["entry_id"])
    op.create_index("ix_trip_companions_user_id", "trip_companions", ["user_id"])


def downgrade() -> None:
    op.drop_table("trip_companions")
    op.drop_table("trip_photos")
    op.drop_table("trip_entries")
