"""
Friend routes (all require a signed-in user):

  POST   /friends/requests                 send a request, by the other person's email
  GET    /friends/requests                 pending requests (?direction=incoming|outgoing)
  POST   /friends/requests/{id}/accept     accept an incoming request
  DELETE /friends/requests/{id}            decline (recipient) or cancel (sender)
  GET    /friends                          my friends
  GET    /friends/{user_id}                one friend's profile (404 unless friends)
  DELETE /friends/{user_id}                unfriend

Friendship is mutual and needs consent: nothing is shared until the
addressee accepts. Who may see what once friends is decided in
app/visibility.py, not here.

Not-found vs forbidden: a stranger poking at ids gets 404, never 403, so the
API doesn't reveal which friendships or requests exist.
"""

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Friendship, User
from app.schemas import FriendOut, FriendRequestCreate, FriendshipOut, UserOut
from app.visibility import Visibility, can_view

router = APIRouter()


def _between(a_id: int, b_id: int):
    """WHERE clause matching the friendship row for a pair, either direction."""
    return or_(
        (Friendship.requester_id == a_id) & (Friendship.addressee_id == b_id),
        (Friendship.requester_id == b_id) & (Friendship.addressee_id == a_id),
    )


def _accept(db: Session, friendship: Friendship) -> None:
    friendship.status = "accepted"
    friendship.accepted_at = datetime.now(UTC)
    db.commit()
    db.refresh(friendship)


def _get_party_request(db: Session, request_id: int, me: User) -> Friendship:
    """A request I'm part of, else 404 (so ids of other people's requests don't leak)."""
    friendship = db.get(Friendship, request_id)
    if friendship is None or me.id not in (friendship.requester_id, friendship.addressee_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Friend request not found")
    return friendship


@router.post("/requests", response_model=FriendshipOut, status_code=status.HTTP_201_CREATED)
def send_request(
    payload: FriendRequestCreate,
    response: Response,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    target = db.scalars(
        select(User).where(func.lower(User.email) == payload.email.lower())
    ).first()
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No user with that email")
    if target.id == me.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="You can't friend yourself")

    existing = db.scalars(select(Friendship).where(_between(me.id, target.id))).first()
    if existing is not None:
        if existing.status == "accepted":
            raise HTTPException(status.HTTP_409_CONFLICT, detail="You're already friends")
        if existing.requester_id == me.id:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Request already sent")
        # They already asked me, so asking back means yes: accept instead of
        # leaving two people each waiting on the other.
        _accept(db, existing)
        response.status_code = status.HTTP_200_OK
        return existing

    friendship = Friendship(requester_id=me.id, addressee_id=target.id, status="pending")
    db.add(friendship)
    try:
        db.commit()
    except IntegrityError:
        # Both sides requested at the same instant; the unique pair index let one win.
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Request already exists")
    db.refresh(friendship)
    return friendship


@router.get("/requests", response_model=list[FriendshipOut])
def list_requests(
    direction: Literal["incoming", "outgoing"] = Query(
        "incoming", description="`incoming` to answer, `outgoing` to see what you've sent"
    ),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    column = Friendship.addressee_id if direction == "incoming" else Friendship.requester_id
    stmt = (
        select(Friendship)
        .where(Friendship.status == "pending", column == me.id)
        .order_by(Friendship.created_at.desc(), Friendship.id.desc())
    )
    return db.scalars(stmt).unique().all()


@router.post("/requests/{request_id}/accept", response_model=FriendshipOut)
def accept_request(
    request_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    friendship = _get_party_request(db, request_id, me)
    if friendship.addressee_id != me.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Only the person asked can accept a request"
        )
    if friendship.status == "accepted":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Already accepted")
    _accept(db, friendship)
    return friendship


@router.delete("/requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
def decline_or_cancel_request(
    request_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Recipient declines, sender cancels. Either way the row goes, so it can be re-sent."""
    friendship = _get_party_request(db, request_id, me)
    if friendship.status != "pending":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Already friends; use DELETE /friends/{user_id} to unfriend",
        )
    db.delete(friendship)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("", response_model=list[FriendOut])
def list_friends(
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    rows = db.scalars(
        select(Friendship)
        .where(
            Friendship.status == "accepted",
            or_(Friendship.requester_id == me.id, Friendship.addressee_id == me.id),
        )
        .order_by(Friendship.accepted_at.desc(), Friendship.id.desc())
    ).unique().all()
    return [
        FriendOut(
            friendship_id=f.id,
            user=f.addressee if f.requester_id == me.id else f.requester,
            since=f.accepted_at,
        )
        for f in rows
    ]


@router.get("/{user_id}", response_model=UserOut)
def read_friend(
    user_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """A friend's profile. Strangers (and pending requests) get 404, not 403."""
    other = db.get(User, user_id)
    if other is None or other.id == me.id or not can_view(db, me.id, other.id, Visibility.FRIENDS):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Friend not found")
    return other


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def unfriend(
    user_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    friendship = db.scalars(
        select(Friendship).where(Friendship.status == "accepted", _between(me.id, user_id))
    ).first()
    if friendship is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Friend not found")
    db.delete(friendship)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
