"""
The passport, computed from trip entries (nothing about it is stored).

A stamp is earned for each of the 63 national parks by logging a visit;
visits to other NPS sites are journaled but don't stamp. Stamps group into
the ten regions in app/regions.py, and achievements are milestones over the
same entries.

Pure functions over already-loaded rows, so the rules can be tested without
a database. app/routers/passport.py loads the entries and decides which the
viewer may see; a friend's passport is built only from the entries they
shared.
"""

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass

from app.models import Site, TripEntry
from app.regions import REGIONS, region_for_states
from app.schemas import (
    AchievementOut,
    PassportStampOut,
    RegionProgressOut,
)

# Park-count milestones: (id, title, how many parks).
PARK_MILESTONES = [
    ("first_stamp", "First stamp", 1),
    ("five_parks", "Trail regular", 5),
    ("ten_parks", "Park hopper", 10),
    ("twenty_five_parks", "Seasoned explorer", 25),
    ("half_the_parks", "Halfway there", 32),
]


@dataclass
class _Tally:
    count: int = 0
    first: object = None
    last: object = None
    latest_trip_id: int | None = None


def _achievement(id: str, title: str, description: str, progress: int, goal: int) -> AchievementOut:
    return AchievementOut(
        id=id,
        title=title,
        description=description,
        earned=progress >= goal,
        progress=min(progress, goal),
        goal=goal,
    )


def build_stamps(parks: Iterable[Site], entries: Iterable[TripEntry]) -> list[PassportStampOut]:
    """One stamp per national park (by name), earned if any entry is for it."""
    tallies: dict[int, _Tally] = defaultdict(_Tally)
    for e in entries:
        t = tallies[e.site_id]
        t.count += 1
        t.first = e.visited_on if t.first is None else min(t.first, e.visited_on)
        # The latest visit; the newest-logged entry wins a tie on the same day.
        if t.last is None or (e.visited_on, e.id) >= (t.last, t.latest_trip_id or 0):
            t.last = e.visited_on
            t.latest_trip_id = e.id
    stamps = []
    for park in sorted(parks, key=lambda p: p.name):
        t = tallies.get(park.id)
        stamps.append(
            PassportStampOut(
                park_code=park.park_code,
                name=park.name,
                states=park.states,
                region=region_for_states(park.states),
                earned=t is not None,
                visit_count=t.count if t else 0,
                first_visited_on=t.first if t else None,
                last_visited_on=t.last if t else None,
                latest_trip_id=t.latest_trip_id if t else None,
            )
        )
    return stamps


def build_regions(stamps: list[PassportStampOut]) -> list[RegionProgressOut]:
    out = []
    for region_id, label, _ in REGIONS:
        in_region = [s for s in stamps if s.region == region_id]
        visited = sum(s.earned for s in in_region)
        out.append(
            RegionProgressOut(
                id=region_id,
                label=label,
                visited=visited,
                total=len(in_region),
                complete=bool(in_region) and visited == len(in_region),
            )
        )
    return out


def build_achievements(
    stamps: list[PassportStampOut],
    regions: list[RegionProgressOut],
    entries: list[TripEntry],
) -> list[AchievementOut]:
    visited = sum(s.earned for s in stamps)
    total = len(stamps)
    out = [
        _achievement(
            id, title, f"Visit {goal} national park{'s' if goal != 1 else ''}.", visited, goal
        )
        for id, title, goal in PARK_MILESTONES
        # With fewer parks in the database than a milestone asks for (tests,
        # a partial sync) it could never be earned, so leave it out.
        if goal <= total
    ]
    if total:
        out.append(
            _achievement(
                "every_park", "All 63", f"Visit all {total} national parks.", visited, total
            )
        )
    regions_visited = sum(r.visited > 0 for r in regions)
    out += [
        _achievement(
            "region_complete",
            "Region complete",
            "Visit every national park in one region.",
            int(any(r.complete for r in regions)),
            1,
        ),
        _achievement(
            "five_regions",
            "Coast to coast",
            "Visit a national park in 5 different regions.",
            regions_visited,
            5,
        ),
        _achievement(
            "return_visitor",
            "Return visitor",
            "Go back to a park you've already visited.",
            int(any(s.visit_count >= 2 for s in stamps)),
            1,
        ),
        _achievement(
            "with_friends",
            "Better together",
            "Log a trip with a friend.",
            int(any(e.companions for e in entries)),
            1,
        ),
        _achievement(
            "photographer",
            "Photographer",
            "Add photos to 5 trips.",
            sum(bool(e.photos) for e in entries),
            5,
        ),
        _achievement(
            "five_star",
            "Five stars",
            "Give a trip five stars.",
            int(any(e.rating == 5 for e in entries)),
            1,
        ),
    ]
    return out
