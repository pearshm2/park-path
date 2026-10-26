# ParkPath: What's Left

Status as of **Monday, Oct 26, 2026**. This checks `main` (with main through PR #38) against our 8-week plan. Demo day is **Wednesday, Oct 28**.

**Decided Oct 24:** no thumbs up/down. To pass on a park, you snooze it with "Not for now", so the engine doesn't get "I don't like this park at all" feedback. (See `docs/backlog.md` → Cut.)

**Where we stand:** weeks 1–6 are essentially done. Mobile typecheck and lint pass, and all 251 API tests pass. Trip photos and videos now upload to S3 (PR #35); only the passport-stamp photo stays on the phone.

Sizes: **S** = an hour or two · **M** = about a day · **L** = several days

---

## Before Wednesday's demo

- [x] ~~**Decide how to demo around photo sync.**~~ Uploads landed in PR #35. Friends see a trip without its photos. Either demo on one phone, or skip showing a friend's media.
- [ ] **Set `GOOGLE_CLIENT_IDS` on Render.** Without it, Google sign-in returns 503 on the hosted API. Otherwise demo with email login. *(Sebastian)*
- [ ] **Check the Render database's age.** Free Render Postgres is deleted after 30 days. Upgrade it, or be ready to re-seed it. *(Sebastian)*
- [x] **Set up demo accounts:** Halie plus three friends, with trips and comments. See `docs/demo-accounts.md`.
- [ ] **Pick quiz answers that land on a curated park.** Only 119 of 474 sites have match scores. *(Dylan)*
- [x] **Replace the default app icon and splash screen** with the ParkPath logo. *(Halie)*
- [ ] **Don't claim "collaborative filtering" in the talk.** The README pitches it, but it isn't built.

---

## Frontend (Halie)

- [x] **Upload trip photos and videos to S3.** Done in PR #35, except the passport-stamp photo (needs somewhere on the server to keep it). Call `POST /trips/photos/upload-url`, upload, then send `photo_keys`. Do the passport-stamp photo too. **M–L**
  `mobile/src/api/trips.ts`, `mobile/src/trips/TripsContext.tsx`
- [x] **Forgot password:** link hidden (`PASSWORD_RESET_ENABLED` in `AuthForm.tsx`). Was: hide the link (**S**), or build it with the backend (**M**). The screen calls `/auth/password-reset`, which doesn't exist.
  `(auth)/forgot-password.tsx`
- [x] **Error and retry states** on Explore (a "Try again" bar) and site detail. Trips still works offline from the phone's journal. Was: If the API is unreachable, Explore shows an empty map. Trips and site detail have the same gap. **S–M**
  `(tabs)/explore.tsx` lines 244–260, `(tabs)/trips.tsx` line 100, `site/[id].tsx` line 34
- [x] **Replace the "Coming next" card on the site page** (match scores, PR #33), for example with the four match scores `/recommendations` already returns. **S–M**
  `site/[id].tsx` around lines 130–137
- [x] **Save quiz answers and snoozes to the server** so they survive a new phone (`QuizContext.tsx`, `useSnoozed.ts`).
  `quiz.tsx`, `QuizContext.tsx`, `useSnoozed.ts`
- [x] **Clean-ups.** Fix stale "device-only" comments in `(tabs)/trips.tsx` (lines 14–15) and `api/trips.ts` (lines 6–9). Replace the create-expo-app boilerplate in `mobile/README.md`. **S**

## Backend (Sebastian)

- [ ] **Password reset**, after the demo (decided Oct 26: not cut). Needs an email provider; then turn the app's link back on. **M**
- [x] **Store quiz answers and snoozes on the server:** `/quiz` and `/snoozes`, migration 0017.
- [x] **Add the S3 and Google env vars to `render.yaml`** with `sync: false` (`S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `GOOGLE_CLIENT_IDS`). Create the bucket and IAM user, then update `docs/deploy.md`. **S**
- [ ] *Optional:* run the NPS sync on a Render cron schedule. Today it's a manual command. **S–M**

## Recommendation engine (Dylan)

Engine code: `api/app/recommender.py`. (`parkpath-recommendation-engine/` is the design prototype, not the engine.)

- [ ] **Add a "Friends' picks" signal.** It stands in for the collaborative filtering in our pitch. **M**
- [x] **Let past trips shape future recommendations** (backlog E2, engine v2). **M**
- [ ] **Curate the remaining 355 sites.** They return `score: null` today. **M**, mostly manual
- [ ] *Smaller backlog items:* per-person signal order, road distance, an accessibility signal. **S–L**

## Release and infra

- [x] **Document the APK build:** `docs/apk.md` (PR #36).
- [ ] **Build the release-candidate APK** from main (it needs PR #37 and #38's photo upload fix), following `docs/apk.md`. **S** *(Halie / Dylan)*
- [x] **Write a demo seed script** for users, friendships, trips and comments: `api/seed_demo.py`.
- [ ] *Optional:* add an EAS build or a mobile test job to CI. **M** *(Dylan)*

## QA (Dylan leads)

- [ ] **Bug bash**, with findings written down in `docs/`. **M**
- [ ] **Install test** of the APK on a phone outside the team. **S**
- [ ] **Backup demo recording.** **S**
- [ ] **Mobile automated tests.** None exist; the API has 251 pytest tests. **M–L**

---

## Already done

- Auth (email + Google), usernames, profile photos, account deletion
- Onboarding quiz
- Explore map with real NPS data and top-10 picks, each with a reason
- Site detail with Google Maps directions, plus official NPS brochure maps
- Trips journal, synced to the server (except media), with "Relive" playback
- Passport stamps, region map, 30 achievements and celebrations
- Friends by username, email or QR code, with a feed, comments and notifications
- Settings, and in-app arrival reminders
- CI: lint, API tests against Postgres, and an OpenAPI contract check
- Render deploy blueprint
