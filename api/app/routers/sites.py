"""
Site routes: GET /sites, GET /sites/{park_code}, GET /sites/{park_code}/map.

Public on purpose: park data isn't tied to an account, and the map should
load before anyone signs in. Per-user data lives in its own tables and
routes behind get_current_user (the wishlist is app/routers/wishlist.py).
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ParkMap, Site
from app.schemas import ParkMapOut, SiteOut

router = APIRouter()


@router.get("", response_model=list[SiteOut])
def list_sites(
    scope: Literal["parks", "all"] = Query(
        "all", description="`parks` for the 63 national parks only, `all` for every NPS site"
    ),
    db: Session = Depends(get_db),
):
    stmt = select(Site).order_by(Site.name)
    if scope == "parks":
        stmt = stmt.where(Site.is_named_park.is_(True))
    return db.scalars(stmt).all()


@router.get("/{park_code}", response_model=SiteOut)
def read_site(park_code: str, db: Session = Depends(get_db)):
    site = db.scalars(select(Site).where(Site.park_code == park_code.lower())).first()
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")
    return site


@router.get("/{park_code}/map", response_model=ParkMapOut)
def read_park_map(park_code: str, db: Session = Depends(get_db)):
    """
    A national park's boundary, roads and trails, for drawing its own map.
    Filled by `python -m app.park_map_sync`; 404 until that has run for
    the park (or if the NPS has no map data for it).
    """
    code = park_code.lower()
    park_map = db.scalars(
        select(ParkMap).join(ParkMap.site).where(Site.park_code == code)
    ).first()
    if park_map is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No map for this site")
    return ParkMapOut(
        park_code=code,
        boundary=park_map.boundary,
        roads=park_map.roads,
        trails=park_map.trails,
        official_map_url=f"https://www.nps.gov/{code}/planyourvisit/maps.htm",
        synced_at=park_map.synced_at,
    )
