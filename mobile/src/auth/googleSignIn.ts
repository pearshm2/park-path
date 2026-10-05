/**
 * Google sign-in — the single integration point.
 *
 * NOT CONNECTED YET. The button exists and is styled, but two pieces have
 * to be built before it can actually sign anyone in:
 *
 *   1. A Google Cloud OAuth client. Create one at
 *      console.cloud.google.com -> APIs & Services -> Credentials, then
 *      put its id in mobile/.env as EXPO_PUBLIC_GOOGLE_CLIENT_ID.
 *      Android and web need separate client ids and a redirect URI
 *      matching the app's scheme ("parkpath", set in app.json).
 *
 *   2. An API route that trades a Google credential for a ParkPath token.
 *      api/app/routers/auth.py has no OAuth route today — it only issues
 *      tokens for email + password. It would need something like
 *      POST /auth/google that verifies the Google ID token against
 *      Google's public keys, finds or creates the matching user row, and
 *      returns the same {access_token, token_type} shape as /auth/login,
 *      so nothing above this file has to change.
 *
 * Once both exist, install expo-auth-session, run the flow here, POST the
 * resulting id_token to that route, and return its TokenResponse. The
 * auth screens already handle everything downstream.
 */

import type { TokenResponse } from '../types/auth';

/** Thrown when the button is pressed before the pieces above are in place. */
export class GoogleSignInUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleSignInUnavailableError';
  }
}

/** Set in mobile/.env. Empty until a Google Cloud client exists. */
export const GOOGLE_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '').trim();

export const isGoogleSignInConfigured = GOOGLE_CLIENT_ID.length > 0;

/**
 * Will perform the Google flow and return a ParkPath token.
 *
 * Throws {@link GoogleSignInUnavailableError} until the two steps in the
 * file header are done. It fails loudly and specifically on purpose — a
 * button that silently does nothing is harder to diagnose than one that
 * says what is missing.
 */
export async function signInWithGoogle(): Promise<TokenResponse> {
  throw new GoogleSignInUnavailableError(
    isGoogleSignInConfigured
      ? 'Google sign-in is not finished yet — the API has no route to accept a Google account. Use your email and password for now.'
      : 'Google sign-in is not set up yet. Use your email and password for now.',
  );
}
