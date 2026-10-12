# Signing In on a Phone with Expo Go

How to get from "the app opens on my phone" to "I'm signed in and see the quiz
and Explore page."

## Why the app opens but sign-in fails

Expo Go only delivers the app's **screens** to the phone. Signing in is a
separate step: the phone sends your email and password to the **ParkPath API**
(running in Docker on your computer), and the API checks them against the
**database**.

```
Phone (Expo Go)  ──Wi-Fi──▶  ParkPath API (your computer, port 8000)  ──▶  Database
```

If the phone can't reach the API, the app still opens, but sign-in fails. The
fix is almost always one of these:

1. The API isn't running on your computer.
2. `mobile/.env` is missing, or has someone else's address in it.
3. You're trying to sign in with an account that only exists on someone
   else's computer.
4. The phone and computer can't reach each other over the Wi-Fi.

Work through the steps below in order.

These steps are written for **Windows** using **Git Bash**, the same as
[demo.md](demo.md).

---

## Step 1: Start the API and database

Open **Docker Desktop** and wait until it says **Engine running**. Then:

```bash
cd /c/park-path/api
docker compose up -d
docker compose ps
```

You should see two rows, `db` and `api`, both `Up`.

**First time on this computer only:** load the park data. Without it, the
Explore page will be empty even after you sign in.

```bash
docker compose exec api python -m app.nps_sync --from-snapshot
docker compose exec api python -m app.curate_sites
```

Check it in a browser **on the computer**: http://localhost:8000/docs should
show the ParkPath API page.

## Step 2: Find your computer's Wi-Fi address

```bash
ipconfig
```

Under **Wireless LAN adapter Wi-Fi**, find the **IPv4 Address**, for example
`192.168.1.37`. Use the Wi-Fi one, not a "vEthernet" or "WSL" adapter.

## Step 3: Point the app at your computer

Open (or create) the file `mobile/.env` and make it say exactly this, using
**your** address from Step 2:

```
EXPO_PUBLIC_API_URL=http://192.168.1.37:8000
```

Watch for these mistakes:

- **Don't copy a teammate's `.env`.** Their address points at *their* laptop.
  Every computer needs its own.
- **Don't use `localhost` or `10.0.2.2`.** On a real phone, `localhost` means
  the phone itself, and `10.0.2.2` only works in the Android emulator.
- `.env` isn't stored in git, so a fresh `git clone` won't have it. You have
  to create it.
- If your Wi-Fi changes (home, campus, hotspot), your address changes too.
  Repeat Steps 2 and 3.

## Step 4: Check the phone can reach the API

Before you open the app, open the phone's **web browser** (Chrome or Safari)
and go to:

```
http://192.168.1.37:8000/health
```

(using your address). You should see a short JSON response.

