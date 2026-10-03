/**
 * Auth calls against api/app/routers/auth.py.
 *
 * Note that /auth/login takes a JSON body ({email, password}) rather
 * than the OAuth2 form encoding — the route is declared with a Pydantic
 * UserLogin model, not OAuth2PasswordRequestForm. Sending form data here
 * would come back as a 422.
 */

import { request } from './client';
import type { Credentials, TokenResponse, User } from '../types/auth';

/** POST /auth/signup — 201 with a token, or 409 if the email is taken. */
export function signup(credentials: Credentials): Promise<TokenResponse> {
  return request<TokenResponse>('/auth/signup', {
    method: 'POST',
    body: credentials,
  });
}

/** POST /auth/login — 200 with a token, or 401 on bad credentials. */
export function login(credentials: Credentials): Promise<TokenResponse> {
  return request<TokenResponse>('/auth/login', {
    method: 'POST',
    body: credentials,
  });
}

/** GET /auth/me — the signed-in user, or 401 if the token is stale. */
export function fetchCurrentUser(token: string): Promise<User> {
  return request<User>('/auth/me', { token });
}
