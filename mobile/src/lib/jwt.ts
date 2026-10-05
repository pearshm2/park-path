/**
 * Minimal JWT payload reader.
 *
 * SECURITY NOTE: this does NOT verify the signature and must never be
 * used to decide whether a token is valid or what a user may do. The API
 * is the only thing that validates tokens (see api/app/dependencies.py).
 * This exists purely so the app can name local storage per account
 * without waiting on a network round trip to GET /auth/me.
 */

/**
 * Returns the token's `sub` claim, which the API sets to the user's id
 * as a string (see create_access_token in api/app/security.py).
 *
 * Returns null for anything malformed — a stored token can be stale,
 * truncated, or hand-edited, and none of that should throw.
 */
export function readTokenSubject(token: string | null): string | null {
  if (!token) return null;

  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    // JWT uses base64url; atob expects standard base64 with padding.
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

    // atob is global in React Native 0.74+ and in browsers, but guard
    // anyway so an unexpected runtime degrades instead of crashing.
    if (typeof atob !== 'function') return null;

    const claims = JSON.parse(atob(padded)) as { sub?: unknown };
    return typeof claims.sub === 'string' && claims.sub ? claims.sub : null;
  } catch {
    return null;
  }
}
