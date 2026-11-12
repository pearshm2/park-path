/**
 * Session state for the whole app.
 *
 * Holds the access token, the signed-in user, and the three operations
 * the auth screens need. On launch it restores a stored token and
 * verifies it against GET /auth/me — tokens last 24h (see
 * api/app/config.py), so a stored one is frequently expired and trusting
 * it blindly would drop the user into the app only to 401 on first use.
 *
 * Every account signed in on this phone is remembered (auth/accounts.ts),
 * so `switchAccount` can change to another in one tap (Settings: tap your
 * name).
 */

import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  fetchCurrentUser,
  login as loginRequest,
  signup as signupRequest,
  updateProfile as updateProfileRequest,
  changePassword as changePasswordRequest,
  deleteAccount as deleteAccountRequest,
  removeAvatar,
  setAvatar,
} from '../api/auth';
import { ApiError } from '../api/client';
import { clearToken, loadToken, saveToken } from '../api/tokenStorage';
import { forgetAccount, rememberAccount, savedProfile, savedToken } from './accounts';
import { signInWithGoogle } from './googleSignIn';
import { removeText } from '../lib/fileStore';
import { readTokenSubject, tokenExpired } from '../lib/jwt';
import { removeItem } from '../lib/storage';
import type { Credentials, ProfileChanges, SignUpDetails, User } from '../types/auth';

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
  /**
   * The signed-in account's id, read from the token rather than from
   * GET /auth/me, so it is available the instant a token exists even if
   * that request is slow or fails. Anything stored per account keys off
   * this — see QuizContext.
   */
  userId: string | null;
  signIn: (credentials: Credentials) => Promise<void>;
  signUp: (details: SignUpDetails) => Promise<void>;
  signOut: () => Promise<void>;
  /** Sign in (or up) with Google; throws if it can't (see googleSignIn.ts). */
  signInWithGoogle: () => Promise<void>;
  /**
   * True right after Google made a new account, until they've looked at the
   * name and username it was given (see UsernamePrompt).
   */
  welcomeGoogleAccount: boolean;
  dismissGoogleWelcome: () => void;
  /** Change your username, name or email (Settings); throws the API's message. */
  updateProfile: (changes: ProfileChanges) => Promise<void>;
  /** Set your profile picture (a small JPEG, base64), or remove it with null. */
  changeAvatar: (base64: string | null) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Delete the account for good, clear what this phone kept for it, and sign out. */
  deleteAccount: (confirm: string, password?: string) => Promise<void>;
  /**
   * Change to another account signed in on this phone. Throws
   * AccountExpired when its sign-in has run out (sign in to it again).
   */
  switchAccount: (id: number) => Promise<void>;
};

