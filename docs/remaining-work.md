# ParkPath: What's Left

Status as of **Sunday, Nov 8, 2026**, checking `main` through PR #53. The demos on Oct 28, Nov 2 and Nov 4 are done.

**Where we stand:** the app is feature-complete for the capstone. Mobile typecheck and lint pass, and all 285 API tests pass. What's left is split into what the project still needs, and what a real release would need on top.

Sizes: **S** = an hour or two · **M** = about a day · **L** = several days

---

## For the capstone

- [x] **Fix the layout on phones with button navigation** (◁ ○ ▢, e.g. Sebastian's Note 20 Ultra): the system buttons covered the tab bar. Done in PR #54.
- [ ] **Weekly NPS sync** with GitHub Actions (PR #55). Left: add the two repository secrets and run it once; see `docs/deploy.md`. **S** *(Dylan)*
- [ ] **Mobile automated tests.** None exist yet; the API has 285 pytest tests. Set up the tooling and a first handful, run in CI. **M** *(Dylan)*
- [ ] **Set `GOOGLE_CLIENT_IDS` on Render.** Without it, Google sign-in returns 503 on the hosted API. *(Sebastian)*
- [ ] **Check the Render database's age.** Free Render Postgres is deleted after 30 days. Upgrade it, or be ready to re-seed it (`docs/deploy.md`, step 5). *(Sebastian)*
- [ ] **Password reset** (decided Oct 26: not cut). Needs an email provider; then turn the app's link back on. **M** *(Sebastian)*
- [ ] **Bug bash** with `docs/test-plan.md` (record results there), including the **install test** of the APK on a phone outside the team. **S–M** *(Dylan leads)*
- [ ] **Backup demo recording.** **S**
- [ ] Ask the team: should the account switcher (tap your name in Settings) be a visible button?

## If the app were released

- [ ] **Quests:** after a trip, a quest to visit 2–4 nearby unvisited sites; a reward seal in Passport. **M–L**
- [ ] **Local data on the phone:** screens open instantly and work without signal; photo caching after. **M**
- [ ] **Badge colours by region.** **S**
- [ ] **Curate the remaining 355 sites.** They return `score: null` today. **M**, mostly manual
- [ ] **SDK 58 upgrade**, on its own branch with an APK test after. **M**
- [ ] **Longer sign-ins** (refresh tokens): sign-in tokens last 24 hours today. **M**
- [ ] **Play Store basics:** privacy policy, store listing, signed release build. **M**
- [ ] **Crash reporting and server rate limits.** **S–M**
- [ ] **Monetisation:** charge for photo and video storage ("ParkPath+"), keep the rest free.
- [ ] *Engine backlog:* per-person signal order, road distance, an accessibility signal (`docs/backlog.md`). **S–L**

---

## Already done

- Auth (email + Google), usernames, profile photos, account deletion, and a hidden account switcher for demos
- Onboarding quiz, saved to the server with "Not for now" snoozes (and a Set aside list to bring parks back)
- Explore map with real NPS data and top-10 picks, each with its match score and reason; a fast map of all 474 sites
- Recommendation engine v2: quiz signals, trip history, star ratings and feedback tags with diminishing returns, a "Something different" pick at #4 and a Friends' pick at #5 (`docs/recommendation-engine.md`)
- Site detail with Google Maps directions, plus official NPS brochure maps
- Trips journal, synced to the server with its photos, videos and passport-stamp photo (S3), with Relive playback ending on a "How it was" page
- Passport stamps, region map, 30 achievements and celebrations
- Friends by username, email or QR code, with a feed, comments, Relive on friends' posts, Activity for comments on your trips, and notifications
- Settings, and in-app arrival reminders
- Dark mode: Light / Dark / Match phone, three dark looks (Night sky, Campfire, Pine) with a faint star field, a trail-map backdrop in light mode, switching instantly
- New app icon and splash (the landscape map pin)
- CI: lint, API tests against Postgres, and an OpenAPI contract check
- Render deploy blueprint; installable APK (`docs/apk.md`); demo seed script (`api/seed_demo.py`)
