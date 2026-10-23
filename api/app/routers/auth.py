"""
Auth routes:

  POST  /auth/signup               new account: email, password, username, first and last name
  POST  /auth/login                email + password, for a token
  GET   /auth/me                   who's signed in
  PATCH /auth/me                   change your name, username, or email (email needs your password)
  POST  /auth/me/password          change your password
  PUT   /auth/me/avatar            set your profile picture
  DELETE /auth/me/avatar           remove it
  GET   /auth/username-available   ?username=..., for the sign-up form to check as you type

Scope note: this is access-token-only (no refresh tokens, no password
reset, no email verification) — matches this week's task ("JWT auth:
sign up, log in, tokens"). Those are natural follow-ups, not regressions.
"""

import base64
import binascii
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import (
    AvatarUpload,
    PasswordChange,
    Token,
    UserCreate,
    UserLogin,
    UsernameCheck,
    UserOut,
    UserUpdate,
)
from app.security import create_access_token, hash_password, verify_password
from app.usernames import normalize_username, username_problem

router = APIRouter()


USERNAME_TAKEN = "That username is taken"
EMAIL_TAKEN = "An account with that email already exists"
WRONG_PASSWORD = "That password isn't right"


def _username_taken(db: Session, username: str, except_id: int | None = None) -> bool:
    stmt = select(User.id).where(User.username == username)
    if except_id is not None:
        stmt = stmt.where(User.id != except_id)
    return db.scalars(stmt).first() is not None


def _usable_username(db: Session, raw: str, except_id: int | None = None) -> str:
    """The normalized username, or a 422/409 saying why it can't be used."""
    username = normalize_username(raw)
    problem = username_problem(username)
    if problem:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=problem)
    if _username_taken(db, username, except_id):
        raise HTTPException(status.HTTP_409_CONFLICT, detail=USERNAME_TAKEN)
    return username


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(payload: UserCreate, db: Session = Depends(get_db)):
    username = _usable_username(db, payload.username)
    if db.scalars(select(User.id).where(func.lower(User.email) == payload.email.lower())).first():
        raise HTTPException(status.HTTP_409_CONFLICT, detail=EMAIL_TAKEN)
    user = User(
        email=payload.email,
        username=username,
        first_name=payload.first_name,
        last_name=payload.last_name,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Someone took the email or username in the same instant.
        db.rollback()
        detail = USERNAME_TAKEN if _username_taken(db, username) else EMAIL_TAKEN
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)
    db.refresh(user)

    token = create_access_token(subject=str(user.id))
    return Token(access_token=token)


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    # Deliberately the same error for "no such user" and "wrong password" —
    # distinguishing them lets an attacker enumerate registered emails.
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password",
    )

    if user is None:
        raise invalid_credentials
    if not verify_password(payload.password, user.hashed_password):
        raise invalid_credentials

    token = create_access_token(subject=str(user.id))
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    """
    Example of a protected route. Halie/Dylan: this is the pattern to
    copy for any route that needs to know who's logged in — add
    `current_user: User = Depends(get_current_user)` as a parameter.
    """
    return current_user


@router.patch("/me", response_model=UserOut)
def update_current_user(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.email is not None and payload.email.lower() != current_user.email.lower():
        # Whoever holds the phone shouldn't be able to take the account.
        if not payload.current_password or not verify_password(
            payload.current_password, current_user.hashed_password
        ):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=WRONG_PASSWORD)
        taken = db.scalars(
            select(User.id).where(
                func.lower(User.email) == payload.email.lower(), User.id != current_user.id
            )
        ).first()
        if taken:
            raise HTTPException(status.HTTP_409_CONFLICT, detail=EMAIL_TAKEN)
        current_user.email = payload.email
    if payload.username is not None:
        current_user.username = _usable_username(db, payload.username, except_id=current_user.id)
    if payload.first_name is not None:
        current_user.first_name = payload.first_name
    if payload.last_name is not None:
        current_user.last_name = payload.last_name
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail="That username or email is taken")
    db.refresh(current_user)
    return current_user


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=WRONG_PASSWORD)
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# A picture's first bytes, by type: checked so only real images are stored.
_MAGIC = {"image/jpeg": b"\xff\xd8\xff", "image/png": b"\x89PNG\r\n\x1a\n"}
MAX_AVATAR_BYTES = 300_000


@router.put("/me/avatar", response_model=UserOut)
def set_avatar(
    payload: AvatarUpload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        data = base64.b64decode(payload.data, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="That isn't a picture")
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="That picture is too big"
        )
    if not data.startswith(_MAGIC[payload.content_type]):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="That isn't a picture")
    current_user.avatar = data
    current_user.avatar_type = payload.content_type
    current_user.avatar_updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me/avatar", response_model=UserOut)
def remove_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.avatar = None
    current_user.avatar_type = None
    current_user.avatar_updated_at = None
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/username-available", response_model=UsernameCheck)
def username_available(username: str = Query(..., max_length=40), db: Session = Depends(get_db)):
    """
    Public, so the sign-up form can check as you type. Says only whether a
    name is free, never whose it is.
    """
    name = normalize_username(username)
    problem = username_problem(name)
    if problem:
        return UsernameCheck(username=name, available=False, reason=problem)
    if _username_taken(db, name):
        return UsernameCheck(username=name, available=False, reason=USERNAME_TAKEN)
    return UsernameCheck(username=name, available=True)
