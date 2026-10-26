"""
Snooze routes, for "Not for now" (all require a signed-in user):

  GET    /snoozes               the parks I've set aside, soonest back first
  PUT    /snoozes/{park_code}   set a park aside for 30 days
  DELETE /snoozes/{park_code}   bring it back now (fine if it wasn't set aside)

A snooze only hides a park from the app's recommendations for a while; the
engine never sees it, so it is never held against the park. Expired rows
are left in place and simply not listed.

Sites are addressed by park_code, as in /wishlist.
"""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Site, Snooze, User
from app.routers.wishlist import _site_id
from app.schemas import SnoozeIn, SnoozeOut

router = APIRouter()

SNOOZE_DAYS = 30


@router.get("", response_model=list[SnoozeOut])
def list_snoozes(me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Site.park_code, Snooze.until)
        .join(Snooze.site)
        .where(Snooze.user_id == me.id, Snooze.until > datetime.now(UTC))
        .order_by(Snooze.until, Site.park_code)
    ).all()
    return [SnoozeOut(park_code=code, until=until) for code, until in rows]


@router.put("/{park_code}", response_model=SnoozeOut)
def snooze(
    park_code: str,
    body: SnoozeIn | None = None,
    me: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    site_id = _site_id(db, park_code)
    latest = datetime.now(UTC) + timedelta(days=SNOOZE_DAYS)
    until = min(body.until, latest) if body and body.until else latest
    db.execute(
        insert(Snooze)
        .values(user_id=me.id, site_id=site_id, until=until)
        .on_conflict_do_update(constraint="uq_snoozes_user_site", set_={"until": until})
    )
    db.commit()
    return SnoozeOut(park_code=park_code.lower(), until=until)


@router.delete("/{park_code}", status_code=status.HTTP_204_NO_CONTENT)
def unsnooze(park_code: str, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    site_id = _site_id(db, park_code)
    db.execute(delete(Snooze).where(Snooze.user_id == me.id, Snooze.site_id == site_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
