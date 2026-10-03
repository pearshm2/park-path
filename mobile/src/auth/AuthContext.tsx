/**
 * Session state for the whole app.
 *
 * Holds the access token, the signed-in user, and the three operations
 * the auth screens need. On launch it restores a stored token and
 * verifies it against GET /auth/me — tokens last 24h (see
 * api/app/config.py), so a stored one is frequently expired and trusting
 * it blindly would drop the user into the app only to 401 on first use.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { fetchCurrentUser, login as loginRequest, signup as signupRequest } from '../api/auth';
import { clearToken, loadToken, saveToken } from '../api/tokenStorage';
import type { Credentials, User } from '../types/auth';

/**
 * `restoring` is the launch state, before we know whether the stored
 * token is good. The root layout renders nothing during it so the user
 * never sees the sign-in screen flash before being sent to the app.
 */
type AuthStatus = 'restoring' | 'signedIn' | 'signedOut';

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  token: string | null;
  signIn: (credentials: Credentials) => Promise<void>;
  signUp: (credentials: Credentials) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await loadToken();
      if (cancelled) return;

      if (!stored) {
        setStatus('signedOut');
        return;
      }

      try {
        const me = await fetchCurrentUser(stored);
        if (cancelled) return;
        setToken(stored);
        setUser(me);
        setStatus('signedIn');
      } catch {
        // Expired, revoked, or the API is unreachable. Either way we
        // cannot prove the session, so start signed out and let the user
        // sign in again — which will surface the real error if the API
        // is down.
        if (cancelled) return;
        await clearToken();
        setStatus('signedOut');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Signup and login differ only in which endpoint issues the token, so
   * the "store it, then identify the user" half is shared.
   */
  const establishSession = useCallback(async (accessToken: string) => {
    await saveToken(accessToken);
    setToken(accessToken);

    try {
      setUser(await fetchCurrentUser(accessToken));
    } catch {
      // The token is valid — it was just issued — so a failure here is a
      // transient /auth/me problem. Enter the app anyway; the profile can
      // fill in later rather than blocking sign-in on it.
      setUser(null);
    }

    setStatus('signedIn');
  }, []);

  const signIn = useCallback(
    async (credentials: Credentials) => {
      const { access_token } = await loginRequest(credentials);
      await establishSession(access_token);
    },
    [establishSession],
  );

  const signUp = useCallback(
    async (credentials: Credentials) => {
      const { access_token } = await signupRequest(credentials);
      await establishSession(access_token);
    },
    [establishSession],
  );

  const signOut = useCallback(async () => {
    await clearToken();
    setToken(null);
    setUser(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, token, signIn, signUp, signOut }),
    [status, user, token, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside an <AuthProvider>');
  return value;
}
