"""trip comments; profile pictures

Revision ID: 0014
Revises: 0013
Create Date: 2026-10-23

Friends can comment on each other's shared trips (trip_comments), and
everyone can have a profile picture, kept small in the users table until
photos move to S3.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar", sa.LargeBinary()))
    op.add_column("users", sa.Column("avatar_type", sa.String(30)))
    op.add_column("users", sa.Column("avatar_updated_at", sa.DateTime(timezone=True)))

    op.create_table(
        "trip_comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "entry_id",
            sa.Integer(),
            sa.ForeignKey("trip_entries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_trip_comments_entry_id", "trip_comments", ["entry_id"])
    op.create_index("ix_trip_comments_user_id", "trip_comments", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_trip_comments_user_id", table_name="trip_comments")
    op.drop_index("ix_trip_comments_entry_id", table_name="trip_comments")
    op.drop_table("trip_comments")
    op.drop_column("users", "avatar_updated_at")
    op.drop_column("users", "avatar_type")
    op.drop_column("users", "avatar")
