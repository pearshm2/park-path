"""
User routes:

  GET /users/{user_id}/avatar   their profile picture (any signed-in user)

Profile pictures show wherever a person does (friend requests, the feed,
tagged companions), so any signed-in user can fetch one; the link carries
the picture's version, so it can be cached for a long time.
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session, undefer

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User

router = APIRouter()


@router.get("/{user_id}/avatar")
def read_avatar(
    user_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    user = db.get(User, user_id, options=[undefer(User.avatar)])
    if user is None or user.avatar is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No profile picture")
    return Response(
        content=user.avatar,
        media_type=user.avatar_type or "image/jpeg",
        headers={"Cache-Control": "private, max-age=31536000, immutable"},
    )
