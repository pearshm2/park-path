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
   to next?".

4. Their reviews (stars and feedback tags on their trips) tune the rest
   (see `Taste`):

     stars + "Loved the scenery" / "Not my scenery"
         -> each terrain's score moves up or down by up to TERRAIN_TASTE
     "Peaceful" / "Too crowded"
         -> quieter parks count for more (even with "Fine either way")
     "Worth the drive" / "Too far"
         -> distance counts for less / more
     "Perfect timing" / "Wrong time of year"
         -> parks good in that trip's season get a little more / the
            season signal counts for more

   Every nudge goes through tanh(total / TASTE_SOFTNESS), so the first
   reviews count most and each later one a little less (diminishing
   returns): no single terrain or complaint can take over the list.

Sites with no curated data (no terrain, seasons or visitor numbers) get a
total of None: there is nothing honest to score them on yet.

This module is plain Python with no database or web code, so it can be
tested on its own. app/routers/recommendations.py feeds it real sites.
"""

import math
from bisect import bisect_left, bisect_right
from dataclasses import dataclass

from app.regions import REGION_LABELS, region_for_states

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

# Reviews (see `Taste`). How much each star rating nudges the trip's
# terrain: 3 stars is neutral.
STAR_NUDGE = {1: -1.0, 2: -0.5, 3: 0.0, 4: 0.5, 5: 1.0}
# A scenery tag nudges the terrain as much as 5 stars (or 1 star).
SCENERY_NUDGE = 1.0
# Larger = each review counts for less. With 2: one 5-star trip gives
# tanh(0.5) = 46% of the full effect, two give 76%, three 91%.
TASTE_SOFTNESS = 2.0
# The most a terrain's taste can add to (or take off) a score.
TERRAIN_TASTE = 0.08
# "Peaceful" counts half as much as "Too crowded" toward quiet.
PEACEFUL_NUDGE = 0.5
# At full strength, "Too far" makes distance count 1.6x; "Worth the
# drive", 0.4x.
DISTANCE_TASTE = 0.6
# At full strength, "Wrong time of year" makes the season signal count 1.5x.
SEASON_TIMING_TASTE = 0.5
# The most "Perfect timing" in a season adds to parks good in that season.
SEASON_TASTE = 0.04

# The feedback tags a trip can carry, in pairs (only one of each pair).
FEEDBACK_PAIRS = [
    ("loved_scenery", "not_my_scenery"),
    ("peaceful", "too_crowded"),
    ("worth_the_drive", "too_far"),
    ("perfect_timing", "wrong_season"),
]
FEEDBACK_TAGS = [tag for pair in FEEDBACK_PAIRS for tag in pair]

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
    # Its states as stored ("TN,NC"), for the map region it's in.
    states: str | None = None

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
    # The park's states ("TN,NC"), for the map region it's in.
    states: str | None = None


@dataclass
class Review:
    """One trip's review: its stars and feedback tags."""

    park_code: str
    name: str
    terrain_group: str | None
    rating: int | None
    feedback: list[str]
    # The month of the visit, 1 to 12, for its season; None if unknown.
    month: int | None = None


def season_of(month: int) -> str:
    """The (northern) season a month falls in."""
    return {12: "winter", 1: "winter", 2: "winter", 3: "spring", 4: "spring", 5: "spring",
            6: "summer", 7: "summer", 8: "summer"}.get(month, "fall")  # fmt: skip


def soften(total: float) -> float:
    """-1 to 1, with diminishing returns: tanh(total / TASTE_SOFTNESS)."""
    return math.tanh(total / TASTE_SOFTNESS)


