"""usernames, first and last names

Revision ID: 0013
Revises: 0012
Create Date: 2026-10-23

Every account gets a username (the @handle friends see instead of the
email) and a first and last name. Accounts made before this get them
filled in from their email, so every account has all three from here on:
"jane.doe@example.com" becomes @jane.doe, Jane Doe. A clash gets a number
on the end (@jane.doe2). People can change them from the app later.

"""
import re
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Kept in step with app/usernames.py, but copied: a migration shouldn't
# change if the app's rules do later.
RESERVED = {"admin", "administrator", "parkpath", "support", "help", "moderator", "nps", "official", "root", "system"}


def _username_base(email: str) -> str:
    local = email.split("@")[0].lower()
    name = re.sub(r"[^a-z0-9._]", "", local).strip("._")
    name = re.sub(r"[._]{2,}", ".", name)[:17] or "hiker"
    if len(name) < 3 or name in RESERVED:
        name = (name + "hiker")[:17]
    return name


def _names(email: str) -> tuple[str, str]:
    words = [w for w in re.split(r"[^a-zA-Z]+", email.split("@")[0]) if w]
    if not words:
        return "Hiker", ""
    words = [w.capitalize() for w in words]
    return words[0][:50], " ".join(words[1:])[:50]


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(20)))
    op.add_column("users", sa.Column("first_name", sa.String(50)))
    op.add_column("users", sa.Column("last_name", sa.String(50), nullable=False, server_default=""))

    conn = op.get_bind()
    taken: set[str] = set()
    for user_id, email in conn.execute(sa.text("SELECT id, email FROM users ORDER BY id")):
        base = _username_base(email)
        username, n = base, 1
        while username in taken:
            n += 1
            username = f"{base}{n}"
        taken.add(username)
        first, last = _names(email)
        conn.execute(
            sa.text("UPDATE users SET username = :u, first_name = :f, last_name = :l WHERE id = :id"),
            {"u": username, "f": first, "l": last, "id": user_id},
        )

    op.alter_column("users", "username", nullable=False)
    op.alter_column("users", "first_name", nullable=False)
    op.create_index("ix_users_username", "users", ["username"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_username", table_name="users")
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")
    op.drop_column("users", "username")
