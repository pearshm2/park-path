"""
Wishlist routes (all require a signed-in user):

  GET    /wishlist               my saved sites, newest first
  PUT    /wishlist/{park_code}   save a site (saving it again is fine)
  DELETE /wishlist/{park_code}   remove a site (removing an unsaved one is fine)

Sites are addressed by park_code, the same key GET /sites and
POST /recommendations use, so the app never needs the internal site id.

PUT and DELETE are idempotent so the app's save button can simply send the
state it wants: a double tap or a retry after a dropped connection can't
fail or create a duplicate. An unknown park_code is still a 404.
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Site, User, WishlistItem
from app.schemas import WishlistItemOut

router = APIRouter()


def _site_id(db: Session, park_code: str) -> int:
    site_id = db.scalar(select(Site.id).where(Site.park_code == park_code.lower()))
    if site_id is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Site not found")
    return site_id


@router.get("", response_model=list[WishlistItemOut])
def list_wishlist(me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Site.park_code, WishlistItem.created_at)
        .join(WishlistItem.site)
        .where(WishlistItem.user_id == me.id)
        .order_by(WishlistItem.created_at.desc(), Site.park_code)
    ).all()
    return [WishlistItemOut(park_code=code, added_at=added) for code, added in rows]


@router.put("/{park_code}", response_model=WishlistItemOut)
def save_to_wishlist(
    park_code: str, me: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    site_id = _site_id(db, park_code)
    # ON CONFLICT DO NOTHING keeps a repeat save (or two at once) from
    # tripping the unique constraint; the original save date is kept.
    db.execute(
        insert(WishlistItem)
        .values(user_id=me.id, site_id=site_id)
        .on_conflict_do_nothing(constraint="uq_wishlist_items_user_site")
    )
    db.commit()
    added_at = db.scalar(
        select(WishlistItem.created_at).where(
            WishlistItem.user_id == me.id, WishlistItem.site_id == site_id
        )
    )
    return WishlistItemOut(park_code=park_code.lower(), added_at=added_at)


@router.delete("/{park_code}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_wishlist(
    park_code: str, me: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    site_id = _site_id(db, park_code)
    db.execute(
        delete(WishlistItem).where(WishlistItem.user_id == me.id, WishlistItem.site_id == site_id)
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
