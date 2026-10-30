"""
Tests for the scoring logic in app/recommender.py. Plain Python, no
database: each test builds a few made-up sites and checks the scores.
"""

import math

import pytest

from app.recommender import (
    DEFAULT_WEIGHTS,
    TERRAIN_MISS_FACTOR,
    TERRAIN_TASTE,
    VISITED_FACTOR,
    Review,
    SiteData,
    Taste,
    Visit,
    combine,
    crowds_score,
    distance_score,
    miles_between,
    rank,
    season_of,
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
    assert distance_score(1300) == pytest.approx(0.5)  # halfway from 100 to 2500 miles
    assert distance_score(3000) == 0.0
    assert distance_score(None) is None


# --- combining --------------------------------------------------------------


def test_combine_is_a_weighted_average():
    signals = {"distance": 1.0, "terrain": 0.0, "season": None, "crowds": None}
    # Only distance and terrain are in use, so their weights are rescaled.
    w = DEFAULT_WEIGHTS
    assert combine(signals, w) == pytest.approx(w["distance"] / (w["distance"] + w["terrain"]))


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
    # Both match on terrain; one is in season, the other is busier.
    in_season = make_site("in_season", seasons=["spring"], annual_visits_millions=0.5)
    busy = make_site("busy", seasons=["winter"], annual_visits_millions=5.0)
    a = answers(seasons=("spring",), crowds="icons")

    default = rank([busy, in_season], a)
    assert default[0]["park_code"] == "in_season"  # season outweighs crowds

    crowds_first = {**DEFAULT_WEIGHTS, "crowds": 1.0}
    custom = rank([busy, in_season], a, weights=crowds_first)
    assert custom[0]["park_code"] == "busy"


# --- v2: terrain gate, "every season", trip history -------------------------


def test_terrain_miss_cuts_the_score():
    match = make_site("match")
    miss = make_site("miss", terrain_group="coast")
    results = {r["park_code"]: r for r in rank([match, miss], answers())}
    assert results["match"]["score"] == 1.0
    # Same season fit, but the wrong terrain: its score is cut by the gate.
    assert results["miss"]["score"] == pytest.approx(
        round(
            (DEFAULT_WEIGHTS["season"] / (DEFAULT_WEIGHTS["season"] + DEFAULT_WEIGHTS["terrain"]))
            * TERRAIN_MISS_FACTOR,
            3,
        )
    )


def test_nearby_wrong_terrain_loses_to_distant_match():
    # v1's bug: a close forest park beat far canyon parks for a canyon fan.
    near_forest = make_site("near", terrain_group="forest", latitude=35.6, longitude=-83.5)
    far_canyon = make_site("far", latitude=37.3, longitude=-113.0)
    charlotte = Location(lat=35.23, lon=-80.84)
    results = rank([near_forest, far_canyon], answers(), charlotte)
    assert [r["park_code"] for r in results] == ["far", "near"]


def test_all_four_seasons_means_any_season():
    site = make_site(seasons=["fall"])
    assert season_score(site, ["winter", "spring", "summer", "fall"]) is None
    assert season_score(site, ["winter", "spring", "summer"]) == 0.0


def test_no_history_means_nothing_visited():
    results = rank([make_site()], answers())
    assert results[0]["visited"] is False


def test_visited_parks_move_down():
    visited = make_site("been", annual_visits_millions=4.0)
    fresh = make_site("new", annual_visits_millions=0.2)
    history = {"been": Visit(park_code="been", name="Park been", terrain_group="canyon", rating=3)}
    results = rank([visited, fresh], answers(), history=history)
    assert [r["park_code"] for r in results] == ["new", "been"]
    been = results[1]
    assert been["visited"] is True
    assert been["score"] == pytest.approx(VISITED_FACTOR)


def test_loved_terrain_gives_a_boost_and_a_reason():
    zion = Visit(park_code="zion", name="Zion", terrain_group="canyon", rating=5)
    similar = make_site("similar", seasons=["summer"])  # canyon, out of season
    other = make_site("other", seasons=["summer"])
    loved = rank([similar], answers(), history={"zion": zion})[0]
    plain = rank([other], answers())[0]
    assert loved["score"] > plain["score"]
    assert loved["reason"].startswith("Like Zion, which you loved")


def test_low_rated_trips_push_the_terrain_down():
    meh = Visit(park_code="zion", name="Zion", terrain_group="canyon", rating=2)
    with_history = rank([make_site()], answers(seasons=("summer",)), history={"zion": meh})[0]
    without = rank([make_site()], answers(seasons=("summer",)))[0]
    assert with_history["score"] < without["score"]
    assert "loved" not in with_history["reason"]


def test_three_stars_change_nothing():
    okay = Visit(park_code="zion", name="Zion", terrain_group="canyon", rating=3)
    with_history = rank([make_site()], answers(seasons=("summer",)), history={"zion": okay})[0]
    without = rank([make_site()], answers(seasons=("summer",)))[0]
    assert with_history["score"] == without["score"]


# --- reviews: stars and feedback tags ------------------------------------------


def review(feedback=(), rating=None, terrain="canyon", month=6, code="trip") -> Review:
    return Review(code, code.title(), terrain, rating, list(feedback), month)


def score_of(sites, reviews, quiz=None, code=None, location=None) -> float:
    results = rank(sites, quiz or answers(), location, reviews=reviews)
    return next(r["score"] for r in results if r["park_code"] == (code or sites[0].park_code))


def test_more_trips_count_for_less_each():
    site = [make_site(seasons=["summer"])]
    plain = score_of(site, [])
    gains = [score_of(site, [review(rating=5, code=f"t{i}") for i in range(n)]) - plain
             for n in (1, 2, 3, 4)]  # fmt: skip
    steps = [gains[0]] + [b - a for a, b in zip(gains, gains[1:], strict=False)]
    assert all(step > 0 for step in steps)
    assert steps == sorted(steps, reverse=True)
    # However many, never more than the cap.
    many = score_of(site, [review(rating=5, code=f"t{i}") for i in range(30)])
    assert many - plain <= TERRAIN_TASTE + 1e-9


def test_scenery_tags_move_that_terrain():
    canyon = make_site("canyon", seasons=["summer"])
    plain = score_of([canyon], [])
    assert score_of([canyon], [review(["loved_scenery"])]) > plain
    assert score_of([canyon], [review(["not_my_scenery"])]) < plain
    # A 5-star trip whose scenery wasn't for them cancels out.
    assert score_of([canyon], [review(["not_my_scenery"], rating=5)]) == plain
    # Only that terrain.
    coast = make_site("coast", terrain_group="coast", seasons=["summer"])
    assert score_of([coast], [review(["not_my_scenery"])]) == score_of([coast], [])


def test_loved_scenery_gives_the_loved_reason():
    results = rank([make_site("next")], answers(), reviews=[review(["loved_scenery"], code="zion")])
    assert results[0]["reason"].startswith("Like Zion, which you loved")


def test_too_crowded_favours_quiet_parks_even_when_fine_either_way():
    busy = make_site("busy", annual_visits_millions=10.0)
    quiet = make_site("quiet", annual_visits_millions=0.1)
    sites = [busy, quiet]
    assert score_of(sites, [], code="busy") == score_of(sites, [], code="quiet")
    crowded = [review(["too_crowded"])]
    assert score_of(sites, crowded, code="quiet") > score_of(sites, crowded, code="busy")


def test_too_crowded_makes_quiet_count_for_more():
    busy = make_site("busy", annual_visits_millions=10.0)
    quiet = make_site("quiet", annual_visits_millions=0.1)
    sites = [busy, quiet]
    quiz = answers(crowds="quiet")
    gap_before = score_of(sites, [], quiz, "quiet") - score_of(sites, [], quiz, "busy")
    crowded = [review(["too_crowded"])]
    gap_after = score_of(sites, crowded, quiz, "quiet") - score_of(sites, crowded, quiz, "busy")
    assert gap_after > gap_before


def test_distance_tags_change_how_much_distance_counts():
    home = Location(lat=37.3, lon=-113.0)
    near = make_site("near")
    far = make_site("far", latitude=44.0, longitude=-73.0)
    sites = [near, far]

    def gap(reviews):
        return score_of(sites, reviews, code="near", location=home) - score_of(
            sites, reviews, code="far", location=home
        )

    assert gap([review(["too_far"])]) > gap([]) > gap([review(["worth_the_drive"])])


def test_perfect_timing_favours_parks_good_in_that_season():
    summer = make_site("summer", seasons=["summer"])
    winter = make_site("winter", seasons=["winter"])
    sites = [summer, winter]
    july = [review(["perfect_timing"], month=7)]
    assert score_of(sites, [], code="summer") == score_of(sites, [], code="winter")
    assert score_of(sites, july, code="summer") > score_of(sites, july, code="winter")


def test_wrong_time_of_year_makes_seasons_count_for_more():
    good = make_site("good", seasons=["spring"])
    off = make_site("off", seasons=["winter"])
    sites = [good, off]
    wrong = [review(["wrong_season"])]
    before = score_of(sites, [], code="good") - score_of(sites, [], code="off")
    after = score_of(sites, wrong, code="good") - score_of(sites, wrong, code="off")
    assert after > before


def test_taste_reads_every_part():
    taste = Taste.from_reviews(
        [
            review(["loved_scenery", "too_crowded", "too_far", "perfect_timing"], 5, month=10),
            review(["not_my_scenery", "wrong_season"], 2, terrain="coast"),
        ]
    )
    assert taste.terrain["canyon"] > 0 > taste.terrain["coast"]
    assert set(taste.loved) == {"canyon"}
    assert taste.quiet > 0 and taste.distance > 0 and taste.timing > 0
    assert taste.seasons == {"fall": pytest.approx(math.tanh(0.5))}


def test_season_of():
    assert [season_of(m) for m in (1, 4, 7, 10, 12)] == [
        "winter",
        "spring",
        "summer",
        "fall",
        "winter",
    ]


# --- something different ----------------------------------------------------


def top_ten(code="top", **overrides) -> list[SiteData]:
    """Ten strong canyon parks (the quiz's answer) that fill the usual top 10."""
    fields = dict(is_named_park=True, states="UT", annual_visits_millions=5.0)
    fields.update(overrides)
    return [make_site(f"{code}{i}", **fields) for i in range(10)]


def visit(code, terrain, states="UT", rating=4) -> Visit:
    return Visit(
        park_code=code, name=code.title(), terrain_group=terrain, rating=rating, states=states
    )


def flagged(results) -> list[dict]:
    return [r for r in results if r["different"]]


def test_something_different_needs_trips():
    sites = top_ten() + [make_site("desert", terrain_group="desert", is_named_park=True)]
    assert flagged(rank(sites, answers())) == []


def test_something_different_comes_from_outside_the_top_ten():
    # A new terrain, but scoring into the top 10 itself: nothing to add.
    sites = [make_site("desert", terrain_group="desert", is_named_park=True)]
    history = {"zion": visit("zion", "canyon")}
    assert flagged(rank(sites, answers(), history=history)) == []


def test_rung_one_a_terrain_new_to_them():
    history = {"zion": visit("zion", "canyon"), "oak": visit("oak", "forest")}
    sites = top_ten() + [
        make_site("forest", terrain_group="forest", is_named_park=True),  # tried
        make_site("dunes", terrain_group="dunes", is_named_park=True, annual_visits_millions=0.5),
        make_site("desert", terrain_group="desert", is_named_park=True, annual_visits_millions=2.0),
        make_site("monument", terrain_group="coast", is_named_park=False),  # not a park
    ]
    [pick] = flagged(rank(sites, answers(), history=history))
    # Dunes count as desert, so the two desert parks tie; the busier one wins.
    assert pick["park_code"] == "desert"
    assert pick["reason"] == "No desert parks in your trips yet"


ALL_TERRAINS = ["mountain", "canyon", "desert", "forest", "coast", "water"]


def everywhere(states="UT") -> dict[str, Visit]:
    """A trip to a park of every terrain, all in one state."""
    return {f"t{i}": visit(f"t{i}", terrain, states) for i, terrain in enumerate(ALL_TERRAINS)}


def test_rung_two_a_region_never_visited():
    sites = top_ten() + [
        make_site("near", terrain_group="forest", is_named_park=True, states="AZ"),
        make_site("far", terrain_group="forest", is_named_park=True, states="MI"),
    ]
    [pick] = flagged(rank(sites, answers(), history=everywhere(states="AZ")))
    assert pick["park_code"] == "far"
    assert pick["reason"] == "You haven't been to Great Lakes & Midwest yet"


def test_rung_three_the_least_visited_terrain():
    history = everywhere(states="UT")
    history["t9"] = visit("t9", "forest", states="UT")  # forest twice
    sites = top_ten() + [
        make_site("forest", terrain_group="forest", is_named_park=True, states="UT"),
        make_site("coast", terrain_group="coast", is_named_park=True, states="UT"),
    ]
    [pick] = flagged(rank(sites, answers(), history=history))
    assert pick["park_code"] == "coast"
    assert pick["reason"] == "You've only been to one coastal park"


def test_rung_four_the_least_likely_park_that_keeps_their_crowd_answer():
    # Every terrain tried, every region visited, and only canyon parks left.
    # The three left are out of season, so they rank below the top 10.
    sites = top_ten(annual_visits_millions=1.0) + [
        make_site(
            "busy", is_named_park=True, states="UT", seasons=["summer"], annual_visits_millions=9.0
        ),
        make_site(
            "quiet", is_named_park=True, states="UT", seasons=["summer"], annual_visits_millions=0.1
        ),
        # Quiet too, though a little busier, so a slightly worse match.
        make_site(
            "unlikely",
            is_named_park=True,
            states="UT",
            seasons=["summer"],
            annual_visits_millions=0.3,
        ),
    ]
    results = rank(sites, answers(crowds="quiet"), history=everywhere(states="UT"))
    [pick] = flagged(results)
    assert pick["park_code"] == "unlikely"
    assert pick["reason"] == "The park you'd least expect, and still quiet"


def test_a_snoozed_wildcard_is_replaced_by_the_next_one():
    history = {"zion": visit("zion", "canyon")}
    sites = top_ten() + [
        make_site("desert", terrain_group="desert", is_named_park=True, annual_visits_millions=2.0),
        make_site("forest", terrain_group="forest", is_named_park=True, annual_visits_millions=0.5),
    ]
    [first] = flagged(rank(sites, answers(), history=history))
    [second] = flagged(rank(sites, answers(), history=history, snoozed={first["park_code"]}))
    assert first["park_code"] != second["park_code"]
    assert second["reason"].startswith("No ")


def test_a_snoozed_park_frees_its_top_ten_place():
    # With one of the top ten set aside, the best desert park moves up into
    # the usual picks, so the wildcard is the next desert park.
    history = {"zion": visit("zion", "canyon")}
    sites = top_ten() + [
        make_site(
            "desert1", terrain_group="desert", is_named_park=True, annual_visits_millions=3.0
        ),
        make_site(
            "desert2", terrain_group="desert", is_named_park=True, annual_visits_millions=0.5
        ),
    ]
    [before] = flagged(rank(sites, answers(), history=history))
    [after] = flagged(rank(sites, answers(), history=history, snoozed={"top0"}))
    assert (before["park_code"], after["park_code"]) == ("desert1", "desert2")
