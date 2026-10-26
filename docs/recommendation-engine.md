# Recommendation engine (v2)

`POST /recommendations` takes someone's quiz answers and returns every NPS
site, best match first. The scoring is a **weighted-sum model** in
`api/app/recommender.py`; the route in `api/app/routers/recommendations.py`
only loads the sites and hands them over.

## How a site is scored

Each of the four quiz signals gets a match score from 0 to 1:

| Signal | Comes from | How it's scored |
| --- | --- | --- |
| **Distance** | Starting zip code (sent as lat/lon) | 1.0 within 100 miles, fading to 0 at 2,500 miles (straight line) |
| **Terrain** | "What do you want under your boots?" | 1.0 if the site's terrain is one they picked, else 0 |
| **Season** | Ranked seasons | Credit for the best-ranked season the site suits: 1st 1.0, 2nd 0.6, 3rd 0.35, 4th 0.15. Ranking all four counts as no preference |
| **Crowds** | "How do you feel about crowds?" | Where the site's visitor count falls among curated sites (0 = quietest, 1 = busiest). "Icons" uses that as-is, "Get me away" flips it |

The score is built in three steps:

1. **Weighted average** of the signals in use:

   ```
   base = sum(weight × score) / sum(weight)      (over the signals in use)
   ```

   Default weights: terrain **36%**, distance **28%**, season **25%**, crowds
   **11%**. They live in `DEFAULT_WEIGHTS` at the top of `recommender.py`, so
   retuning them (or a future Settings reorder screen) doesn't touch the logic.

2. **Terrain gate:** a site whose terrain isn't one the person picked has its
   score multiplied by `TERRAIN_MISS_FACTOR` (0.5). In v1, a nearby park with
   the wrong scenery could outrank real matches just by being close; the
   gate stops that.

3. **Trip history** (signed-in users only): parks they've logged a trip to
   are multiplied by `VISITED_FACTOR` (0.6), since the question is "where to
   next?". Unvisited parks sharing a terrain with a trip they rated 4–5 stars
   get `+0.05`, and their reason says so ("Like Zion, which you loved").

4. **Something different** (signed-in users with at least one trip): one
   national park is flagged `"different": true`, always from **outside their
   top 10 parks** and never one they've visited, by the first of these rules
   that finds one (best score wins within it):
   1. a terrain they've never visited and didn't pick in the quiz ("No
      desert parks in your trips yet");
   2. a map region they've never been to ("You haven't been to Great Lakes
      & Midwest yet");
   3. their least-visited terrain outside their quiz picks ("You've only
      been to one coastal park");
   4. their least likely park (the lowest score) that still suits their
      crowd answer ("The park you'd least expect, and still quiet").

   Its score isn't changed; its reason says why it's different. The app
   moves it to #4 of the top 10 and labels it "Something different".

### Signals that aren't in use

A signal is left out, and its weight spread over the rest, when:

- the answer means "no preference": **Any season works for me** (or all four
  seasons ranked), **Fine either way**
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
    "score": 0.885,
    "reason": "Mountain terrain, about 150 miles away",
    "signals": { "distance": 0.978, "terrain": 1.0, "season": 1.0, "crowds": 0.008 },
    "visited": false,
    "different": false
  }
]
```

Every quiz question is required: a missing or empty terrain list, a missing
season list, an unknown answer or a repeated answer returns **422**.
`location` is accepted as optional so the app can integrate before its
zip-code lookup exists; without it, distance isn't scored.

The endpoint works without an account, like `/sites`. Send the usual
`Authorization: Bearer <token>` header and it also uses that person's trips
(see step 3 above); `visited` is then true for parks they've logged. A missing,
bad or expired token just gives the anonymous results, never an error.

## Not yet (planned)

- Star ratings and tags on trips nudging the signals (designed; after the demo)
- A quieter alternative suggestion per site
- Per-person signal order from a Settings screen (the weights are already one config)
- Accessibility, once there's real per-park data
- Road distance instead of straight-line distance

## Tests

- `api/tests/test_recommender.py`: the scoring logic on its own (no database)
- `api/tests/test_recommendations_api.py`: the endpoint, against Postgres
