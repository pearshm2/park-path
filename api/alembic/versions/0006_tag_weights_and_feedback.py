"""add user_tag_weights and site_feedback

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_tag_weights",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tag", sa.String(length=100), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "tag", name="uq_user_tag_weights_user_tag"),
    )
    op.create_index("ix_user_tag_weights_user_id", "user_tag_weights", ["user_id"])

    op.create_table(
        "site_feedback",
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
        sa.Column("rating", sa.SmallInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "site_id", name="uq_site_feedback_user_site"),
        sa.CheckConstraint("rating IN (-1, 1)", name="ck_site_feedback_rating"),
    )
    op.create_index("ix_site_feedback_user_id", "site_feedback", ["user_id"])
    op.create_index("ix_site_feedback_site_id", "site_feedback", ["site_id"])


def downgrade() -> None:
    op.drop_index("ix_site_feedback_site_id", table_name="site_feedback")
    op.drop_index("ix_site_feedback_user_id", table_name="site_feedback")
    op.drop_table("site_feedback")
    op.drop_index("ix_user_tag_weights_user_id", table_name="user_tag_weights")
    op.drop_table("user_tag_weights")
