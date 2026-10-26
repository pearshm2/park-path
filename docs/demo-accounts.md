# Demo accounts

The accounts we demo with, on the **hosted API**
(`https://parkpath-api.onrender.com`, which the APK uses). They aren't on
anyone's local Docker database. Seeded Oct 26 with `api/seed_demo.py`.

## Who's who

| Person | Sign in with | Password | What they have |
| --- | --- | --- | --- |
| Halie (`@pears.hm2`, shown as "Pears Hm") | pears.hm2@gmail.com | Ask Halie | 4 trips, the Northeast region complete |
| Maya Torres (`@mayatorres`) | maya.torres.demo@example.com | `password123` | 12 trips: all 10 Southwest parks, Rocky Mountain, Grand Teton |
| Jordan Lee (`@jordanlee`) | jordan.lee.demo@example.com | `password123` | 6 trips: all of Appalachia, Biscayne, Blue Ridge Parkway |
| Sam Okafor (`@samokafor`) | sam.okafor.demo@example.com | `password123` | 3 trips: Acadia, Cuyahoga Valley, Indiana Dunes |

Maya, Jordan and Sam are made up. Their `example.com` emails can't reach
anyone, and their trips have no photos.

- **Friends:** all four are friends with each other, so Halie's Friends feed
  shows the other three.
- **Halie's trips:** Joshua Tree (Aug 2024, 5★), Congaree (Jan 2026, 3★) and
  Guilford Courthouse (Oct 2026, 3★), each with 8 of her own photos or
  videos. Plus Acadia (Sept 2025, 4★), a staged trip with three
  public-domain NPS photos ("NPS Photo by Kent Miller"). The Northeast is
  only Acadia, so this completes a region on her account for the demo.
- **Companions:** Maya and Jordan are tagged together on some trips, and
  Jordan and Sam on one, so the "trips with friends" achievements unlock.
- **Comments:** each of Halie's trips has a comment from a friend, and Jordan
  commented on Maya's Grand Teton trip.
- **Region badges:** everyone has completed a region: Halie and Sam the
  Northeast (Acadia), Maya the Southwest, Jordan Appalachia.

## During the demo

- Sebastian signs up live, Halie adds him by email, and he logs their
  Guilford Courthouse trip with Halie tagged ("Who was with you"). The full
  script is shared separately.
- The Friends feed is ordered by when trips were logged, not by visit date,
  so Sam's trips (logged last) come first.

## Seeding again

If the Render database is wiped (free Postgres is deleted after 30 days),
run this from `park-path/api` with the virtual environment active:

```bash
python seed_demo.py HALIES-PASSWORD
```

This creates whichever accounts are missing (Halie's with the password you
pass), plus the friendships, the friends' trips and the comments. It leaves
anything that already exists alone, so it's safe to run again.

The Acadia trip is always added, with its photos downloaded from nps.gov.
Halie's other three trips need her own photos, which aren't in the repo.
Ask her for the folder, then pass it as well:

```bash
python seed_demo.py HALIES-PASSWORD path/to/demo-media
```

The script removes location and camera data from photos before uploading
them, but not from videos. Strip videos first with ffmpeg:

```bash
ffmpeg -i IMG_4465.MP4 -map 0:v:0 -map 0:a:0 -c copy -map_metadata -1 IMG_4465.mp4
```

To seed a local API instead, set `PARKPATH_API=http://localhost:8000`. Its
park list must be synced first (see `docs/deploy.md`).
