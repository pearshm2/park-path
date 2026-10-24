"""
Usernames: the @handle people find and friend each other by.

Rules: 3 to 20 characters, lowercase letters, numbers, dots and
underscores, starting with a letter or number. Stored lowercase, so
"JaneDoe" and "janedoe" are the same name. A few names are kept back so
nobody can pass as the app.
"""

import re

USERNAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._]{2,19}$")

RESERVED = frozenset(
    {
        "admin",
        "administrator",
        "parkpath",
        "support",
        "help",
        "moderator",
        "nps",
        "official",
        "root",
        "system",
    }
)


def username_base(email: str) -> str:
    """A username made from an email's local part: "Jane.Doe+x@..." -> "jane.doex"."""
    local = email.split("@")[0].lower()
    name = re.sub(r"[^a-z0-9._]", "", local).strip("._")
    name = re.sub(r"[._]{2,}", ".", name)[:17] or "hiker"
    if len(name) < 3 or name in RESERVED:
        name = (name + "hiker")[:17]
    return name


def normalize_username(value: str) -> str:
    """Trim, drop a leading @, and lowercase."""
    return value.strip().removeprefix("@").lower()


def username_problem(username: str) -> str | None:
    """Why a (normalized) username can't be used, or None if it can."""
    if len(username) < 3:
        return "Usernames are at least 3 characters"
    if len(username) > 20:
        return "Usernames are at most 20 characters"
    if not USERNAME_PATTERN.match(username):
        return "Use letters, numbers, dots and underscores, starting with a letter or number"
    if username in RESERVED:
        return "That username is reserved"
    return None
