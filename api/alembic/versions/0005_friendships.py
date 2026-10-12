"""add friendships table

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "friendships",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "requester_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "addressee_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("requester_id <> addressee_id", name="ck_friendships_not_self"),
        sa.CheckConstraint("status IN ('pending', 'accepted')", name="ck_friendships_status"),
    )
    op.create_index("ix_friendships_requester_id", "friendships", ["requester_id"])
    op.create_index("ix_friendships_addressee_id", "friendships", ["addressee_id"])
    # One row per pair, whichever direction the request went.
    op.create_index(
        "uq_friendships_pair",
        "friendships",
        [sa.text("LEAST(requester_id, addressee_id)"), sa.text("GREATEST(requester_id, addressee_id)")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_friendships_pair", table_name="friendships")
    op.drop_index("ix_friendships_addressee_id", table_name="friendships")
    op.drop_index("ix_friendships_requester_id", table_name="friendships")
    op.drop_table("friendships")
