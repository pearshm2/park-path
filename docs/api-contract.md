# API contract check

The app and the API have to agree on the shape of every response: field
names, types, what can be null. Before this check, the app's TypeScript
types were written by hand to mirror `api/app/schemas.py`, and nothing
noticed when the two drifted apart. Now they're generated from the API, and
CI fails if they fall out of step.

## How it works

```
api/app/schemas.py + routers ──(python -m app.export_openapi)──▶ api/openapi.json
api/openapi.json ──(npm run api:types)──▶ mobile/src/api/schema.ts
mobile/src/api/*.ts use the types in schema.ts
```

1. **`api/openapi.json`** is the API's contract: FastAPI's own description of
   every route and response (the same thing that powers `/docs`). It's
   committed, so every pull request shows exactly how the API changed.
2. **`mobile/src/api/schema.ts`** is generated from it by
   [openapi-typescript](https://openapi-ts.dev/). Don't edit it by hand.
3. The app's response types point at the generated ones, for example:
   ```ts
   type SiteOut = components['schemas']['SiteOut'];
   ```
   So if the API renames or removes a field the app uses, `npm run typecheck`
   fails and names the exact line.

## When you change the API (Sebastian, or anyone)

After changing a route or anything in `api/app/schemas.py`:

```bash
cd api
python -m app.export_openapi      # updates api/openapi.json
cd ../mobile
npm run api:types                 # updates src/api/schema.ts
npm run typecheck                 # shows any app code that needs updating
```

Commit `api/openapi.json` and `mobile/src/api/schema.ts` with your change.

## When you add an API call in the app (Halie, or anyone)

Use the generated type for the response instead of writing it by hand:

```ts
import type { components } from './schema';

type TripOut = components['schemas']['TripOut'];
const trips = await request<TripOut[]>('/trips', { token });
```

Keep converting to the app's own shapes (camelCase and so on) in `src/api/`
as before. Only the raw response types come from `schema.ts`.

## What CI checks (the `app` job)

1. `api/openapi.json` matches the current API code.
2. `mobile/src/api/schema.ts` matches `api/openapi.json`.
3. The app type-checks (`npm run typecheck`) against those types.
4. The app passes lint (`npm run lint`).

If step 1 or 2 fails, the error message says which command to run.

## Limits

- It checks **response and request shapes**, not URLs. A call to a route that
  doesn't exist (for example `POST /auth/password-reset` today) still
  type-checks; it fails at runtime with a 404.
- Types only cover what the app reads through `schema.ts`. A hand-written
  type somewhere else won't be checked, so use the generated ones.
