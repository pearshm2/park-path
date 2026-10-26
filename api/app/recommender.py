"""
The recommendation engine (v2): a weighted-sum model with a terrain gate.

For every site, each quiz signal gets a match score from 0 to 1:

    terrain   whether the site's terrain is one they picked
    distance  how close the site is to where the person starts
    season    how well the site suits their ranked seasons
    crowds    whether the site is as busy (or as quiet) as they want

The score is built in three steps:

1. Weighted average of the signals in use:

       base = sum(weight * score) / sum(weight)

   A signal is "not in use" (None) when the person has no preference ("Any
   season works", all four seasons ranked, "Fine either way"), when no
   location was sent, or when the site has no data for it. Leaving it out
   of both sums spreads its weight across the others.

2. The terrain gate: a site whose terrain isn't one they picked has its
   score multiplied by TERRAIN_MISS_FACTOR. Terrain is what the person
   asked for most directly, so a nearby park with the wrong scenery
   shouldn't outrank a real match (v1's main problem).

3. Trip history (only when the person is signed in): parks they've already
   visited are multiplied by VISITED_FACTOR, since the question is "where
   to next?". Unvisited parks with a terrain they rated 4 or 5 stars get a
   small LOVED_TERRAIN_BONUS.

Sites with no curated data (no terrain, seasons or visitor numbers) get a
total of None: there is nothing honest to score them on yet.

This module is plain Python with no database or web code, so it can be
tested on its own. app/routers/recommendations.py feeds it real sites.
"""

import math
from bisect import bisect_left, bisect_right
from dataclasses import dataclass

# ---------------------------------------------------------------------------
# Settings. Change these, not the code below, to retune the engine.
# ---------------------------------------------------------------------------

# How much each signal counts. Only the ratios matter: they are rescaled
# over whichever signals are in use for a given site.
DEFAULT_WEIGHTS: dict[str, float] = {
    "terrain": 0.36,
    "distance": 0.28,
    "season": 0.25,
    "crowds": 0.11,
}

# A site whose terrain isn't one of the person's picks keeps this share of
# its score. 0.5 halves it, enough that closeness can't make up for it.
TERRAIN_MISS_FACTOR = 0.5

# Credit for a site that's good in the person's 1st, 2nd, 3rd, 4th-ranked season.
SEASON_RANK_CREDIT = [1.0, 0.6, 0.35, 0.15]

# Distance: full credit up to FULL miles, fading linearly to zero at ZERO
# miles. ZERO is about coast to coast, so far parks still differ a little
# (Utah ranks above Alaska from the East Coast).
DISTANCE_FULL_MILES = 100  # roughly a day trip
DISTANCE_ZERO_MILES = 2500

# Trip history (signed-in users only).
VISITED_FACTOR = 0.6  # parks already visited move down the list
LOVED_RATING = 4  # a trip rated this many stars or more counts as loved
LOVED_TERRAIN_BONUS = 0.05  # added for unvisited parks with a loved terrain

# The quiz offers six terrains; the curated data uses nine. These three
# are folded into the closest quiz answer (its description names them).
TERRAIN_ALIASES = {
    "caves": "forest",  # Forest: "Old growth, ridge, cave country"
    "dunes": "desert",  # Desert: "Basin, dunes, lava"
    "badlands": "canyon",  # Canyons & rock: "Sandstone, hoodoos, gorges"
}

ALL_SEASONS = {"winter", "spring", "summer", "fall"}

# A signal must score at least this to be mentioned in the "why" text.
REASON_THRESHOLD = 0.6

# How each terrain group is named in the "why" text, e.g. "Canyon terrain".
TERRAIN_LABELS = {
    "mountain": "Mountain",
    "canyon": "Canyon",
    "desert": "Desert",
    "forest": "Forest",
    "coast": "Coastal",
    "water": "Lake and river",
    "caves": "Cave",
    "dunes": "Dune",
    "badlands": "Badlands",
}


# ---------------------------------------------------------------------------
# Input shapes
# ---------------------------------------------------------------------------


@dataclass
class SiteData:
    """The parts of a site the engine needs. Curated fields may be None."""

    park_code: str
    name: str
    latitude: float | None
    longitude: float | None
    terrain_group: str | None
    seasons: list[str] | None
    annual_visits_millions: float | None
    # A national park (not a monument, seashore, ...); only these can be
    # "something different", since the app's top picks are parks.
    is_named_park: bool = False

    @property
    def is_curated(self) -> bool:
        return self.terrain_group is not None

    @property
    def quiz_terrain(self) -> str | None:
        """The site's terrain as a quiz answer (caves -> forest, and so on)."""
        if self.terrain_group is None:
            return None
        return TERRAIN_ALIASES.get(self.terrain_group, self.terrain_group)


