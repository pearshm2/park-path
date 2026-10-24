"""
Schema tests for the week 4 tables (user_tag_weights, site_feedback).
There are no routes yet, so these exercise the database rules directly:
uniqueness, the rating check, and cascading deletes. Needs a real Postgres.
"""

import uuid

import pytest
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models import Site, SiteFeedback, User, UserTagWeight


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def user_and_site(db):
    user = User(
        email=f"schema-{uuid.uuid4().hex[:10]}@example.com",
        username=f"s_{uuid.uuid4().hex[:12]}",
        first_name="Schema",
        hashed_password="x",
    )
    site = Site(park_code=f"t{uuid.uuid4().hex[:8]}", name="Schema Test Park")
    db.add_all([user, site])
    db.commit()
    yield user, site
    db.rollback()
    db.execute(delete(User).where(User.id == user.id))
    db.execute(delete(Site).where(Site.id == site.id))
    db.commit()


def test_tag_weight_roundtrip_and_defaults(db, user_and_site):
    user, _ = user_and_site
    db.add(UserTagWeight(user_id=user.id, tag="terrain:canyon", weight=-0.5))
    db.commit()
    row = db.scalars(select(UserTagWeight).where(UserTagWeight.user_id == user.id)).one()
    assert (row.tag, row.weight) == ("terrain:canyon", -0.5)  # negatives are allowed
    assert row.updated_at is not None


def test_one_weight_per_user_per_tag(db, user_and_site):
    user, _ = user_and_site
    db.add(UserTagWeight(user_id=user.id, tag="season:fall", weight=1.0))
    db.commit()
    db.add(UserTagWeight(user_id=user.id, tag="season:fall", weight=2.0))
    with pytest.raises(IntegrityError):
        db.commit()


def test_feedback_roundtrip(db, user_and_site):
    user, site = user_and_site
    db.add(SiteFeedback(user_id=user.id, site_id=site.id, rating=-1))
    db.commit()
    row = db.scalars(select(SiteFeedback).where(SiteFeedback.user_id == user.id)).one()
    assert row.rating == -1
    assert row.created_at is not None and row.updated_at is not None


def test_changing_a_vote_updates_the_row(db, user_and_site):
    user, site = user_and_site
    feedback = SiteFeedback(user_id=user.id, site_id=site.id, rating=-1)
    db.add(feedback)
    db.commit()
    feedback.rating = 1
    db.commit()
    rows = db.scalars(select(SiteFeedback).where(SiteFeedback.user_id == user.id)).all()
    assert [r.rating for r in rows] == [1]


def test_one_feedback_row_per_user_per_site(db, user_and_site):
    user, site = user_and_site
    db.add(SiteFeedback(user_id=user.id, site_id=site.id, rating=1))
    db.commit()
    db.add(SiteFeedback(user_id=user.id, site_id=site.id, rating=-1))
    with pytest.raises(IntegrityError):
        db.commit()


@pytest.mark.parametrize("rating", [0, 2, -2])
def test_rating_must_be_up_or_down(db, user_and_site, rating):
    user, site = user_and_site
    db.add(SiteFeedback(user_id=user.id, site_id=site.id, rating=rating))
    with pytest.raises(IntegrityError):
        db.commit()


def test_feedback_needs_a_real_user_and_site(db, user_and_site):
    user, site = user_and_site
    db.add(SiteFeedback(user_id=user.id, site_id=-1, rating=1))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    db.add(UserTagWeight(user_id=-1, tag="terrain:desert", weight=1.0))
    with pytest.raises(IntegrityError):
        db.commit()


def test_deleting_user_or_site_cascades(db):
    user = User(
        email=f"schema-{uuid.uuid4().hex[:10]}@example.com",
        username=f"s_{uuid.uuid4().hex[:12]}",
        first_name="Schema",
        hashed_password="x",
    )
    site = Site(park_code=f"t{uuid.uuid4().hex[:8]}", name="Cascade Park")
    db.add_all([user, site])
    db.commit()
    db.add_all(
        [
            UserTagWeight(user_id=user.id, tag="terrain:coast", weight=1.0),
            SiteFeedback(user_id=user.id, site_id=site.id, rating=1),
        ]
    )
    db.commit()

    # Removing a site drops its feedback but keeps the user and their weights.
    db.execute(delete(Site).where(Site.id == site.id))
    db.commit()
    assert db.scalars(select(SiteFeedback).where(SiteFeedback.user_id == user.id)).all() == []
    assert len(db.scalars(select(UserTagWeight).where(UserTagWeight.user_id == user.id)).all()) == 1

    # Removing the user takes their weights with them.
    db.execute(delete(User).where(User.id == user.id))
    db.commit()
    assert db.scalars(select(UserTagWeight).where(UserTagWeight.user_id == user.id)).all() == []
