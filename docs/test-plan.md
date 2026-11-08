# ParkPath: Manual Test Plan

A bug bash for the whole app, run on the **APK** (not Expo Go, which is slower
and behaves differently). Write the result in the last column: **Pass**,
**Fail** (with a short note of what happened), or **Skip**. Put the date, the
APK build and the phone at the top of each run.

Two accounts are needed for the Friends tests: **A** (yours) and **B** (a
second account that's friends with A). Switch between them with the account
switcher (Settings → tap your name).

**Run:** date ______ · APK build ______ · phone and Android version ______ ·
navigation: gestures / buttons

---

## 1. Install and first launch

| # | Do this | Expect | Result |
|---|---|---|---|
| 1.1 | Install the APK from the EAS link | Installs; the icon is the landscape pin | |
| 1.2 | Open it | Orange splash with the pin alone (nothing cut off), then sign-in | |
| 1.3 | Sign up with a new email | Username prompt, then the quiz | |
| 1.4 | Answer the quiz (with a zip code) | Lands on Explore with picks | |
| 1.5 | Close the app fully and reopen it | Still signed in, straight to Explore | |
| 1.6 | **Install test:** someone outside the team installs and signs up alone, from the link | They get to Explore without help | |

## 2. Explore

| # | Do this | Expect | Result |
|---|---|---|---|
| 2.1 | Look at the top 10 | Each card has a % match and a reason | |
| 2.2 | With trips logged, find #4 | "Something different" label | |
| 2.3 | With a friend's 4–5★ trip to a park you haven't visited, find #5 | "Friends' pick" label, "Name loved this (5★)" | |
| 2.4 | Tap a card, then tap it again | Zooms onto its region, then back to the whole map | |
| 2.5 | Tap pins in the same region | The deck flips to that park's card (no empty card) | |
| 2.6 | Switch to "All sites" and pan and pinch hard | Smooth; dots stay on the land | |
| 2.7 | Pinch, then lift both fingers | The map stays exactly where it was left | |
| 2.8 | Drag the card sheet up and down | The full-screen button rides above its corner | |
| 2.9 | Open a filter (terrain, season) | Matching parks are coloured, the rest dimmed | |
| 2.10 | Search for a park | It's found; tapping it selects it | |
| 2.11 | "Not for now" on a card, then Undo | Card goes, then comes back | |
| 2.12 | "Not for now" again; Settings → Privacy & preferences → Set aside → See all | It's listed with a "Back on" date; Bring back returns it to Explore | |
| 2.13 | Open a park page | Photo, facts, match breakdown, directions, park map | |

## 3. Trips

| # | Do this | Expect | Result |
|---|---|---|---|
| 3.1 | New entry: park, date, title, notes, 4★, two feedback tags, a trail, a friend, 2 photos, a video, a stamp photo | Saves; the bubble shows "Stamped in person" | |
| 3.2 | In one tag pair, tap one side, then the other | Only one side of a pair is ever on | |
| 3.3 | Pull to refresh, or reopen the app | The trip stays; photos show (synced) | |
| 3.4 | Edit the trip: change the stamp photo and the stars | Saves; the new stamp shows | |
| 3.5 | ▶ on the bubble | Relive plays the trip and ends on "How it was" with the tags stamped on | |
| 3.6 | In Relive, tap the right side quickly on every slide (including "How it was") | Always goes forward, never back | |
| 3.7 | "Relive all" | Plays every trip, then the summary | |
| 3.8 | Delete a trip | It's gone, and stays gone after reopening | |
| 3.9 | Turn on airplane mode, add a trip, turn it off | The trip saves on the phone, then syncs | |

## 4. Passport

| # | Do this | Expect | Result |
|---|---|---|---|
| 4.1 | Open Passport after logging a national park | Its stamp is filled; the count goes up | |
| 4.2 | Tap a region on the map | Shows that region's stamps | |
| 4.3 | Achievements tab | Earned ones are lit; a celebration showed when each was earned | |

## 5. Friends (two accounts)

| # | Do this | Expect | Result |
|---|---|---|---|
| 5.1 | As A, Invite → type B's username (watch the keyboard) | The sheet stays above the keyboard; the request sends | |
| 5.2 | As B, accept the request | A and B are friends | |
| 5.3 | As B, open Friends | A's shared trips are in the feed | |
| 5.4 | As B, ▶ Relive on A's post | Plays A's trip, "A's trip · Mon YYYY" at the top, then closes | |
| 5.5 | As B, comment on one of A's trips (watch the keyboard) | The sheet stays above the keyboard; the comment shows | |
| 5.6 | Switch to A | One banner naming B and the comment; a number on the Friends tab | |
| 5.7 | As B, leave 2 more comments on A's trips, then switch to A | A single "2 new comments" banner | |
| 5.8 | As A, open Friends | "Activity on your trips" with the new ones highlighted, "N new" in full | |
| 5.9 | Tap one; reply | That trip's comments open; after closing, those are no longer highlighted | |
| 5.10 | See all → Mark all as read | Nothing is highlighted any more | |
| 5.11 | As A, Trips | 💬 count on the commented trip, next to ▶; tapping it opens the comments | |
| 5.12 | QR code: show A's code, scan it as B (second phone) | Adds the friend | |

## 6. Settings and accounts

| # | Do this | Expect | Result |
|---|---|---|---|
| 6.1 | Tap your name | The account switcher opens straight away | |
| 6.2 | Switch to the other account | **Stays on Settings**, now showing the other account | |
| 6.3 | Add an account from the switcher | Signs in without signing out of the first; both are listed | |
| 6.4 | Change your profile photo and name | They show on your posts for friends | |
| 6.5 | Retake the quiz with different answers | Explore's picks change | |
| 6.6 | Text size: largest | Text grows; nothing is cut off on the main screens | |
| 6.7 | Arrival reminders on, near a park (or skip) | A reminder to log the visit | |
| 6.8 | Sign out | Back to sign-in; that account is gone from the switcher | |
| 6.9 | Delete a test account | It's gone; signing in with it fails | |

## 7. Other phones

| # | Do this | Expect | Result |
|---|---|---|---|
| 7.1 | Phone set to **button navigation** (◁ ○ ▢; Settings → Display → Navigation bar) | The tab bar sits fully above the buttons on every tab | |
| 7.2 | Same, open the new-trip sheet and scroll to the bottom | "Save entry" is fully visible | |
| 7.3 | A large phone (e.g. Note 20 Ultra) and a small one | Nothing overlaps or is cut off | |
| 7.4 | Phone font size at its largest (system setting) | Still readable; nothing important cut off | |

## 8. Server

| # | Do this | Expect | Result |
|---|---|---|---|
| 8.1 | GitHub → Actions → Weekly NPS sync → Run workflow | Green; "Done. Sent 474 parks." | |
| 8.2 | `https://parkpath-api.onrender.com/health/db` | `"database":"reachable"` | |
| 8.3 | Open the app after the server has been asleep (15+ min) | First load takes up to a minute, then works | |

---

## Findings

Anything that failed, one line each: the test number, what happened, and
who's fixing it.

| Test | What happened | Owner | Fixed in |
|---|---|---|---|
| | | | |
