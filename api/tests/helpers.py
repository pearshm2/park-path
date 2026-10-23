"""Shared bits for the API tests."""

import uuid


def new_names() -> dict[str, str]:
    """A fresh username and a name, for a sign-up body."""
    return {"username": f"t_{uuid.uuid4().hex[:12]}", "first_name": "Test", "last_name": "Hiker"}
