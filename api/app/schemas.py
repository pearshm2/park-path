"""
Pydantic schemas (request/response shapes) — kept separate from
app/models.py on purpose. models.py describes the database; this
describes the API. They'll diverge over time (e.g. responses should
never include hashed_password) and conflating them is a common source
of accidental data leaks.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SiteOut(BaseModel):
    """
    One NPS site. Curated fields are null for sites nobody has filled in
    yet (most of the non-park units), so clients must handle missing values.
    """

    model_config = ConfigDict(from_attributes=True)

    park_code: str
    name: str
    designation: str | None
    states: str | None
    latitude: float | None
    longitude: float | None
    description: str | None
    nps_url: str | None
    image_url: str | None

    is_named_park: bool
    terrain_group: str | None
    feature: str | None
    effort: int | None
    typical_days: int | None
    seasons: list[str] | None
    permit_required: bool | None
    annual_visits_millions: float | None


class FriendRequestCreate(BaseModel):
    email: EmailStr


class FriendshipOut(BaseModel):
    """A friend request, pending or accepted, with both people named."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    status: Literal["pending", "accepted"]
    created_at: datetime
    accepted_at: datetime | None
    requester: UserOut
    addressee: UserOut


class FriendOut(BaseModel):
    """One entry in the signed-in user's friends list: the *other* person."""

    friendship_id: int
    user: UserOut
    since: datetime | None


class WishlistItemOut(BaseModel):
    """One saved site. The app already has the site details from GET /sites."""

    park_code: str
    added_at: datetime


# --- Recommendations (POST /recommendations) --------------------------------

QuizTerrain = Literal["mountain", "canyon", "desert", "forest", "coast", "water"]
Season = Literal["winter", "spring", "summer", "fall"]


class QuizAnswers(BaseModel):
    """The onboarding quiz, as the app sends it. Every question is required."""

    terrains: list[QuizTerrain] = Field(min_length=1)
    # Ranked, favourite first. An empty list means "Any season works for me".
    seasons: list[Season] = Field(max_length=4)
    crowds: Literal["icons", "either", "quiet"]

    @field_validator("terrains", "seasons")
    @classmethod
    def no_repeats(cls, value: list[str]) -> list[str]:
        if len(value) != len(set(value)):
            raise ValueError("each answer can only be picked once")
        return value


class Location(BaseModel):
    """Where the person starts, already converted from their zip code by the app."""

    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class RecommendationRequest(BaseModel):
    answers: QuizAnswers
    # The quiz requires a zip code, but the API accepts a request without
    # one, so the app can integrate before its zip lookup exists. Without
    # it, distance just isn't scored.
    location: Location | None = None


class SignalScores(BaseModel):
    """Each signal's match from 0 to 1, or null when it isn't in use."""

    distance: float | None
    terrain: float | None
    season: float | None
    crowds: float | None


class RecommendationOut(BaseModel):
    park_code: str
    # 0 to 1. Null for sites with no curated data yet.
    score: float | None
    reason: str | None
    signals: SignalScores


# --- Park maps (GET /sites/{park_code}/map) ---------------------------------

# A path is a list of [longitude, latitude] points.
Path = list[list[float]]


class TrailOut(BaseModel):
    name: str | None  # None for unnamed connectors: drawn, not listed
    uses: list[Literal["hike", "horse", "bike", "motorized"]]
    surface: str | None
    closed: bool  # temporarily closed
    length_miles: float
    paths: list[Path]


class RoadOut(BaseModel):
    name: str | None
    kind: Literal["primary", "secondary", "local", "4wd"]
    paths: list[Path]


class ParkMapOut(BaseModel):
    park_code: str
    boundary: list[Path]  # rings; fill with the even-odd rule
    roads: list[RoadOut]
    trails: list[TrailOut]
    # The park's own maps page on nps.gov, with the official brochure map.
    official_map_url: str
    synced_at: datetime
