"""
Who can see what. The single place that answers "may this viewer see this
owner's thing?", so trips (week 5), the friends feed and the recommender's
friends-visited signal all apply the same rule instead of each inventing one.

The rules, in full:

- PRIVATE: only the owner.
- FRIENDS: the owner and anyone with an *accepted* friendship with them.
  A pending request shares nothing, in either direction.

Anything not explicitly shared is PRIVATE. There is deliberately no public
level yet; add one here (and only here) if the product needs it.
"""

from enum import StrEnum

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Friendship


class Visibility(StrEnum):
    PRIVATE = "private"
    FRIENDS = "friends"


DEFAULT_VISIBILITY = Visibility.PRIVATE


def are_friends(db: Session, user_a_id: int, user_b_id: int) -> bool:
    """True only for an accepted friendship (a user is not their own friend)."""
    if user_a_id == user_b_id:
        return False
    stmt = select(Friendship.id).where(
        Friendship.status == "accepted",
        or_(
            (Friendship.requester_id == user_a_id) & (Friendship.addressee_id == user_b_id),
            (Friendship.requester_id == user_b_id) & (Friendship.addressee_id == user_a_id),
        ),
    )
    return db.scalars(stmt).first() is not None


def friend_ids(db: Session, user_id: int) -> set[int]:
    """Ids of everyone with an accepted friendship with `user_id`."""
    rows = db.execute(
        select(Friendship.requester_id, Friendship.addressee_id).where(
            Friendship.status == "accepted",
            or_(Friendship.requester_id == user_id, Friendship.addressee_id == user_id),
        )
    ).all()
    return {other for pair in rows for other in pair if other != user_id}


def can_view(db: Session, viewer_id: int, owner_id: int, visibility: Visibility | str) -> bool:
    """May `viewer_id` see something `owner_id` owns, shared at `visibility`?"""
    if viewer_id == owner_id:
        return True
    if Visibility(visibility) is Visibility.FRIENDS:
        return are_friends(db, viewer_id, owner_id)
    return False
