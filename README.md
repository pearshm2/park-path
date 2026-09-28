# park-path

[Team Notes](https://github.com/pearshm2/park-path/wiki/ParkPath-Team-Reflective-Notes)

ParkPath — a recommendation engine that suggests your next national park using three signals: your preferences (terrain, activities, crowd tolerance), proximity, and collaborative filtering from similar travelers. Paired with a memory-logging feature (trip photos/journals feed back into future recommendations).

# ParkPath

National parks recommendation app (senior capstone).

## Structure
- `mobile/` – React Native + Expo app (TypeScript)
- `backend/` – FastAPI + PostgreSQL API
- `.github/workflows/` – CI
- `docs/` – project docs

## Run the mobile app
```bash
cd mobile
npm install
npx expo start
```
Scan the QR code with Expo Go on Android.