@dataclass
class Taste:
    """
    What their reviews say, each part from -1 to 1 (0 = no say):

      terrain    quiz terrain -> how much they like it (stars, scenery tags)
      loved      quiz terrain -> their favourite park there (for the reason)
      quiet      0 to 1: how much they've asked for quieter parks
      distance   -1 ("worth the drive") to 1 ("too far")
      timing     0 to 1: how often the time of year was wrong
      seasons    season -> 0 to 1: how often it was perfect timing then
    """

    terrain: dict[str, float]
    loved: dict[str, "Review"]
    quiet: float = 0.0
    distance: float = 0.0
    timing: float = 0.0
    seasons: dict[str, float] | None = None

    @classmethod
    def from_reviews(cls, reviews: list["Review"]) -> "Taste":
        terrain_total: dict[str, float] = {}
        loved: dict[str, Review] = {}
        crowded = far = wrong = 0.0
        perfect: dict[str, float] = {}
        for review in reviews:
            tags = set(review.feedback)
            if review.terrain_group is not None:
                terrain = TERRAIN_ALIASES.get(review.terrain_group, review.terrain_group)
                nudge = STAR_NUDGE.get(review.rating or 3, 0.0)
                if "loved_scenery" in tags:
                    nudge += SCENERY_NUDGE
                if "not_my_scenery" in tags:
                    nudge -= SCENERY_NUDGE
                terrain_total[terrain] = terrain_total.get(terrain, 0.0) + nudge
                if (review.rating or 0) >= LOVED_RATING or "loved_scenery" in tags:
                    best = loved.get(terrain)
                    if best is None or (review.rating or 0) > (best.rating or 0):
                        loved[terrain] = review
            crowded += ("too_crowded" in tags) + PEACEFUL_NUDGE * ("peaceful" in tags)
            far += ("too_far" in tags) - ("worth_the_drive" in tags)
            wrong += "wrong_season" in tags
            if "perfect_timing" in tags and review.month is not None:
                season = season_of(review.month)
                perfect[season] = perfect.get(season, 0.0) + 1
        terrain = {t: soften(total) for t, total in terrain_total.items()}
        return cls(
            terrain=terrain,
            # Only terrains they like on balance.
            loved={t: r for t, r in loved.items() if terrain.get(t, 0) > 0},
            quiet=soften(crowded),
            distance=soften(far),
            timing=soften(wrong),
            seasons={s: soften(n) for s, n in perfect.items()},
        )

    def weights(self, weights: dict[str, float], crowd_preference: str) -> dict[str, float]:
        """The signal weights, retuned by their reviews."""
        out = dict(weights)
        out["distance"] *= 1 + DISTANCE_TASTE * self.distance
        out["season"] *= 1 + SEASON_TIMING_TASTE * self.timing
        if crowd_preference == "either":
            # "Fine either way", but they've asked for quiet: it fades in.
            out["crowds"] *= self.quiet
        elif crowd_preference == "quiet":
            out["crowds"] *= 1 + self.quiet
        else:
            # Want the icons, but found them too busy: busyness counts less.
            out["crowds"] *= 1 - 0.5 * self.quiet
        return out

    def bonus(self, site: "SiteData") -> float:
        """Added to (or taken off) a site's score for the terrain and seasons they like."""
        extra = TERRAIN_TASTE * self.terrain.get(site.quiz_terrain, 0.0)
        if self.seasons and site.seasons:
            extra += SEASON_TASTE * max(self.seasons.get(s, 0.0) for s in site.seasons)
        return extra


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


