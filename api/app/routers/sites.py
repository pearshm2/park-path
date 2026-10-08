"""
Site routes: GET /sites, GET /sites/{park_code}.

Public on purpose: park data isn't tied to an account, and the map should
load before anyone signs in. Per-user data (visited, wishlist) will live
in its own table and routes, behind get_current_user.
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Site
from app.schemas import SiteOut

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
