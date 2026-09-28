"""
SQLAlchemy models live here (or split into app/models/ once this grows —
e.g. users.py, parks.py, trips.py — and import them all into __init__.py
so Alembic still sees every table through Base.metadata).

Nothing to migrate yet this week; this file just proves the Base/engine/
Alembic wiring works end to end. Week 2+ (auth, quiz, parks) adds real
tables here.
"""

from sqlalchemy import Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class HealthCheck(Base):
    """
    Throwaway table used only to prove Alembic migrations run against
    the real database. Safe to delete once real models exist —
    just also delete/replace its migration.
    """

    __tablename__ = "health_check"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
