"""
Recommendation route: POST /recommendations.

Works for everyone: the quiz answers arrive with each request, so no
account is needed. When the request carries a valid sign-in token, the
engine also uses that person's logged trips (visited parks move down;
their stars and feedback tags tune the terrains, crowds, distance and
seasons; one park is flagged as "something different"). All the scoring lives in
app/recommender.py; this file only loads the data and hands it over.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_optional_user
from app.models import Site, TripEntry, User
from app.recommender import Review, SiteData, Visit, rank
from app.schemas import RecommendationOut, RecommendationRequest

router = APIRouter()


def load_history(db: Session, user: User) -> dict[str, Visit]:
    """The user's visited parks, with their best rating at each."""
    rows = db.execute(
        select(
            Site.park_code, Site.name, Site.terrain_group, Site.states, func.max(TripEntry.rating)
        )
        .join(TripEntry, TripEntry.site_id == Site.id)
        .where(TripEntry.user_id == user.id)
        .group_by(Site.id)
    ).all()
    return {
        code: Visit(park_code=code, name=name, terrain_group=terrain, rating=rating, states=states)
        for code, name, terrain, states, rating in rows
    }


def load_reviews(db: Session, user: User) -> list[Review]:
    """Every trip's stars and feedback tags, for tuning."""
    rows = db.execute(
        select(
            Site.park_code,
            Site.name,
            Site.terrain_group,
            TripEntry.rating,
            TripEntry.feedback,
            TripEntry.visited_on,
        )
        .join(TripEntry, TripEntry.site_id == Site.id)
        .where(TripEntry.user_id == user.id)
    ).all()
    return [
        Review(code, name, terrain, rating, list(feedback or []), visited_on.month)
        for code, name, terrain, rating, feedback, visited_on in rows
    ]


@router.post("", response_model=list[RecommendationOut])
def recommend(
    payload: RecommendationRequest,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
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
            is_named_park=s.is_named_park,
            states=s.states,
        )
        for s in db.scalars(select(Site)).all()
    ]
    history = load_history(db, user) if user is not None else None
    reviews = load_reviews(db, user) if user is not None else None
    return rank(
        sites,
        payload.answers,
        payload.location,
        history=history,
        snoozed={code.lower() for code in payload.snoozed},
        reviews=reviews,
    )
