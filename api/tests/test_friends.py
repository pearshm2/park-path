"""
Friendship tests: requests, accept/decline/cancel, unfriend, and the
visibility rules. Like the auth tests these need a real Postgres
(DATABASE_URL) — the pair-uniqueness rule is a Postgres index.

Each test gets fresh users (unique emails) and deletes them afterwards;
friendship rows go with them (ON DELETE CASCADE).
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.database import SessionLocal
from app.main import app
from app.models import Friendship, User
from app.visibility import Visibility, are_friends, can_view, friend_ids

client = TestClient(app)


class Person:
    def __init__(self):
        self.email = f"friend-{uuid.uuid4().hex[:10]}@example.com"
        resp = client.post("/auth/signup", json={"email": self.email, "password": "correct-horse"})
        self.headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
        self.id = client.get("/auth/me", headers=self.headers).json()["id"]

    def request(self, other: "Person"):
        return client.post("/friends/requests", json={"email": other.email}, headers=self.headers)

    def befriend(self, other: "Person") -> int:
        """Send + accept; returns the friendship id."""
        friendship_id = self.request(other).json()["id"]
        accepted = client.post(
            f"/friends/requests/{friendship_id}/accept", headers=other.headers
        )
        assert accepted.status_code == 200
        return friendship_id


@pytest.fixture
def people():
    created: list[Person] = []

    def make() -> Person:
        person = Person()
        created.append(person)
        return person

    yield make

    with SessionLocal() as db:
        db.execute(delete(User).where(User.id.in_([p.id for p in created])))
        db.commit()


# --- sending requests ------------------------------------------------------


def test_requires_login():
    assert client.get("/friends").status_code == 401
    assert client.post("/friends/requests", json={"email": "a@example.com"}).status_code == 401


def test_send_request_creates_pending(people):
    ann, bob = people(), people()
    response = ann.request(bob)
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["requester"]["id"] == ann.id
    assert body["addressee"]["id"] == bob.id
    assert body["accepted_at"] is None
    assert "hashed_password" not in str(body)


def test_request_email_lookup_ignores_case(people):
    ann, bob = people(), people()
    response = client.post(
        "/friends/requests", json={"email": bob.email.upper()}, headers=ann.headers
    )
    assert response.status_code == 201


def test_cannot_friend_yourself(people):
    ann = people()
    assert ann.request(ann).status_code == 400


def test_unknown_email_is_404(people):
    ann = people()
    response = client.post(
        "/friends/requests", json={"email": "nobody-here@example.com"}, headers=ann.headers
    )
    assert response.status_code == 404


def test_duplicate_request_rejected(people):
    ann, bob = people(), people()
    ann.request(bob)
    assert ann.request(bob).status_code == 409


def test_request_to_existing_friend_rejected(people):
    ann, bob = people(), people()
    ann.befriend(bob)
    assert ann.request(bob).status_code == 409
    assert bob.request(ann).status_code == 409


def test_requesting_back_accepts_the_pending_request(people):
    ann, bob = people(), people()
    ann.request(bob)
    response = bob.request(ann)
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"
    assert are_friends_now(ann, bob)


def test_database_refuses_a_second_row_for_the_same_pair(people):
    """The unique pair index is the backstop for two requests racing."""
    from sqlalchemy.exc import IntegrityError

    ann, bob = people(), people()
    ann.request(bob)
    with SessionLocal() as db:
        db.add(Friendship(requester_id=bob.id, addressee_id=ann.id, status="pending"))
        with pytest.raises(IntegrityError):
            db.commit()


# --- listing, accepting, declining ----------------------------------------


def test_incoming_and_outgoing_lists(people):
    ann, bob = people(), people()
    request_id = ann.request(bob).json()["id"]

    incoming = client.get("/friends/requests", headers=bob.headers).json()
    assert [r["id"] for r in incoming] == [request_id]
    assert client.get("/friends/requests", headers=ann.headers).json() == []

    outgoing = client.get("/friends/requests?direction=outgoing", headers=ann.headers).json()
    assert [r["id"] for r in outgoing] == [request_id]
    assert client.get("/friends/requests?direction=outgoing", headers=bob.headers).json() == []


def test_accept_makes_friends_both_ways(people):
    ann, bob = people(), people()
    request_id = ann.request(bob).json()["id"]

    response = client.post(f"/friends/requests/{request_id}/accept", headers=bob.headers)
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"
    assert response.json()["accepted_at"] is not None

    ann_friends = client.get("/friends", headers=ann.headers).json()
    bob_friends = client.get("/friends", headers=bob.headers).json()
    assert [f["user"]["id"] for f in ann_friends] == [bob.id]
    assert [f["user"]["id"] for f in bob_friends] == [ann.id]
    # Accepted requests leave the pending lists.
    assert client.get("/friends/requests", headers=bob.headers).json() == []


def test_only_the_addressee_can_accept(people):
    ann, bob = people(), people()
    request_id = ann.request(bob).json()["id"]
    response = client.post(f"/friends/requests/{request_id}/accept", headers=ann.headers)
    assert response.status_code == 403
    assert client.get("/friends", headers=ann.headers).json() == []


def test_strangers_cannot_see_or_touch_a_request(people):
    ann, bob, eve = people(), people(), people()
    request_id = ann.request(bob).json()["id"]
    accept = client.post(f"/friends/requests/{request_id}/accept", headers=eve.headers)
    decline = client.delete(f"/friends/requests/{request_id}", headers=eve.headers)
    assert accept.status_code == 404
    assert decline.status_code == 404
    assert client.get("/friends/requests", headers=eve.headers).json() == []


def test_accept_twice_is_conflict(people):
    ann, bob = people(), people()
    request_id = ann.request(bob).json()["id"]
    client.post(f"/friends/requests/{request_id}/accept", headers=bob.headers)
    response = client.post(f"/friends/requests/{request_id}/accept", headers=bob.headers)
    assert response.status_code == 409


def test_accept_unknown_request_is_404(people):
    assert client.post("/friends/requests/0/accept", headers=people().headers).status_code == 404


def test_decline_deletes_and_allows_a_new_request(people):
    ann, bob = people(), people()
    request_id = ann.request(bob).json()["id"]
    assert client.delete(f"/friends/requests/{request_id}", headers=bob.headers).status_code == 204
    assert client.get("/friends/requests", headers=bob.headers).json() == []
    assert ann.request(bob).status_code == 201


def test_sender_can_cancel(people):
    ann, bob = people(), people()
    request_id = ann.request(bob).json()["id"]
    assert client.delete(f"/friends/requests/{request_id}", headers=ann.headers).status_code == 204
    assert client.get("/friends/requests", headers=bob.headers).json() == []


def test_request_delete_cannot_unfriend(people):
    ann, bob = people(), people()
    friendship_id = ann.befriend(bob)
    response = client.delete(f"/friends/requests/{friendship_id}", headers=ann.headers)
    assert response.status_code == 409
    assert are_friends_now(ann, bob)


# --- unfriending -----------------------------------------------------------


def test_unfriend_works_from_either_side(people):
    ann, bob, cat = people(), people(), people()
    ann.befriend(bob)
    cat.befriend(ann)

    assert client.delete(f"/friends/{bob.id}", headers=ann.headers).status_code == 204
    assert not are_friends_now(ann, bob)
    assert client.delete(f"/friends/{ann.id}", headers=cat.headers).status_code == 204
    assert client.get("/friends", headers=ann.headers).json() == []


def test_unfriend_a_non_friend_is_404(people):
    ann, bob = people(), people()
    assert client.delete(f"/friends/{bob.id}", headers=ann.headers).status_code == 404
    ann.request(bob)  # pending is not friendship
    assert client.delete(f"/friends/{bob.id}", headers=ann.headers).status_code == 404


# --- visibility ------------------------------------------------------------


def are_friends_now(a: Person, b: Person) -> bool:
    with SessionLocal() as db:
        return are_friends(db, a.id, b.id)


def test_friend_profile_visible_only_to_friends(people):
    ann, bob, eve = people(), people(), people()
    ann.befriend(bob)

    assert client.get(f"/friends/{ann.id}", headers=bob.headers).json()["email"] == ann.email
    assert client.get(f"/friends/{bob.id}", headers=ann.headers).status_code == 200
    # Stranger: 404, indistinguishable from a user that doesn't exist.
    assert client.get(f"/friends/{ann.id}", headers=eve.headers).status_code == 404
    assert client.get("/friends/0", headers=eve.headers).status_code == 404
    # Not even your own id.
    assert client.get(f"/friends/{ann.id}", headers=ann.headers).status_code == 404


def test_pending_request_shares_nothing(people):
    ann, bob = people(), people()
    ann.request(bob)
    assert client.get(f"/friends/{ann.id}", headers=bob.headers).status_code == 404
    assert client.get(f"/friends/{bob.id}", headers=ann.headers).status_code == 404


def test_visibility_rules(people):
    ann, bob, eve = people(), people(), people()
    ann.befriend(bob)
    eve.request(ann)  # pending only

    with SessionLocal() as db:
        # Owner always sees their own, at any level.
        assert can_view(db, ann.id, ann.id, Visibility.PRIVATE)
        assert can_view(db, ann.id, ann.id, Visibility.FRIENDS)
        # PRIVATE: nobody else, friend or not.
        assert not can_view(db, bob.id, ann.id, Visibility.PRIVATE)
        assert not can_view(db, eve.id, ann.id, Visibility.PRIVATE)
        # FRIENDS: accepted friends only, in both directions.
        assert can_view(db, bob.id, ann.id, "friends")
        assert can_view(db, ann.id, bob.id, "friends")
        assert not can_view(db, eve.id, ann.id, Visibility.FRIENDS)
        assert not can_view(db, ann.id, eve.id, Visibility.FRIENDS)
        # Unknown levels are an error, never silently public.
        with pytest.raises(ValueError):
            can_view(db, bob.id, ann.id, "public")


def test_friend_ids_lists_accepted_friends_only(people):
    ann, bob, cat, eve = people(), people(), people(), people()
    ann.befriend(bob)
    cat.befriend(ann)
    eve.request(ann)
    with SessionLocal() as db:
        assert friend_ids(db, ann.id) == {bob.id, cat.id}
        assert friend_ids(db, eve.id) == set()