def build_reason(
    site: SiteData,
    signals: dict[str, float | None],
    weights: dict[str, float],
    ranked_seasons: list[str],
    crowd_preference: str,
    miles: float | None,
    loved_like: Review | None,
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
    snoozed: set[str] | None = None,
    reviews: list[Review] | None = None,
) -> list[dict]:
    """
    Score every site against the quiz answers and return them best first.

    `answers` needs .terrains, .seasons (ranked; empty = any) and .crowds.
    `location` is None or has .lat and .lon.
    `history` is the signed-in person's visited parks by park_code, or None.
    `snoozed` holds park codes they've set aside: never the wildcard.
    `reviews` is their trips' stars and feedback tags; without it, each
    visit's best rating stands in (no tags).
    Sites with no curated data come last, with score None.
    """
    history = history or {}
    if reviews is None:
        reviews = [
            Review(v.park_code, v.name, v.terrain_group, v.rating, []) for v in history.values()
        ]
    taste = Taste.from_reviews(reviews)
    weights = taste.weights(weights or DEFAULT_WEIGHTS, answers.crowds)
    all_visits = sorted(
        s.annual_visits_millions for s in sites if s.annual_visits_millions is not None
    )

    results = []
    for site in sites:
        miles = None
        if location is not None and site.latitude is not None and site.longitude is not None:
            miles = miles_between(location.lat, location.lon, site.latitude, site.longitude)

        # "Fine either way" with reviews asking for quiet: scored as quiet.
        crowd_answer = "quiet" if answers.crowds == "either" and taste.quiet > 0 else answers.crowds
        signals = {
            "terrain": terrain_score(site, answers.terrains),
            "distance": distance_score(miles),
            "season": season_score(site, answers.seasons),
            "crowds": crowds_score(site, crowd_answer, all_visits),
        }
        visited = site.park_code in history

        score, reason = None, None
        if site.is_curated:
            score = combine(signals, weights)
            if score is not None:
                # The terrain gate.
                if signals["terrain"] == 0.0:
                    score *= TERRAIN_MISS_FACTOR
                # Their reviews, then trip history.
                score = min(1.0, max(0.0, score + taste.bonus(site)))
                loved_like = None
                if visited:
                    score *= VISITED_FACTOR
                else:
                    loved_like = taste.loved.get(site.quiz_terrain)
                reason = build_reason(
                    site, signals, weights, answers.seasons, crowd_answer, miles, loved_like
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
        flag_something_different(
            results, history, answers.terrains, answers.crowds, snoozed or set()
        )

    # Scored sites first (best score, then the better-known site), then the
    # unscored ones alphabetically.
    results.sort(key=lambda r: (r["score"] is None, -(r["score"] or 0), -r["_visits"], r["_name"]))
    for r in results:
        del r["_visits"], r["_name"], r["_site"]
    return results


# "Something different": how far down the parks the usual picks go. The
# wildcard always comes from outside them, so it shows something new.
TOP_PICKS = 10
# A crowds score at least this good still suits their crowd answer.
CROWD_FIT = 0.5


def flag_something_different(
    results: list[dict],
    history: dict[str, Visit],
    wanted: list[str],
    crowds: str,
    snoozed: set[str] = frozenset(),
):
    """
    Flag one national park as "something different", from outside their top
    10 parks and never one they've been to, by the first of these that finds
    one (best score wins within it):

      1. a terrain they've never visited and didn't pick in the quiz;
      2. a map region they've never been to;
      3. their least-visited terrain outside their quiz picks;
      4. their least likely park (the lowest score) that still suits their
         crowd answer: the biggest surprise that keeps their one stated
         dealbreaker.

    Its reason says why it's different. Needs at least one trip (the
    caller checks). Parks they've set aside are left out entirely (the app
    hides them), so the top 10 and the wildcard match what the app shows.
    """
    parks = [
        r
        for r in results
        if r["score"] and r["_site"].is_named_park and r["park_code"] not in snoozed
    ]
    parks.sort(key=lambda r: (-r["score"], -r["_visits"], r["_name"]))
    candidates = [r for r in parks[TOP_PICKS:] if not r["visited"]]
    if not candidates:
        return

    def flag(pool: list[dict], reason, least: bool = False) -> bool:
        if not pool:
            return False
        if least:
            best = min(pool, key=lambda r: (r["score"], -r["_visits"]))
        else:
            best = max(pool, key=lambda r: (r["score"], r["_visits"]))
        best["different"] = True
        best["reason"] = reason(best)
        return True

    def terrain_label(site: SiteData) -> str:
        return TERRAIN_LABELS.get(site.terrain_group, site.terrain_group.title()).lower()

    # How many of their trips' parks each quiz terrain has.
    trips_by_terrain: dict[str, int] = {}
    for visit in history.values():
        if visit.terrain_group is not None:
            terrain = TERRAIN_ALIASES.get(visit.terrain_group, visit.terrain_group)
            trips_by_terrain[terrain] = trips_by_terrain.get(terrain, 0) + 1

    # 1. A terrain that's new to them.
    new_terrain = [
        r
        for r in candidates
        if r["_site"].quiz_terrain not in trips_by_terrain and r["_site"].quiz_terrain not in wanted
    ]
    if flag(new_terrain, lambda r: f"No {terrain_label(r['_site'])} parks in your trips yet"):
        return

    # 2. A region they've never been to.
    been = {region_for_states(v.states) for v in history.values()}
    new_region = [
        r
        for r in candidates
        if (region := region_for_states(r["_site"].states)) is not None and region not in been
    ]
    if flag(
        new_region,
        lambda r: f"You haven't been to {REGION_LABELS[region_for_states(r['_site'].states)]} yet",
    ):
        return

    # 3. Their least-visited terrain, outside their quiz picks.
    others = {t: n for t, n in trips_by_terrain.items() if t not in wanted}
    if others:
        fewest = min(others.values())
        rare = [r for r in candidates if others.get(r["_site"].quiz_terrain) == fewest]

        def rare_reason(r: dict) -> str:
            count = "one" if fewest == 1 else str(fewest)
            parks_word = "park" if fewest == 1 else "parks"
            return f"You've only been to {count} {terrain_label(r['_site'])} {parks_word}"

        if flag(rare, rare_reason):
            return

    # 4. Their least likely park, still suiting their crowd answer.
    suits = [r for r in candidates if (r["signals"]["crowds"] or 0) >= CROWD_FIT]
    if crowds == "either":
        suits = candidates
    flag(
        suits,
        lambda r: (
            "The park you'd least expect, and still quiet"
            if crowds == "quiet"
            else "The park you'd least expect, and still one of the icons"
            if crowds == "icons"
            else "The park you'd least expect"
        ),
        least=True,
    )