@dataclass
class Visit:
    """One park the signed-in person has logged a trip to."""

    park_code: str
    name: str
    terrain_group: str | None
    # Their best rating across trips there, 1 to 5; None if never rated.
    rating: int | None


# ---------------------------------------------------------------------------
# One function per signal. Each returns a score from 0 to 1, or None.
# ---------------------------------------------------------------------------


def terrain_score(site: SiteData, terrains: list[str]) -> float | None:
    if site.quiz_terrain is None:
        return None
    return 1.0 if site.quiz_terrain in terrains else 0.0


def season_score(site: SiteData, ranked_seasons: list[str]) -> float | None:
    """Credit for the best-ranked of the person's seasons that the site suits."""
    # "Any season works for me", or every season ranked: no preference.
    if not ranked_seasons or set(ranked_seasons) >= ALL_SEASONS:
        return None
    if not site.seasons:
        return None
    best = 0.0
    for rank, season in enumerate(ranked_seasons):
        if season in site.seasons:
            best = max(best, SEASON_RANK_CREDIT[rank])
    return best


def visits_percentile(visits: float, all_visits_sorted: list[float]) -> float:
    """
    Where a site's visitor count falls among all curated sites, 0 (quietest)
    to 1 (busiest). A percentile instead of raw numbers, because visits are
    lopsided: Great Smoky has ~13 million a year, many sites well under one.
    """
    n = len(all_visits_sorted)
    if n <= 1:
        return 0.5
    below = bisect_left(all_visits_sorted, visits)
    equal = bisect_right(all_visits_sorted, visits) - below
    return (below + equal / 2 - 0.5) / (n - 1)


def crowds_score(site: SiteData, preference: str, all_visits_sorted: list[float]) -> float | None:
    if preference == "either":  # "Fine either way"
        return None
    if site.annual_visits_millions is None:
        return None
    busy = visits_percentile(site.annual_visits_millions, all_visits_sorted)
    return busy if preference == "icons" else 1.0 - busy


