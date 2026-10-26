"""New trips are shared with friends by default.

The app no longer offers "only me": every trip it logs is shared with
friends. Existing trips keep the visibility they were saved with.

Revision ID: 0016
Revises: 0015
"""

from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("trip_entries", "visibility", server_default="friends")


def downgrade() -> None:
    op.alter_column("trip_entries", "visibility", server_default="private")
