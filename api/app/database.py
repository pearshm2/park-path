"""
SQLAlchemy 2.0 engine + session setup.

Backend team: models go in app/models.py and subclass Base. Alembic picks
up Base.metadata automatically (see alembic/env.py) so `alembic revision
--autogenerate` will detect new tables/columns without extra wiring.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
