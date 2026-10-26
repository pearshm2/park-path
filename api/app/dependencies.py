"""
Shared FastAPI dependencies. Right now just auth — any future protected
route (quiz submission, trip creation, etc.) imports get_current_user
from here rather than reimplementing token decoding.
"""

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import decode_access_token

# tokenUrl is just what shows up in the auto-generated /docs "Authorize"
# button — it points at our login route so Swagger UI can call it directly.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# The same, but a missing token isn't an error: for routes that work for
# everyone and do a little more for signed-in users.
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        user_id = decode_access_token(token)
    except jwt.PyJWTError:
        raise credentials_exception

    user = db.get(User, int(user_id))
    if user is None:
        raise credentials_exception

    return user


def get_optional_user(
    token: str | None = Depends(optional_oauth2_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """
    The signed-in user, or None when there's no token. A bad or expired
    token also gives None rather than a 401: routes using this work without
    an account, so an old token shouldn't break them.
    """
    if not token:
        return None
    try:
        user_id = decode_access_token(token)
    except jwt.PyJWTError:
        return None
    return db.get(User, int(user_id))
