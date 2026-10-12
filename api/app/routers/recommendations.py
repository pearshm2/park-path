"""
Recommendation route: POST /recommendations.

Public on purpose, like /sites: the quiz answers arrive with each request
and nothing is saved, so no account is needed. All the scoring lives in
app/recommender.py; this file only loads the sites and hands them over.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Site
from app.recommender import SiteData, rank
from app.schemas import RecommendationOut, RecommendationRequest

router = APIRouter()


@router.post("", response_model=list[RecommendationOut])
def recommend(payload: RecommendationRequest, db: Session = Depends(get_db)):
    """Every site, best match first. Sites with no curated data come last, unscored."""
    sites = [
        SiteData(
            park_code=s.park_code,
            name=s.name,
            latitude=s.latitude,
            longitude=s.longitude,
            terrain_group=s.terrain_group,
            seasons=s.seasons,
            annual_visits_millions=s.annual_visits_millions,
        )
        for s in db.scalars(select(Site)).all()
    ]
    return rank(sites, payload.answers, payload.location)