/** A remembered account's sign-in has run out: it needs its password (or Google) again. */
export class AccountExpired extends Error {
  constructor() {
    super('Sign in to this account again');
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [welcomeGoogleAccount, setWelcomeGoogleAccount] = useState(false);
  const queryClient = useQueryClient();
  /** The token in use, for checks that finish after a switch. */
  const current = useRef<string | null>(null);

  /**
   * Checks an account entered from what the phone knew of it, behind the
   * scenes: brings its profile up to date, or, if the server no longer
   * takes its token (run out, or the account deleted), asks for a sign-in.
   * A connection problem changes nothing: the app carries on as it was.
   */
  const confirm = useCallback((stored: string) => {
    fetchCurrentUser(stored)
      .then((me) => {
        if (current.current !== stored) return;
        setUser(me);
        void rememberAccount(me, stored, false);
      })
      .catch(async (error: unknown) => {
        if (current.current !== stored) return;
        if (!(error instanceof ApiError && error.status === 401)) return;
        current.current = null;
        await clearToken();
        setToken(null);
        setUser(null);
        setStatus('signedOut');
      });
  }, []);

  /** An account the phone knows, entered at once (and checked behind, above). */
  const enterKnown = useCallback(
    (stored: string, profile: User) => {
      current.current = stored;
      setToken(stored);
      setUser(profile);
      setStatus('signedIn');
      confirm(stored);
    },
    [confirm],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await loadToken();
      if (cancelled) return;

      if (!stored) {
        setStatus('signedOut');
        return;
      }

      // Known to this phone and not run out: straight in, without waiting
      // on the server (a minute, when it's been asleep).
      const known = tokenExpired(stored) ? null : await savedProfile(Number(readTokenSubject(stored)));
      if (cancelled) return;
      if (known) {
        enterKnown(stored, known);
        return;
      }

      try {
        const me = await fetchCurrentUser(stored);
        if (cancelled) return;
        current.current = stored;
        setToken(stored);
        setUser(me);
        setStatus('signedIn');
        // Signed in before the switcher existed: list it too.
        void rememberAccount(me, stored, false);
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
  }, [enterKnown]);

  /**
   * Signup and login differ only in which endpoint issues the token, so
   * the "store it, then identify the user" half is shared.
   */
  const establishSession = useCallback(async (accessToken: string, google = false) => {
    // Possibly another account than the last (the switcher's "Add account"):
    // nothing of the last one's lingers.
    queryClient.clear();
    await saveToken(accessToken);
    current.current = accessToken;
    setToken(accessToken);

    try {
      const me = await fetchCurrentUser(accessToken);
      setUser(me);
      await rememberAccount(me, accessToken, google);
    } catch {
      // The token is valid — it was just issued — so a failure here is a
      // transient /auth/me problem. Enter the app anyway; the profile can
      // fill in later rather than blocking sign-in on it.
      setUser(null);
    }

    setStatus('signedIn');
  }, [queryClient]);

  const signIn = useCallback(
    async (credentials: Credentials) => {
      const { access_token } = await loginRequest(credentials);
      await establishSession(access_token);
    },
    [establishSession],
  );

  const signUp = useCallback(
    async (details: SignUpDetails) => {
      const { access_token } = await signupRequest(details);
      await establishSession(access_token);
    },
    [establishSession],
  );

  const googleSignIn = useCallback(async () => {
    const { access_token, created } = await signInWithGoogle();
    await establishSession(access_token, true);
    setWelcomeGoogleAccount(created);
  }, [establishSession]);

  const dismissGoogleWelcome = useCallback(() => setWelcomeGoogleAccount(false), []);

  const signOut = useCallback(async () => {
    // Signing out takes the account off this phone's switcher too.
    const id = readTokenSubject(token) ?? (user ? String(user.id) : null);
    if (id) await forgetAccount(Number(id));
    current.current = null;
    await clearToken();
    setToken(null);
    setUser(null);
    setWelcomeGoogleAccount(false);
    setStatus('signedOut');
  }, [token, user]);

  const switchAccount = useCallback(
    async (id: number) => {
      const stored = await savedToken(id);
      if (!stored || tokenExpired(stored)) throw new AccountExpired();
      // Nothing of the last account's lingers on screen: everything is
      // fetched again for this one (per-account data on the phone is
      // already kept by account).
      const known = await savedProfile(id);
      if (known) {
        // Straight across, without waiting on the server.
        queryClient.clear();
        await saveToken(stored);
        setWelcomeGoogleAccount(false);
        enterKnown(stored, known);
        return;
      }
      let me: User;
      try {
        me = await fetchCurrentUser(stored);
      } catch (error) {
        // Run out (or revoked); anything else is a connection problem.
        if (error instanceof ApiError && error.status === 401) throw new AccountExpired();
        throw error;
      }
      queryClient.clear();
      await saveToken(stored);
      current.current = stored;
      setToken(stored);
      setUser(me);
      setWelcomeGoogleAccount(false);
      setStatus('signedIn');
      void rememberAccount(me, stored, false);
    },
    [queryClient, enterKnown],
  );

  const updateProfile = useCallback(
    async (changes: ProfileChanges) => {
      if (!token) return;
      setUser(await updateProfileRequest(token, changes));
    },
    [token],
  );

  const changeAvatar = useCallback(
    async (base64: string | null) => {
      if (!token) return;
      setUser(base64 ? await setAvatar(token, base64) : await removeAvatar(token));
    },
    [token],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!token) return;
      await changePasswordRequest(token, currentPassword, newPassword);
    },
    [token],
  );

  const deleteAccount = useCallback(
    async (confirm: string, password?: string) => {
      if (!token) return;
      await deleteAccountRequest(token, confirm, password);
      // What this phone kept for the account (see TripsContext, QuizContext,
      // FriendWatcher, useFriendsBadge), so nothing of it lingers.
      const id = readTokenSubject(token) ?? (user ? String(user.id) : null);
      if (id) {
        await forgetAccount(Number(id));
        for (const key of ['trips', 'tripDeletes', 'tripDraft', 'friendsSeen', 'friendsViewed']) {
          removeText(`parkpath.${key}.${id}`);
        }
        await removeItem(`parkpath.quizAnswers.${id}`);
        await removeItem(`parkpath.quizPending.${id}`);
        await removeItem(`parkpath.snoozed.${id}`);
      }
      current.current = null;
      await clearToken();
      setToken(null);
      setUser(null);
      setWelcomeGoogleAccount(false);
      setStatus('signedOut');
    },
    [token, user],
  );

  // Prefer the token's own claim; fall back to the profile if a future
  // token shape ever stops carrying one.
  const userId = useMemo(
    () => readTokenSubject(token) ?? (user ? String(user.id) : null),
    [token, user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      token,
      userId,
      signIn,
      signUp,
      signOut,
      signInWithGoogle: googleSignIn,
      welcomeGoogleAccount,
      dismissGoogleWelcome,
      updateProfile,
      changeAvatar,
      changePassword,
      deleteAccount,
      switchAccount,
    }),
    [
      status,
      user,
      token,
      userId,
      signIn,
      signUp,
      signOut,
      googleSignIn,
      welcomeGoogleAccount,
      dismissGoogleWelcome,
      updateProfile,
      changeAvatar,
      changePassword,
      deleteAccount,
      switchAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside an <AuthProvider>');
  return value;
}
