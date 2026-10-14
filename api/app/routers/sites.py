"""
Site routes: GET /sites, GET /sites/{park_code}, GET /sites/{park_code}/map,
GET /sites/{park_code}/brochures/{position}.

Public on purpose: park data isn't tied to an account, and the map should
load before anyone signs in. Per-user data lives in its own tables and
routes behind get_current_user (the wishlist is app/routers/wishlist.py).
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import BrochureMap, ParkMap, Site
from app.schemas import BrochureMapOut, ParkMapOut, SiteOut

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
    park_map = db.scalars(select(ParkMap).join(ParkMap.site).where(Site.park_code == code)).first()
    if park_map is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No map for this site")
    # The image column is deferred, so listing the brochures doesn't load them.
    brochures = db.scalars(
        select(BrochureMap)
        .where(BrochureMap.site_id == park_map.site_id)
        .order_by(BrochureMap.position)
    ).all()
    return ParkMapOut(
        park_code=code,
        boundary=park_map.boundary,
        roads=park_map.roads,
        trails=park_map.trails,
        places=park_map.places,
        brochures=[
            BrochureMapOut(
                title=b.title,
                url=f"/sites/{code}/brochures/{b.position}",
                width=b.width,
                height=b.height,
                visitor_centers=b.labels or [],
            )
            for b in brochures
        ],
        official_map_url=f"https://www.nps.gov/{code}/planyourvisit/maps.htm",
        synced_at=park_map.synced_at,
    )


@router.get(
    "/{park_code}/brochures/{position}",
    response_class=Response,
    responses={200: {"content": {"image/jpeg": {}}}},
)
def read_brochure_map(park_code: str, position: int, db: Session = Depends(get_db)):
    """One of the park's official brochure maps, as a JPEG (see app/brochure_maps.py)."""
    image = db.scalar(
        select(BrochureMap.image)
        .join(Site, Site.id == BrochureMap.site_id)
        .where(Site.park_code == park_code.lower(), BrochureMap.position == position)
    )
    if image is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No such map")
    # The maps change only when a sync picks a new edition; a day's caching is safe.
    return Response(
        image, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"}
    )
