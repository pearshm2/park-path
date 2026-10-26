# Backlog

Work that's been deliberately deferred or cut, so it isn't forgotten. Move an
item back into the active list when the team agrees to pick it up.

Last updated: Oct 24.

## Deferred: recommendation engine

- **Friends' picks signal.** "Your friends liked or visited this park,"
  from friends' wishlists and, later, trips, respecting `visibility.py`.
  Built as a fifth signal that returns "no data" until switched on, so it
  has no effect on scores until then. Replaces the pitch's "collaborative
  filtering" (similar strangers), which needs far more users than we have.
- **Trips feeding recommendations** (E2). Needs the trips backend.
- **Accessibility as a signal.** Needs real per-park accessibility data.
- **Per-person signal order** ("What matters most" in Settings). The engine
  already reads its weights from one config (`DEFAULT_WEIGHTS`).
- **Road distance** instead of straight-line distance.

## Deferred: park data

From the Oct 8 data-sourcing plan. These help plan a *trip* to a park more
than they help *choose* one, so they wait until the core is done.

- **Manual research** of curated fields for more parks (each person's ~20
  parks: accessibility, condition chip, getting in, lodging, timed entry,
  permit detail, dark sky).
- **More NPS fields in the sync:** directions, weather, entrance fees,
  operating hours, activities. Small change to `api/app/nps_sync.py`; only
  worth doing once the park page has a place to show them.
- **Campgrounds and visitor centers** from the NPS API.

## Cut (agreed by the team)

- **Feedback (thumbs up/down with reasons).** Cut Oct 24. "Not for now"
  (snooze a park for 30 days) is the only way to pass on a park, so the
  engine never learns "I don't like this park at all" from one tap. The
  `site_feedback` and `user_tag_weights` tables (migration 0006) stay
  unused.

## After the demo (agreed, not cut)

- **Password reset.** Decided Oct 26: built after the Oct 28 demo, not cut.
  Needs an email provider and `POST /auth/password-reset`; the app's screen
  is ready, and its link comes back by setting `PASSWORD_RESET_ENABLED` in
  `mobile/src/auth/AuthForm.tsx`.