- **It loads:** the connection works. Go to Step 5.
- **It times out or won't load:** the app won't be able to sign in either. See
  [The phone can't reach the API](#the-phone-cant-reach-the-api) below.

This test is the quickest way to tell whether the problem is the network or
the app.

## Step 5: Restart Expo

Expo only reads `.env` when it starts, so a change made while it's running is
ignored. Stop Expo with `Ctrl+C`, then start it with a cleared cache:

```bash
cd /c/park-path/mobile
npx expo start -c
```

Scan the QR code:

- **Android:** use the scanner in the Expo Go app.
- **iPhone:** use the **Camera** app. When Expo Go asks to find devices on
  your **local network**, tap **Allow**.

## Step 6: Create an account. Don't sign in yet.

Accounts are saved in the database **on the computer running the API**. An
account a teammate made on their laptop doesn't exist on yours. Trying to
sign in with it gives **"Incorrect email or password."**

So the first time on a new computer:

1. On the sign-in screen, tap **Create an account**.
2. Enter any email (it can be made up, e.g. `test@example.com`) and a password
   of **at least 8 characters**.
3. Tap **Create account**.

After that you can sign in with the same email and password on that computer.

**Use email and password, not the Google button.** Google sign-in isn't
connected yet. It only shows a "not set up yet" message.

## Step 7: Quiz, then Explore

After you create an account, the app opens the **quiz** automatically. When
you finish it, you land on the **Explore** page. If you sign out and back in
later, you go straight to Explore.

---

## Troubleshooting

### What the error message means

| Message on the sign-in screen | What it means | Fix |
| --- | --- | --- |
| `Could not reach the ParkPath API at http://...` | The phone can't talk to the API. Check whether the address shown is **your** computer's. | If the address is wrong, redo Step 3, then Step 5. If it's right, see below. |
| `EXPO_PUBLIC_API_URL is not set in mobile/.env` | There is no `.env` file, or it's in the wrong folder or misnamed. | It must be `mobile/.env` exactly, not `.env.txt` and not at the project root. Redo Step 3, then Step 5. |
| `Incorrect email or password.` | The phone **is** connected. That account doesn't exist in your database, or the password is wrong. | Create a new account (Step 6). |
| `An account with that email already exists.` | You already signed up with that email. | Tap **I already have an account** and sign in. |
| `The ParkPath API had a problem handling that.` | The API is running but hit an error. | Run `docker compose logs api --tail 30` in `api/` and share the output with the team. |
| The button spins for a long time, then shows the "could not reach" error | The network is blocking the connection. | See below. |

### The phone can't reach the API

Run these checks in order. If Step 4's browser test fails, one of these is the
reason.

1. **Is the API running?** http://localhost:8000/docs must load **on the
   computer**. If it doesn't, go back to Step 1.
2. **Same Wi-Fi?** The phone has to be on the **same Wi-Fi network** as the
   computer. Turn off mobile data on the phone while testing, and make sure
   it isn't on a guest network.
3. **Windows network set to Private:** Windows blocks incoming connections on
   "Public" networks. Open **Settings → Network & internet → Wi-Fi → (your
   network)** and set **Network profile type** to **Private network**.
4. **Firewall:** if Windows asks whether to allow Docker or Node.js through
   the firewall, click **Allow**, and make sure **Private networks** is
   checked. To add a rule by hand, open **PowerShell as administrator** and
   run:
   ```powershell
   New-NetFirewallRule -DisplayName "ParkPath API 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private
   ```
5. **School, work, or venue Wi-Fi:** these networks often stop devices from
   talking to each other. There is nothing you can change on your end. Use
   one of these instead:
   - **Phone hotspot:** connect the computer to the phone's hotspot, run
     `ipconfig` again to get the new address, update `mobile/.env`, and
     restart Expo.
   - **Android with a USB cable:** turn on USB debugging (see the "real
     Android phone" section of [demo.md](demo.md)), plug the phone in, and
     run `adb reverse tcp:8000 tcp:8000`. Then set
     `EXPO_PUBLIC_API_URL=http://localhost:8000` and restart Expo. This
     doesn't use the Wi-Fi at all.

### The app won't load at all (before sign-in)

That's an Expo connection problem, not a sign-in problem. Try
`npx expo start --tunnel`. Tunnel mode only fixes loading the **app**,
though. Sign-in still needs the phone to reach port 8000 as described above.

### Signed in, but Explore is empty

The park data hasn't been loaded into your database. Run the two commands
from Step 1's "first time" section, then pull down to refresh or restart the
app.

---

## Quick checklist

- [ ] Docker Desktop shows **Engine running**, and `docker compose ps` shows `db` and `api` as `Up`
- [ ] Park data loaded (first time only)
- [ ] `mobile/.env` has **this computer's** Wi-Fi IPv4 address with `:8000`
- [ ] `http://<address>:8000/health` loads in the **phone's** browser
- [ ] Expo restarted with `npx expo start -c` after editing `.env`
- [ ] Created a **new account** on this computer instead of signing in with a teammate's
- [ ] Used email and password, not Google
