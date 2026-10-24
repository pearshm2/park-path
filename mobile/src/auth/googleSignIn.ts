/**
 * Google sign-in — the single integration point.
 *
 * Signs in with Google on the phone (Google's own account picker, from
 * @react-native-google-signin/google-signin), then trades the ID token
 * Google gives us for a ParkPath token at POST /auth/google, which signs
 * in, links an account with the same email, or makes a new one.
 *
 * What it needs before it works:
 *
 *   1. OAuth client ids from Google Cloud (APIs & Services -> Credentials):
 *        - a Web client, whose id goes in EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
 *          (Android signs in for it, and it's what the token is issued for)
 *        - an Android client, made with the app's package name and its
 *          signing key's SHA-1 (EAS shows it); nothing to copy back
 *        - for iPhones, an iOS client, whose id goes in
 *          EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (app.config.js turns it into
 *          the URL scheme the plugin needs)
 *      The server needs the web and iOS ids too, in GOOGLE_CLIENT_IDS.
 *
 *   2. A development build: Google sign-in is native code, which Expo Go
 *      doesn't include. In Expo Go the button says so instead.
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';

import { googleSignIn as googleSignInRequest } from '../api/auth';
import type { GoogleTokenResponse } from '../types/auth';

/** Thrown when Google sign-in can't run here; the message says why. */
export class GoogleSignInUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleSignInUnavailableError';
  }
}

/** Set in mobile/.env. Empty until a Google Cloud client exists. */
export const GOOGLE_WEB_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();
const GOOGLE_IOS_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '').trim();

export const isGoogleSignInConfigured = GOOGLE_WEB_CLIENT_ID.length > 0;

/** Expo Go has no Google sign-in in it; a development build does. */
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Thrown when the person backs out of Google's account picker. */
export class GoogleSignInCancelled extends Error {
  constructor() {
    super('Google sign-in was cancelled.');
    this.name = 'GoogleSignInCancelled';
  }
}

let configured = false;

/**
 * Signs in with Google and returns a ParkPath token, and whether this
 * made a new account.
 */
export async function signInWithGoogle(): Promise<GoogleTokenResponse> {
  if (inExpoGo) {
    throw new GoogleSignInUnavailableError(
      "Google sign-in works in the installed ParkPath app, not in Expo Go. Use your email and password here.",
    );
  }
  if (!isGoogleSignInConfigured) {
    throw new GoogleSignInUnavailableError('Google sign-in is not set up yet. Use your email and password for now.');
  }

  // Loaded only here: the native module doesn't exist in Expo Go.
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = await import(
    '@react-native-google-signin/google-signin'
  );
  if (!configured) {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      ...(GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
    });
    configured = true;
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) throw new GoogleSignInCancelled();
    const idToken = response.data.idToken;
    if (!idToken) throw new Error('Google sent no ID token.');
    return await googleSignInRequest(idToken);
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) throw new GoogleSignInCancelled();
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new GoogleSignInUnavailableError('Google Play services are needed to sign in with Google on this phone.');
      }
    }
    throw error;
  } finally {
    // Signs out of Google in the app (not ParkPath), so the account
    // picker shows again next time instead of reusing the last choice.
    GoogleSignin.signOut().catch(() => {});
  }
}
