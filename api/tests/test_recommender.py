"""
Tests for the scoring logic in app/recommender.py. Plain Python, no
database: each test builds a few made-up sites and checks the scores.
"""

import pytest

from app.recommender import (
    DEFAULT_WEIGHTS,
    SiteData,
    combine,
    crowds_score,
    distance_score,
    miles_between,
    rank,
    season_score,
    terrain_score,
    visits_percentile,
)
from app.schemas import Location, QuizAnswers


def make_site(code="test", **overrides) -> SiteData:
    """A curated canyon park, good in spring and fall, unless overridden."""
    fields = dict(
        park_code=code,
        name=f"Park {code}",
        latitude=37.3,
        longitude=-113.0,
        terrain_group="canyon",
        seasons=["spring", "fall"],
        annual_visits_millions=1.0,
    )
    fields.update(overrides)
    return SiteData(**fields)


def answers(terrains=("canyon",), seasons=("spring",), crowds="either") -> QuizAnswers:
    return QuizAnswers(terrains=list(terrains), seasons=list(seasons), crowds=crowds)


# --- terrain ----------------------------------------------------------------


def test_terrain_match_and_miss():
    assert terrain_score(make_site(), ["canyon", "coast"]) == 1.0
    assert terrain_score(make_site(), ["coast"]) == 0.0


def test_terrain_aliases_fold_into_quiz_answers():
    assert terrain_score(make_site(terrain_group="caves"), ["forest"]) == 1.0
    assert terrain_score(make_site(terrain_group="dunes"), ["desert"]) == 1.0
    assert terrain_score(make_site(terrain_group="badlands"), ["canyon"]) == 1.0


def test_terrain_unknown_without_data():
    assert terrain_score(make_site(terrain_group=None), ["canyon"]) is None


# --- season -----------------------------------------------------------------


def test_season_credit_follows_rank():
    site = make_site(seasons=["fall"])
    assert season_score(site, ["fall", "spring"]) == 1.0
    assert season_score(site, ["spring", "fall"]) == 0.6
    assert season_score(site, ["spring", "summer", "fall"]) == 0.35
    assert season_score(site, ["winter"]) == 0.0


def test_season_uses_best_ranked_match():
    # Good in spring (ranked 2nd) and fall (ranked 3rd): spring wins.
    assert season_score(make_site(), ["winter", "spring", "fall"]) == 0.6


def test_any_season_drops_the_signal():
    assert season_score(make_site(), []) is None


# --- crowds -----------------------------------------------------------------


def test_visits_percentile_runs_quiet_to_busy():
    visits = [0.1, 1.0, 5.0]
    assert visits_percentile(0.1, visits) == 0.0
    assert visits_percentile(1.0, visits) == 0.5
    assert visits_percentile(5.0, visits) == 1.0


def test_crowds_icons_vs_quiet():
    visits = [0.1, 1.0, 5.0]
    busy = make_site(annual_visits_millions=5.0)
    assert crowds_score(busy, "icons", visits) == 1.0
    assert crowds_score(busy, "quiet", visits) == 0.0
    assert crowds_score(busy, "either", visits) is None


# --- distance ---------------------------------------------------------------


def test_miles_between_known_cities():
    # Charlotte, NC to Atlanta, GA is about 226 miles in a straight line.
    assert miles_between(35.23, -80.84, 33.75, -84.39) == pytest.approx(226, abs=5)


def test_distance_score_fades_with_miles():
    assert distance_score(50) == 1.0
    assert distance_score(800) == pytest.approx(0.5)
    assert distance_score(3000) == 0.0
    assert distance_score(None) is None


# --- combining --------------------------------------------------------------


def test_combine_is_a_weighted_average():
    signals = {"distance": 1.0, "terrain": 0.0, "season": None, "crowds": None}
    # Only distance (0.36) and terrain (0.28) are in use.
    assert combine(signals, DEFAULT_WEIGHTS) == pytest.approx(0.36 / 0.64)


def test_combine_with_nothing_in_use():
    signals = dict.fromkeys(DEFAULT_WEIGHTS)
    assert combine(signals, DEFAULT_WEIGHTS) is None


# --- ranking ----------------------------------------------------------------


def test_rank_puts_better_matches_first():
    sites = [
        make_site("miss", terrain_group="coast", seasons=["summer"]),
        make_site("match"),
    ]
    results = rank(sites, answers())
    assert [r["park_code"] for r in results] == ["match", "miss"]
    assert results[0]["score"] == 1.0
    assert results[1]["score"] == 0.0


def test_uncurated_sites_are_unscored_and_last():
    sites = [
        make_site("bare", terrain_group=None, seasons=None, annual_visits_millions=None),
        make_site("curated"),
    ]
    results = rank(sites, answers(), Location(lat=37.3, lon=-113.0))
    assert [r["park_code"] for r in results] == ["curated", "bare"]
    bare = results[1]
    assert bare["score"] is None and bare["reason"] is None
    # Its signals are still reported: distance can be computed without curation.
    assert bare["signals"]["distance"] == 1.0
    assert bare["signals"]["terrain"] is None


def test_distance_only_counts_when_a_location_is_sent():
    near = make_site("near", latitude=35.6, longitude=-83.5)  # Smokies
    far = make_site("far", latitude=37.3, longitude=-113.0)  # Zion
    charlotte = Location(lat=35.23, lon=-80.84)

    with_location = rank([far, near], answers(), charlotte)
    assert [r["park_code"] for r in with_location] == ["near", "far"]

    without = rank([far, near], answers())
    assert all(r["signals"]["distance"] is None for r in without)
    assert without[0]["score"] == without[1]["score"]


def test_ties_go_to_the_better_known_site():
    sites = [
        make_site("small", annual_visits_millions=0.2),
        make_site("famous", annual_visits_millions=4.0),
    ]
    results = rank(sites, answers())
    assert [r["park_code"] for r in results] == ["famous", "small"]


def test_reason_names_the_strongest_matches():
    sites = [make_site(), make_site("other", annual_visits_millions=9.0)]
    results = rank(sites, answers(seasons=("spring",), crowds="quiet"))
    quiet = next(r for r in results if r["park_code"] == "test")
    assert quiet["reason"] == "Canyon terrain, great in spring"


def test_reason_falls_back_when_nothing_matches():
    results = rank([make_site(terrain_group="coast", seasons=["summer"])], answers())
    assert results[0]["reason"] == "A partial match on your answers"


def test_custom_weights_change_the_order():
    terrain_fit = make_site("terrain_fit", seasons=["winter"])
    season_fit = make_site("season_fit", terrain_group="coast")
    a = answers(terrains=("canyon",), seasons=("spring",))

    default = rank([season_fit, terrain_fit], a)
    assert default[0]["park_code"] == "terrain_fit"  # terrain outweighs season

    season_first = {**DEFAULT_WEIGHTS, "season": 0.5}
    custom = rank([season_fit, terrain_fit], a, weights=season_first)
    assert custom[0]["park_code"] == "season_fit"
