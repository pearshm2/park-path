# Running the ParkPath Demo

How to get the full ParkPath stack running on one computer for a demo:
the database and API in Docker, and the mobile app in an Android emulator.

```
Android emulator (Expo Go)  →  FastAPI (Docker, port 8000)  →  Postgres (Docker, port 5432)
```

Everything runs on the same machine, so the demo doesn't depend on Wi-Fi
between a phone and a laptop.

These steps are written for **Windows** using **Git Bash**. Commands in code
blocks are meant to be copied and pasted.

---

## Part 1: One-time setup

Do this once per computer. Budget 1–2 hours on a fresh machine, mostly downloads.

### 1. Install the tools

| Tool | Where to get it | What it's for |
| --- | --- | --- |
| Git (includes Git Bash) | git-scm.com | Getting the code |
| Docker Desktop | docker.com | Runs the database and API |
| Node.js (LTS version) | nodejs.org | Runs the Expo app |
| Android Studio | developer.android.com/studio | Provides the Android emulator |

When installing Android Studio, choose the **Standard** install type and make
sure **Android Virtual Device** is selected.

Python is **not** needed to run the demo. The API runs inside Docker. Python
3.11 is only needed for running tests or the live NPS sync on your own machine.

**Computer requirements for the emulator:** roughly 15–20 GB of free disk space,
16 GB of RAM recommended (8 GB works but is slow), and virtualization enabled.
To check virtualization, open Task Manager → Performance → CPU and look for
"Virtualization: Enabled."

### 2. Get the code

```bash
cd /c/
git clone https://github.com/pearshm2/park-path.git
cd park-path
```

### 3. Tell Windows where the Android tools are

Expo needs an environment variable to find Android Studio's tools.

1. Press the Windows key, type **environment variables**, and open
   **"Edit environment variables for your account."**
2. In the **top** section ("User variables"), click **New...**
   - Variable name: `ANDROID_HOME`
   - Variable value: `%LOCALAPPDATA%\Android\Sdk`
3. Still in the top section, select **Path** → **Edit...** → **New**, and add:
   ```
   %LOCALAPPDATA%\Android\Sdk\platform-tools
   ```
4. Click **OK** on every window.
5. **Fully close and reopen** VS Code and any Git Bash windows. Programs only
   pick up new environment variables when they start.

Check it worked:

```bash
adb --version
```

You should see `Android Debug Bridge version ...`.

### 4. Create a virtual phone

1. Open Android Studio. On the welcome screen, click **More Actions** (or the
   **⋮** menu) → **Virtual Device Manager**. Don't use "New Project"; we don't
   need one.
2. If a phone is already listed, you're done with this step.
3. Otherwise click **Create Virtual Device** (or **+**), pick a phone such as a
   **Pixel 8**, and choose a recent Android system image labeled
   **Google Play** or **Google APIs**.

### 5. Point the app at the API

Create a file named `.env` inside the `mobile/` folder containing:

```
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
```

`10.0.2.2` is the Android emulator's special address for "the computer I'm
running on." Plain `localhost` would point at the emulator itself.

`.env` files are ignored by git, so this file has to be created on each new
computer.

### 6. Install the app's packages

```bash
cd /c/park-path/mobile
npm install
```

`WARN` lines and "vulnerabilities" messages are normal for Expo projects.
**Do not run `npm audit fix --force`.** It can install package versions that
don't match our Expo SDK and break the app.

---

## Part 2: Starting the demo (every time)

### 1. Start the database and API

Open **Docker Desktop** and wait until it says **Engine running**. Then:

```bash
cd /c/park-path/api
docker compose up -d
```

The first run builds the API and takes a few minutes. Later runs are fast.
The API applies database migrations automatically when it starts.

Check that both containers are up:

```bash
docker compose ps
```

You should see two rows, `db` and `api`, both with a status of `Up`.

### 2. Load park data (first time on a computer)

This loads the 474 NPS sites from the committed snapshot, then adds our own
data (terrain, effort, seasons, which sites are national parks) on top. It
needs no internet connection and no API key.

```bash
docker compose exec api python -m app.nps_sync --from-snapshot
docker compose exec api python -m app.curate_sites
```

You should see `Sites in database: ... 474 after`, then
`Curated 119 of 119 sites.` Running either again is safe; nothing is
duplicated. If `data/curated_sites.json` changes after a `git pull`, run the
second command again.

### 3. Check the API

Open **http://localhost:8000/docs** in a browser. You should see the
**ParkPath API** documentation page. Opening
**http://localhost:8000/sites?scope=parks** should list the national parks.

### 4. Start the virtual phone

