"""
Pydantic schemas (request/response shapes) — kept separate from
app/models.py on purpose. models.py describes the database; this
describes the API. They'll diverge over time (e.g. responses should
never include hashed_password) and conflating them is a common source
of accidental data leaks.
"""

from pydantic import BaseModel, ConfigDict, EmailStr


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
