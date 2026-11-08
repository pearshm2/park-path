# park-path

[Team Notes](https://github.com/pearshm2/park-path/wiki/ParkPath-Team-Reflective-Notes)

ParkPath suggests your next national park from a short quiz: the scenery you like, when you travel, how busy you like it, and how far it is from you. It learns from your trip journal: parks you've visited move down, your star ratings and feedback tags ("Too crowded", "Worth the drive", ...) tune what it suggests, one pick is "something different" to try, and another is a park a friend loved. Paired with a trip journal (photos, videos and notes, shared with friends), a passport of the parks you've been to, and a friends feed.

## What's in the app

- **Explore:** a map of the 62 national parks (or all 474 NPS sites) with your top 10 picks, each with its match score and why. Filters, search, and "Not for now" to set a park aside for 30 days.
- **Trips:** a journal of your visits (stars, feedback tags, trails, who you went with, photos, videos, a passport-stamp photo), synced to the server, with Relive to play a trip back as a reel.
- **Passport:** stamps, a region map, achievements and celebrations.
- **Friends:** add by username, email or QR code; a feed of friends' trips with comments and Relive; Activity for comments on your trips, with notifications.
- **Settings:** profile and photo, quiz answers, text size, arrival reminders, set-aside parks, account deletion.

## Structure
- `mobile/` – React Native + Expo app (TypeScript); see `mobile/README.md`
- `api/` – FastAPI + PostgreSQL backend, hosted on Render
- `.github/workflows/` – CI (lint, API tests, API contract check) and the weekly NPS sync
- `docs/` – project docs (below)

## Team
- Halie – Frontend/UI, team lead
- Sebastian – Backend/Data
- Dylan – Recommendation engine, NPS sync, CI, QA

## Run the mobile app
```bash
cd mobile
npm install
npx expo start
```
Scan the QR code with Expo Go on Android. To install the app itself, see `docs/apk.md`.

## Run the API locally
```bash
cd api
docker compose up -d
docker compose exec api python -m app.nps_sync --from-snapshot
docker compose exec api python -m app.curate_sites
```
The API docs are then at http://localhost:8000/docs. Tests: `pytest` from `api/` (needs the database running).

## Docs
- `docs/recommendation-engine.md` – how picks are scored, and why
- `docs/api-contract.md` – how the app and API stay in step
- `docs/deploy.md` – hosting on Render, photo storage (S3), the weekly NPS sync
- `docs/apk.md` – building the installable Android app
- `docs/expo-go-phone-login.md` – running against a local API from a phone
- `docs/demo-accounts.md`, `docs/demo.md` – demo accounts and the demo script
- `docs/test-plan.md` – the manual test plan (bug bash), with space for results
- `docs/remaining-work.md`, `docs/backlog.md` – what's left, deferred or cut
