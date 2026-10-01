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
