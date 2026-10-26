# park-path

[Team Notes](https://github.com/pearshm2/park-path/wiki/ParkPath-Team-Reflective-Notes)

ParkPath — a recommendation engine that suggests your next national park from a short quiz: the scenery you like, when you travel, how busy you like it, and how far it is from you. It learns from your trip journal: parks you've visited move down, terrains you rated highly get a boost, and it suggests something different to try. A "friends' picks" signal is planned. Paired with a trip journal (photos, videos and notes, shared with friends) and a passport of the parks you've been to.

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