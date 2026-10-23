/**
 * Auth types, generated from the FastAPI schemas in api/app/schemas.py
 * (see src/api/schema.ts). When the backend changes, regenerate with
 * `npm run api:types` instead of editing these by hand; CI checks that.
 */

import type { components } from '../api/schema';

/** api/app/schemas.py :: Token */
export type TokenResponse = components['schemas']['Token'];

/** api/app/schemas.py :: UserOut */
export type User = components['schemas']['UserOut'];

/** api/app/schemas.py :: UserLogin */
export type Credentials = components['schemas']['UserLogin'];

/** api/app/schemas.py :: UserCreate: credentials, a username and a name. */
export type SignUpDetails = components['schemas']['UserCreate'];

/** api/app/schemas.py :: UserUpdate: any of a new username or name. */
export type ProfileChanges = components['schemas']['UserUpdate'];

/** api/app/schemas.py :: UsernameCheck */
export type UsernameCheck = components['schemas']['UsernameCheck'];
