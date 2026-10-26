"""Keep quiz answers and "Not for now" snoozes on the server.

Both lived only on the phone, so a new phone (or a reinstall) asked for
the quiz again and forgot which parks were set aside.

Revision ID: 0017
Revises: 0016
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("quiz_answers", JSONB(), nullable=True))
    op.create_table(
        "snoozes",
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
        sa.Column("until", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "site_id", name="uq_snoozes_user_site"),
    )
    op.create_index("ix_snoozes_user_id", "snoozes", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_snoozes_user_id", table_name="snoozes")
    op.drop_table("snoozes")
    op.drop_column("users", "quiz_answers")
