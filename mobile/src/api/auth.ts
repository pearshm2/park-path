/**
 * Auth calls against api/app/routers/auth.py.
 *
 * Note that /auth/login takes a JSON body ({email, password}) rather
 * than the OAuth2 form encoding — the route is declared with a Pydantic
 * UserLogin model, not OAuth2PasswordRequestForm. Sending form data here
 * would come back as a 422.
 */

import { request } from './client';
import type {
  Credentials,
  ProfileChanges,
  SignUpDetails,
  TokenResponse,
  User,
  UsernameCheck,
} from '../types/auth';

/**
 * POST /auth/signup — 201 with a token; 409 if the email or username is
 * taken, 422 if the username breaks the rules (the message says which).
 */
export function signup(details: SignUpDetails): Promise<TokenResponse> {
  return request<TokenResponse>('/auth/signup', {
    method: 'POST',
    body: details,
  });
}

/** GET /auth/username-available — whether a username is free, and if not, why. */
export function checkUsername(username: string): Promise<UsernameCheck> {
  return request<UsernameCheck>(`/auth/username-available?username=${encodeURIComponent(username)}`);
}

/** PATCH /auth/me — change your username or name; the updated you. */
export function updateProfile(token: string, changes: ProfileChanges): Promise<User> {
  return request<User>('/auth/me', { method: 'PATCH', token, body: changes });
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

/**
 * POST /auth/password-reset — asks the API to email a reset link.
 *
 * NOT IMPLEMENTED SERVER-SIDE YET. api/app/routers/auth.py has signup,
 * login and me only, so this currently returns 404 and the screen says
 * so rather than pretending an email went out.
 *
 * When it is built it should always return 200 regardless of whether the
 * address exists, the same way /auth/login returns one error for both
 * "no such user" and "wrong password" — otherwise it hands an attacker a
 * way to enumerate registered emails.
 */
export function requestPasswordReset(email: string): Promise<void> {
  return request<void>('/auth/password-reset', {
    method: 'POST',
    body: { email },
  });
}

/** POST /auth/me/password — 204, or 400 if the current password is wrong. */
export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await request<null>('/auth/me/password', {
    method: 'POST',
    token,
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

/** PUT /auth/me/avatar — a small JPEG, base64-encoded; the updated you. */
export function setAvatar(token: string, base64: string): Promise<User> {
  return request<User>('/auth/me/avatar', {
    method: 'PUT',
    token,
    body: { content_type: 'image/jpeg', data: base64 },
  });
}

/** DELETE /auth/me/avatar — the updated you, without a picture. */
export function removeAvatar(token: string): Promise<User> {
  return request<User>('/auth/me/avatar', { method: 'DELETE', token });
}