def miles_between(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Straight-line ("as the crow flies") distance on the Earth, in miles."""
    earth_radius_miles = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * earth_radius_miles * math.asin(math.sqrt(a))


def distance_score(miles: float | None) -> float | None:
    if miles is None:
        return None
    if miles <= DISTANCE_FULL_MILES:
        return 1.0
    if miles >= DISTANCE_ZERO_MILES:
        return 0.0
    return 1.0 - (miles - DISTANCE_FULL_MILES) / (DISTANCE_ZERO_MILES - DISTANCE_FULL_MILES)


# ---------------------------------------------------------------------------
# Combining the signals
# ---------------------------------------------------------------------------


def combine(signals: dict[str, float | None], weights: dict[str, float]) -> float | None:
    """Weighted average over the signals that aren't None."""
    in_use = {name: s for name, s in signals.items() if s is not None}
    total_weight = sum(weights[name] for name in in_use)
    if total_weight == 0:
        return None
    return sum(weights[name] * s for name, s in in_use.items()) / total_weight


def loved_terrains(history: dict[str, Visit]) -> dict[str, Visit]:
    """Quiz terrain -> the best-rated park they loved with that terrain."""
    loved: dict[str, Visit] = {}
    for visit in history.values():
        if visit.rating is None or visit.rating < LOVED_RATING or visit.terrain_group is None:
            continue
        terrain = TERRAIN_ALIASES.get(visit.terrain_group, visit.terrain_group)
        current = loved.get(terrain)
        if current is None or (visit.rating or 0) > (current.rating or 0):
            loved[terrain] = visit
    return loved


def build_reason(
    site: SiteData,
    signals: dict[str, float | None],
    weights: dict[str, float],
    ranked_seasons: list[str],
    crowd_preference: str,
    miles: float | None,
    loved_like: Visit | None,
) -> str:
    """Up to two short phrases for what helped this site most."""
    phrases: dict[str, str] = {}

    if (signals["terrain"] or 0) >= REASON_THRESHOLD:
        label = TERRAIN_LABELS.get(site.terrain_group, site.terrain_group.title())
        phrases["terrain"] = f"{label} terrain"

    if (signals["season"] or 0) >= REASON_THRESHOLD:
        best = next(s for s in ranked_seasons if s in (site.seasons or []))
        phrases["season"] = f"{'great' if best == ranked_seasons[0] else 'good'} in {best}"

    if (signals["crowds"] or 0) >= REASON_THRESHOLD:
        phrases["crowds"] = (
            "one of the iconic, busier parks"
            if crowd_preference == "icons"
            else "quieter than most parks"
        )

    if (signals["distance"] or 0) >= REASON_THRESHOLD and miles is not None:
        phrases["distance"] = f"about {round(miles, -1):.0f} miles away"

    # Most helpful first: the signal's weight times its score.
    order = sorted(phrases, key=lambda name: weights[name] * (signals[name] or 0), reverse=True)
    parts = [phrases[name] for name in order]

    # Something they loved is the most persuasive reason, so it leads.
    if loved_like is not None:
        parts.insert(0, f"like {loved_like.name}, which you loved")

    if not parts:
        return "A partial match on your answers"
    text = ", ".join(parts[:2])
    return text[0].upper() + text[1:]


def rank(
    sites: list[SiteData],
    answers,
    location=None,
    weights=None,
    history: dict[str, Visit] | None = None,
) -> list[dict]:
    """
    Score every site against the quiz answers and return them best first.

    `answers` needs .terrains, .seasons (ranked; empty = any) and .crowds.
    `location` is None or has .lat and .lon.
    `history` is the signed-in person's visited parks by park_code, or None.
    Sites with no curated data come last, with score None.
    """
    weights = weights or DEFAULT_WEIGHTS
    history = history or {}
    loved = loved_terrains(history)
    all_visits = sorted(
        s.annual_visits_millions for s in sites if s.annual_visits_millions is not None
    )

    results = []
    for site in sites:
        miles = None
        if location is not None and site.latitude is not None and site.longitude is not None:
            miles = miles_between(location.lat, location.lon, site.latitude, site.longitude)

        signals = {
            "terrain": terrain_score(site, answers.terrains),
            "distance": distance_score(miles),
            "season": season_score(site, answers.seasons),
            "crowds": crowds_score(site, answers.crowds, all_visits),
        }
        visited = site.park_code in history

        score, reason = None, None
        if site.is_curated:
            score = combine(signals, weights)
            if score is not None:
                # The terrain gate.
                if signals["terrain"] == 0.0:
                    score *= TERRAIN_MISS_FACTOR
                # Trip history.
                loved_like = None
                if visited:
                    score *= VISITED_FACTOR
                elif site.quiz_terrain in loved and signals["terrain"] == 1.0:
                    loved_like = loved[site.quiz_terrain]
                    score = min(1.0, score + LOVED_TERRAIN_BONUS)
                reason = build_reason(
                    site, signals, weights, answers.seasons, answers.crowds, miles, loved_like
                )

        results.append(
            {
                "park_code": site.park_code,
                "score": None if score is None else round(score, 3),
                "reason": reason,
                "signals": {k: None if v is None else round(v, 3) for k, v in signals.items()},
                "visited": visited,
                "different": False,
                # Used for picking and sorting only; not part of the response.
                "_site": site,
                "_visits": site.annual_visits_millions or 0,
                "_name": site.name,
            }
        )

    if history:
        flag_something_different(results, history, answers.terrains)

    # Scored sites first (best score, then the better-known site), then the
    # unscored ones alphabetically.
    results.sort(key=lambda r: (r["score"] is None, -(r["score"] or 0), -r["_visits"], r["_name"]))
    for r in results:
        del r["_visits"], r["_name"], r["_site"]
    return results


def flag_something_different(results: list[dict], history: dict[str, Visit], wanted: list[str]):
    """
    Mark the best-scoring national park whose terrain is new to them: no
    trip there yet, and not one of their quiz answers. Its reason says so.
    Nothing is marked if every terrain is covered.
    """
    tried = {
        TERRAIN_ALIASES.get(v.terrain_group, v.terrain_group)
        for v in history.values()
        if v.terrain_group is not None
    }
    candidates = [
        r
        for r in results
        if r["score"] is not None
        and r["_site"].is_named_park
        and not r["visited"]
        and r["_site"].quiz_terrain not in tried
        and r["_site"].quiz_terrain not in wanted
    ]
    if not candidates:
        return
    best = max(candidates, key=lambda r: (r["score"], r["_visits"]))
    site = best["_site"]
    label = TERRAIN_LABELS.get(site.terrain_group, site.terrain_group.title()).lower()
    best["different"] = True
    best["reason"] = f"Something different: no {label} parks in your trips yet"