In Android Studio: **More Actions → Virtual Device Manager → ▶** on your phone.
Wait until it reaches the Android home screen. Then check:

```bash
adb devices
```

You should see a line like `emulator-5554   device`.

### 5. Start the app

```bash
cd /c/park-path/mobile
npx expo start
```

When the menu appears, press **`a`**. If asked to install Expo Go on the
emulator, say yes. The first load takes a minute or two.

---

## Part 3: The demo walkthrough

### In the app

1. **Sign up** with a made-up email and password. This goes app → API →
   database, so it proves the whole stack is connected.
2. **Take the quiz.**
3. **Show the tabs.** Explore, Trips, Passport, and Friends are placeholders
   for upcoming weeks.

### Behind the scenes

- **CI:** open a pull request on GitHub and show the green `lint` and
  `test-api` checks. Every PR is linted and tested against a real Postgres
  database automatically.
- **NPS sync is idempotent:** run the sync twice and show the count doesn't
  change:
  ```bash
  cd /c/park-path/api
  docker compose exec api python -m app.nps_sync --from-snapshot
  docker compose exec api python -m app.nps_sync --from-snapshot
  ```
- **API docs:** show http://localhost:8000/docs.

---

## Part 4: Shutting down

- Stop the app: press `Ctrl+C` in the Expo terminal.
- Close the emulator window.
- Stop the database and API (data is kept):
  ```bash
  cd /c/park-path/api
  docker compose stop
  ```

**Don't run `docker compose down -v`.** The `-v` deletes the database's saved
data, including the park data and any accounts.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `adb: command not found` | The environment variables from Part 1 step 3 aren't set, or the terminal was opened before setting them. Fully close and reopen VS Code or Git Bash. |
| `failed to connect to the docker API` | Docker Desktop isn't running. Open it and wait for **Engine running**. |
| Docker Desktop won't start and mentions **WSL** | Open PowerShell as administrator, run `wsl --update` (or `wsl --install` if it's missing), then restart the computer. |
| http://localhost:8000/docs won't load | Run `docker compose ps` in `api/`. If only `db` is listed, run `docker compose up -d`. If `api` says `Exited`, run `docker compose logs api --tail 30` to see why. |
| App says `EXPO_PUBLIC_API_URL is not set` | `mobile/.env` is missing or misnamed. Create it (Part 1 step 5), then stop Expo with `Ctrl+C` and run `npx expo start` again. |
| App says it `could not reach the ParkPath API` | Check the docs page loads, and that `mobile/.env` says exactly `http://10.0.2.2:8000`. Restart Expo after any change to `.env`. |
| `adb devices` shows `offline` or nothing | The emulator is still booting. Wait 30 seconds and try again. |
| `port is already allocated` when starting Docker | Another program is using port 5432 or 8000, often a separately installed Postgres. Stop that program, or ask a teammate for help. |

---

## Backup plan: a real Android phone

If the computer can't run the emulator, use an Android phone connected **by USB**.

1. On the phone: Settings → About phone → tap **Build number** 7 times to
   enable Developer options, then turn on **USB debugging** in Developer options.
2. Plug the phone in and accept the "Allow USB debugging?" prompt.
3. Find the computer's network address: run `ipconfig` and note the
   **IPv4 Address** (for example `192.168.1.20`).
4. In `mobile/.env`, use that address instead of `10.0.2.2`:
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.20:8000
   ```
5. Run `npx expo start` and press **`a`**. Expo installs the matching Expo Go
   on the phone.

The phone and computer must be on the **same Wi-Fi**, and Windows may ask to
allow access through the firewall. Click **Allow**.
---

## Running on an iPhone

The app is the same code on iPhone; only the connection setup differs.
There is no iPhone simulator on Windows, so this uses a real iPhone.

1. On the iPhone, install **Expo Go** from the App Store. It only supports the
   newest Expo version, so check it opens the app well before demo day.
2. Find the computer's network address: run `ipconfig` and note the Wi-Fi
   **IPv4 Address** (for example `192.168.1.154`).
3. In `mobile/.env`, use that address. The Android emulator can use it too:
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.154:8000
   ```
4. Run `npx expo start` (restart it after any `.env` change) and scan the QR
   code with the iPhone's **Camera** app.
5. When Expo Go asks to find devices on your **local network**, tap **Allow**.
   If you tapped Don't Allow, turn it on under Settings → Expo Go → Local Network.

The iPhone and computer must be on the **same Wi-Fi**, and that network must
let devices reach each other. Home Wi-Fi usually does; campus and venue Wi-Fi
often doesn't. There is no USB fallback for iPhone like Android's
`adb reverse`, so for presentations on unfamiliar Wi-Fi, plan on a hosted API.
