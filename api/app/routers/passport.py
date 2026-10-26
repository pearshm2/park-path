"""
Passport routes (all require a signed-in user):

  GET /passport             my passport: every national park, earned or not
  GET /passport/{user_id}   a friend's passport, from the trips they shared

A stamp is earned by logging a trip (see app/passport.py for the rules).
Your own passport counts every entry, private ones too. A friend's counts
only the entries shared with friends, so a private trip never shows up as a
stamp on someone else's passport. Strangers get 404, as everywhere.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Site, TripEntry, User
from app.passport import build_achievements, build_regions, build_stamps
from app.schemas import PassportOut, UserOut
from app.visibility import Visibility, can_view, friend_ids

router = APIRouter()


def _passport(db: Session, owner: User, viewer: User) -> PassportOut:
    parks = db.scalars(select(Site).where(Site.is_named_park.is_(True))).all()
    entries = [
        e
        for e in db.scalars(select(TripEntry).where(TripEntry.user_id == owner.id)).unique().all()
        # The one visibility rule lives in app/visibility.py.
        if can_view(db, viewer.id, owner.id, e.visibility)
    ]
    # Only national parks stamp; trips to other sites don't count here.
    park_ids = {p.id for p in parks}
    stamps = build_stamps(parks, [e for e in entries if e.site_id in park_ids])
    regions = build_regions(stamps)
    return PassportOut(
        owner=UserOut.model_validate(owner),
        parks_visited=sum(s.earned for s in stamps),
        parks_total=len(stamps),
        stamps=stamps,
        regions=regions,
        achievements=build_achievements(
            stamps,
            regions,
            # Any NPS site counts towards the all-sites tiers.
            sites_visited=len({e.site_id for e in entries}),
            sites_total=db.scalar(select(func.count(Site.id))) or 0,
            friends=len(friend_ids(db, owner.id)),
            trips_with_friends=sum(bool(e.companions) for e in entries),
        ),
    )


@router.get("", response_model=PassportOut)
def my_passport(db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    return _passport(db, me, me)


@router.get("/{user_id}", response_model=PassportOut)
def friends_passport(
    user_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)
):
    owner = db.get(User, user_id)
    if owner is None or not can_view(db, me.id, owner.id, Visibility.FRIENDS):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Friend not found")
    return _passport(db, owner, me)
