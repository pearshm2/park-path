# ParkPath app

The ParkPath Android app: Expo (SDK 57), React Native and Expo Router.
It talks to the ParkPath API in `../api`.

## Run it on your phone

1. Install the packages (from this `mobile` folder):

   ```bash
   npm install
   ```

2. Tell the app where the API is. In `mobile/.env`:

   ```
   EXPO_PUBLIC_API_URL=https://parkpath-api.onrender.com
   ```

   Or your computer's LAN address (e.g. `http://192.168.1.20:8000`) to use
   the API running locally in Docker.

3. Start it, then scan the QR code with **Expo Go**:

   ```bash
   npx expo start
   ```

   After changing `.env`, restart with `npx expo start --clear`.

Expo Go runs the app in development mode, which is noticeably slower than
the real app. Judge speed on the APK.

## Installable APK

See `docs/apk.md` in the repo root. Builds run on Expo's servers with
`npx eas-cli@latest build --platform android --profile preview`.

## Checks (the same ones CI runs)

```bash
npm run lint
npm run typecheck
```

## Where things are

- `src/app/`: the screens (Expo Router: one file per route; `(tabs)` is
  the tab bar, `(auth)` sign-in and sign-up)
- `src/components/`: shared pieces (map, cards, sheets, passport, trips)
- `src/api/`: calls to the API. `schema.ts` is generated from
  `api/openapi.json`; after the API changes, run `npm run api:types`
- `src/data/`: static data (regions, quiz, achievements)
- `src/theme/`: colours, fonts and spacing
- Contexts for app-wide state: `src/auth`, `src/trips`, `src/quiz`,
  `src/wishlist`, `src/celebrations`, `src/arrivals`
