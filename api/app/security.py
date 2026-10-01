"""
Password hashing and JWT helpers.

Deliberately plain functions (not a class) — auth.py and dependencies.py
both import from here, and that's the entire surface area this week.
Refresh tokens / token revocation are NOT in scope yet; this issues a
single access token on signup/login, like most "skeleton" auth setups.
"""

from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.config import settings


def hash_password(plain_password: str) -> str:
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


def create_access_token(subject: str) -> str:
    """
    `subject` should be something stable and unique — we use the user's
    id (as a string) rather than email, so a later email change doesn't
    invalidate every outstanding token.
    """
    expire = datetime.now(UTC) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str:
    """
    Returns the subject (user id) if the token is valid. Raises
    jwt.PyJWTError (expired, bad signature, malformed, etc.) on failure —
    callers are expected to catch that and turn it into a 401.
    """
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    return payload["sub"]
