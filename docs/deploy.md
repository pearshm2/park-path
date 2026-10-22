# Deploying the API to Render

The API and its database run on [Render](https://render.com), so the app
works without anyone's laptop running Docker. Everything Render needs is
described in `render.yaml` at the repo root (a "Blueprint").

```
Phone (app)  ──internet──▶  parkpath-api (Render, Docker)  ──▶  parkpath-db (Render Postgres)
```

## Free plan: what to know

- **The API sleeps** after 15 minutes without requests. The first request
  after that takes about a minute while it wakes up. Before a demo, open
  `https://<your-api>.onrender.com/health` a few minutes early.
- **The free database is deleted 30 days after it's created** (with a 14-day
  grace period to upgrade). Park data is easy to reload (see step 5), but
  accounts, friends and trips on it are lost. Note the creation date.
- **750 free hours a month** for the API, which is enough for one service
  running all month.

## First-time setup

### 1. Sign in to Render with GitHub

Go to <https://render.com>, sign up with **GitHub**, and let Render access the
`park-path` repository.

If you aren't the repo's owner, GitHub may send an access request to the
owner instead. They approve it under GitHub **Settings → Applications**
(or from the email GitHub sends them).

### 2. Create the Blueprint

1. In the Render dashboard: **New → Blueprint**.
2. Pick the `park-path` repository and the `main` branch.
3. Render reads `render.yaml` and lists two things to create:
   `parkpath-db` (database) and `parkpath-api` (web service).
4. It asks for **`NPS_API_KEY`**. Paste your NPS key (the same one in
   `api/.env`). It's stored in Render, never in the repo.
5. Click **Apply**.

### 3. Wait for the first deploy

Open `parkpath-api` → **Logs**. The first build takes several minutes. It's
done when you see the migrations run (`Running upgrade ... -> 0010`) and then
`Uvicorn running on http://0.0.0.0:...`.

Copy the service's URL from the top of its page, e.g.
`https://parkpath-api.onrender.com`. If that name was taken, Render adds a
suffix, so use the exact URL shown.

### 4. Check it

In a browser:

- `https://<your-api>.onrender.com/health` → `{"status":"ok"}`
- `https://<your-api>.onrender.com/health/db` → `"database":"reachable"`
- `https://<your-api>.onrender.com/docs` → the API docs page

### 5. Load the park data (from your laptop)

The new database has the tables (the migrations ran) but no parks. Load them
from your laptop by pointing the data scripts at Render's database:

1. In Render: `parkpath-db` → **Connect** → copy the **External Database URL**.
2. In Git Bash, from `api/` with the virtual environment active:

```bash
export DATABASE_URL='paste-the-External-Database-URL-here'
python -m app.nps_sync --from-snapshot     # 474 sites
python -m app.curate_sites                 # 119 curated
python -m app.park_map_sync                # park maps; takes several minutes
```

3. **Close that terminal when you're done.** While `DATABASE_URL` is set,
   anything you run there (including `pytest`, which creates test accounts)
   goes to the real database.

Check: `https://<your-api>.onrender.com/sites?scope=parks` lists 62 parks.

### 6. Point the app at it

In `mobile/.env`:

```
EXPO_PUBLIC_API_URL=https://<your-api>.onrender.com
```

Restart Expo with `npx expo start --clear`. The phone now talks to Render, so
it works on any Wi-Fi or mobile data, with no port forwarding. This is a new
database, so sign up again.

(Expo Go still needs a laptop running `npx expo start` to deliver the app's
code. The installable APK removes that; see the APK section once it exists.)

## Everyday use

- **Deploys are automatic.** Every merge to `main` that changes something in
  `api/` redeploys the API, and migrations run on startup.
- **Logs:** `parkpath-api` → **Logs** in the dashboard.
- **Reloading data** (after the 30-day reset, or to refresh): repeat step 5.
- **Secrets** (`SECRET_KEY`, `NPS_API_KEY`, later the S3 keys) live in
  `parkpath-api` → **Environment** in the dashboard, never in the repo.
