"""
The passport, computed from trip entries (nothing about it is stored).

A stamp is earned for each of the 63 national parks by logging a visit;
visits to other NPS sites are journaled but don't stamp. Stamps group into
the ten regions in app/regions.py.

Achievements come in three groups, the same ones (ids, names and wording)
the app's Passport shows, from mobile/src/data/achievements.ts; keep the
two in step:
  - National parks: tiers by how many national parks are stamped.
  - Regions: one per region, for stamping every national park in it.
  - All NPS sites: tiers by how many sites of any kind have a trip.
  - Friends: friends on ParkPath, and trips logged with a friend tagged.

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

# National-park tiers: (id, title, description, how many parks). None for
# "need" means it's worked out from how many parks there are.
PARK_TIERS = [
    ("parks-1", "First stamp", "Log a visit to any national park.", 1),
    ("parks-3", "Three down", "Three national parks stamped.", 3),
    ("parks-5", "High five", "Five national parks stamped.", 5),
    ("parks-10", "Ten parks", "Ten of the {total}.", 10),
    ("parks-15", "Trail regular", "Fifteen national parks stamped.", 15),
    ("parks-25", "Quarter of the way", "Twenty-five national parks stamped.", 25),
    ("parks-half", "Halfway there", "Half of the {total} national parks stamped.", None),
    ("parks-40", "Forty and counting", "Forty national parks stamped.", 40),
    ("parks-50", "Fifty states of mind", "Fifty national parks stamped.", 50),
    ("parks-all", "The whole list", "Every national park.", None),
]

# Each region's achievement: its name and a line about it.
REGION_ACHIEVEMENTS = {
    "pnw": ("Evergreen explorer", "rainforest, glaciers and volcanoes"),
    "california": ("Golden State rambler", "giant trees, granite and desert"),
    "southwest": ("Desert wanderer", "canyons, arches and slickrock"),
    "rockies": ("Peak bagger", "the high country of the Rockies"),
    "plains": ("Prairie rover", "badlands, caves and open sky"),
    "midwest": ("Great Lakes voyager", "lakeshores, islands and river valleys"),
    "northeast": ("Down East trekker", "granite coast and northern woods"),
    "appalachia": ("Blue Ridge rambler", "old mountains and deep hollows"),
    "gulf": ("Bayou to beach", "swamps, springs and coral keys"),
    "akhi": ("Last frontier & aloha", "tundra, glaciers and volcanoes"),
}

# Friends tiers: (id, title, description, how many friends).
FRIEND_TIERS = [
    ("friends-1", "First friend", "Add a friend on ParkPath.", 1),
    ("friends-3", "Trail crew", "Three friends on ParkPath.", 3),
]

# Together tiers: (id, title, description, how many trips with a friend along).
TOGETHER_TIERS = [
    ("together-1", "Better together", "Log a trip with a friend along.", 1),
    ("together-3", "Never hike alone", "Three trips with friends along.", 3),
]

# All-NPS-site tiers: (id, title, description, how many sites); None is all.
SITE_TIERS = [
    (
        "sites-5",
        "Beyond the parks",
        "Five NPS sites of any kind: monuments, historic sites, seashores and more.",
        5,
    ),
    ("sites-25", "Monument hunter", "Twenty-five NPS sites visited.", 25),
    ("sites-50", "Park service regular", "Fifty NPS sites visited.", 50),
    ("sites-100", "Century", "A hundred NPS sites visited.", 100),
    ("sites-250", "Lifetime pass", "Two hundred and fifty NPS sites visited.", 250),
    (
        "sites-all",
        "Every last site",
        "All {total} sites the National Park Service looks after.",
        None,
    ),
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
    sites_visited: int,
    sites_total: int,
    friends: int = 0,
    trips_with_friends: int = 0,
) -> list[AchievementOut]:
    """
    The four groups, in the app's order. `sites_visited` is how many
    different NPS sites (of any kind) have a trip; `sites_total` how many
    sites there are; `friends` how many friends they have; and
    `trips_with_friends` how many of their trips have a friend tagged.
    """
    visited = sum(s.earned for s in stamps)
    total = len(stamps)

    parks = []
    for id, title, description, need in PARK_TIERS:
        if need is None:
            need = -(-total // 2) if id == "parks-half" else total
        # With fewer parks than a tier asks for (tests, a partial sync) it
        # could never be earned, so leave it out.
        if 1 <= need <= total:
            parks.append(
                (need, _achievement(id, title, description.format(total=total), visited, need))
            )
    parks.sort(key=lambda pair: pair[0])
    out = [achievement for _, achievement in parks]

    for region in regions:
        if region.total == 0 or region.id not in REGION_ACHIEVEMENTS:
            continue
        title, flavor = REGION_ACHIEVEMENTS[region.id]
        how_many = "its one park" if region.total == 1 else f"all {region.total}"
        out.append(
            _achievement(
                f"region-{region.id}",
                title,
                f"Every national park in {region.label}: {how_many}, {flavor}.",
                region.visited,
                region.total,
            )
        )

    for id, title, description, need in SITE_TIERS:
        need = sites_total if need is None else need
        if 1 <= need <= sites_total:
            out.append(
                _achievement(
                    id, title, description.format(total=sites_total), sites_visited, need
                )
            )

    out += [
        _achievement(id, title, description, friends, need)
        for id, title, description, need in FRIEND_TIERS
    ]
    out += [
        _achievement(id, title, description, trips_with_friends, need)
        for id, title, description, need in TOGETHER_TIERS
    ]
    return out
