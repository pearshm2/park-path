# Recommendation engine

`POST /recommendations` takes someone's quiz answers and returns every NPS
site, best match first. The scoring is a **weighted-sum model** in
`api/app/recommender.py`; the route in `api/app/routers/recommendations.py`
only loads the sites and hands them over.

## How a site is scored

Each of the four quiz signals gets a match score from 0 to 1:

| Signal | Comes from | How it's scored |
| --- | --- | --- |
| **Distance** | Starting zip code (sent as lat/lon) | 1.0 within 100 miles, fading to 0 at 1,500 miles (straight line) |
| **Terrain** | "What do you want under your boots?" | 1.0 if the site's terrain is one they picked, else 0 |
| **Season** | Ranked seasons | Credit for the best-ranked season the site suits: 1st 1.0, 2nd 0.6, 3rd 0.35, 4th 0.15 |
| **Crowds** | "How do you feel about crowds?" | Where the site's visitor count falls among curated sites (0 = quietest, 1 = busiest). "Icons" uses that as-is, "Get me away" flips it |

The total is a weighted average:

```
total = sum(weight × score) / sum(weight)      (over the signals in use)
```

Default weights: distance **36%**, terrain **28%**, season **25%**, crowds
**11%**. They live in `DEFAULT_WEIGHTS` at the top of `recommender.py`, so
retuning them (or a future Settings reorder screen) doesn't touch the logic.

### Signals that aren't in use

A signal is left out, and its weight spread over the rest, when:

- the answer means "no preference": **Any season works for me**, **Fine either way**
- no location is sent
- the site has no data for it

That way missing data never drags a site's score down.

### Sites with no curated data

Terrain, seasons and visitor numbers are hand-curated (`api/data/curated_sites.json`)
for 119 of the 474 sites. The other 355 come back with `score: null` and
`reason: null`, after every scored site. Their `signals` are still filled in
where possible (distance can be computed from coordinates alone).

### Terrain groups the quiz doesn't offer

The data has nine terrain groups; the quiz offers six. Three are folded into
the closest quiz answer, matching that answer's description:
caves → forest ("cave country"), dunes → desert, badlands → canyon ("hoodoos").

### Tie-breaks

Equal scores are ordered by annual visits (better-known site first), then name.

## The "why" text

Each scored site gets up to two short phrases for the signals that helped it
most (weight × score), for signals scoring at least 0.6. For example:
"Canyon terrain, great in spring" or "About 180 miles away, Forest terrain".
With no strong match it says "A partial match on your answers".

## Request and response

```json
// POST /recommendations
{
  "answers": {
    "terrains": ["mountain", "forest"],   // at least one
    "seasons": ["fall", "spring"],        // ranked, favourite first; [] = any season
    "crowds": "quiet"                      // "icons" | "either" | "quiet"
  },
  "location": { "lat": 35.23, "lon": -80.84 }   // from the zip code
}
```

```json
// 200 OK: every site, best first
[
  {
    "park_code": "grsm",
    "score": 0.877,
    "reason": "About 150 miles away, Mountain terrain",
    "signals": { "distance": 0.963, "terrain": 1.0, "season": 1.0, "crowds": 0.008 }
  }
]
```

Every quiz question is required: a missing or empty terrain list, a missing
season list, an unknown answer or a repeated answer returns **422**.
`location` is accepted as optional so the app can integrate before its
zip-code lookup exists; without it, distance isn't scored.

The endpoint is public, like `/sites`: nothing is saved, so no account is needed.

## Not in v1 (planned)

- Thumbs-down / feedback, using the `site_feedback` and `user_tag_weights` tables
- A quieter alternative suggestion per site
- Per-person signal order from a Settings screen (the weights are already one config)
- Accessibility, once there's real per-park data
- Road distance instead of straight-line distance

## Tests

- `api/tests/test_recommender.py`: the scoring logic on its own (no database)
- `api/tests/test_recommendations_api.py`: the endpoint, against Postgres
