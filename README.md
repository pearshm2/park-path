# park-path

[Team Notes](https://github.com/pearshm2/park-path/wiki/ParkPath-Team-Reflective-Notes)

ParkPath — a recommendation engine that suggests your next national park using three signals: your preferences (terrain, activities, crowd tolerance), proximity, and collaborative filtering from similar travelers. Paired with a memory-logging feature (trip photos/journals feed back into future recommendations).

## Structure
- `mobile/` – React Native + Expo app (TypeScript)
- `api/` – FastAPI + PostgreSQL backend
- `.github/workflows/` – CI
- `docs/` – project docs

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
Scan the QR code with Expo Go on Android.