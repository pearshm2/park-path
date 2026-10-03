/**
 * Key/value persistence that works on both native and web.
 *
 * expo-secure-store is backed by the iOS keychain and Android keystore
 * and is not implemented on web — importing it there resolves, but every
 * call rejects. Since the demo runs in a browser, web uses localStorage.
 *
 * Every accessor can fail (Safari private mode, blocked site data, a
 * corrupt keychain entry), so reads return null rather than throwing and
 * writes fail quietly. Callers must render correctly with nothing stored.
 *
 * Note the asymmetry in what that means: on native, values sit in the
 * platform's secure storage; on web, localStorage is readable by any
 * script on the origin. That is fine for development and for a browser
 * demo, but a shipped web build should move the access token to an
 * httpOnly cookie issued by the API rather than keeping a bearer token
 * in JS-reachable storage.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

function webStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export async function getItem(key: string): Promise<string | null> {
  if (isWeb) return webStorage()?.getItem(key) ?? null;
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    webStorage()?.setItem(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Nothing useful to do — the app must work unpersisted.
  }
}

export async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    webStorage()?.removeItem(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Already gone.
  }
}
