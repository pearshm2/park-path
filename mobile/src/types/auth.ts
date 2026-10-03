/**
 * Auth types mirroring the FastAPI schemas in api/app/schemas.py.
 *
 * Keep these in step with that file — if the backend's response shape
 * changes, this is the one place the app needs editing.
 */

/** api/app/schemas.py :: Token */
export type TokenResponse = {
  access_token: string;
  token_type: string;
};

/** api/app/schemas.py :: UserOut */
export type User = {
  id: number;
  email: string;
};

/** api/app/schemas.py :: UserCreate / UserLogin */
export type Credentials = {
  email: string;
  password: string;
};
