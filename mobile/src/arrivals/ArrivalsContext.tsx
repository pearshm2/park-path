/**
 * Arrival reminders: while the app is open, notice when you've arrived at
 * a national park and nudge you to log the visit ("You've arrived at Zion.
 * Don't forget to document your trip...").
 *
 * Opt-in, from Settings, and only with location permission "while using
 * the app": nothing runs in the background. Your location stays on the
 * phone; the parks' outlines (GET /sites/boundaries, ~160 KB) are fetched
 * once and checked here. A park nudges at most once a day.
 *
 * The nudge is an in-app banner (ArrivalBanner) rather than a system
 * notification, which needs background location and more setup than
 * "while the app is open" calls for.
 */

import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
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
import { AppState } from 'react-native';

import { request } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { getItem, setItem } from '../lib/storage';

type Boundary = { park_code: string; bbox: [number, number, number, number]; rings: number[][][] };

type Permission = 'unknown' | 'granted' | 'denied';

type ArrivalsValue = {
  /** Reminders switched on (in Settings). */
  enabled: boolean;
  permission: Permission;
  /** Turning on asks for location permission; resolves false if refused. */
  setEnabled: (on: boolean) => Promise<boolean>;
  /** The park you've just arrived at, while its banner is showing. */
  arrival: string | null;
  dismiss: () => void;
};

const ArrivalsContext = createContext<ArrivalsValue | null>(null);

const ENABLED_KEY = 'parkpath.arrivalReminders';
const NUDGED_KEY = 'parkpath.arrivalNudges';

/** Today as YYYY-MM-DD, local time. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Even-odd test: is [lon, lat] inside these rings (holes cancel out)? */
function inside(point: [number, number], rings: number[][][]): boolean {
  const [x, y] = point;
  let result = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) result = !result;
    }
  }
  return result;
}

/** The park at a point, if any: the bounding box rules most out first. */
function parkAt(point: [number, number], boundaries: Boundary[]): string | null {
  const [lon, lat] = point;
  for (const b of boundaries) {
    const [minLon, minLat, maxLon, maxLat] = b.bbox;
    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
    if (inside(point, b.rings)) return b.park_code;
  }
  return null;
}

export function ArrivalsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [enabled, setEnabledState] = useState(false);
  const [permission, setPermission] = useState<Permission>('unknown');
  const [arrival, setArrival] = useState<string | null>(null);
  const [active, setActive] = useState(AppState.currentState === 'active');
  /** The park you were last seen in, so only entering one nudges. */
  const lastPark = useRef<string | null>(null);

  // The saved switch, and whether permission is (still) granted.
  useEffect(() => {
    (async () => {
      const [stored, current] = await Promise.all([
        getItem(ENABLED_KEY),
        Location.getForegroundPermissionsAsync(),
      ]);
      setPermission(current.granted ? 'granted' : current.canAskAgain ? 'unknown' : 'denied');
      setEnabledState(stored === 'true' && current.granted);
    })().catch(() => {});
  }, []);

  // Only while the app is on screen.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);

  const watching = enabled && permission === 'granted' && active && status === 'signedIn';

  const { data: boundaries } = useQuery({
    queryKey: ['boundaries'],
    queryFn: () => request<Boundary[]>('/sites/boundaries'),
    enabled: watching,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!watching || !boundaries) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      // A new fix every few hundred metres or couple of minutes is plenty
      // to notice a park, and easy on the battery.
      const watch = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 300, timeInterval: 120_000 },
        async (fix) => {
          const park = parkAt([fix.coords.longitude, fix.coords.latitude], boundaries);
          const entered = park !== null && park !== lastPark.current;
          lastPark.current = park;
          if (!entered) return;
          // At most once a day per park.
          const nudged = JSON.parse((await getItem(NUDGED_KEY)) ?? '{}') as Record<string, string>;
          if (nudged[park] === today()) return;
          await setItem(NUDGED_KEY, JSON.stringify({ ...nudged, [park]: today() }));
          setArrival(park);
        },
      );
      if (cancelled) watch.remove();
      else subscription = watch;
    })().catch(() => {});

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [watching, boundaries]);

  const setEnabled = useCallback(async (on: boolean) => {
    if (!on) {
      setEnabledState(false);
      setArrival(null);
      await setItem(ENABLED_KEY, 'false');
      return true;
    }
    const result = await Location.requestForegroundPermissionsAsync();
    setPermission(result.granted ? 'granted' : 'denied');
    setEnabledState(result.granted);
    await setItem(ENABLED_KEY, result.granted ? 'true' : 'false');
    return result.granted;
  }, []);

  const dismiss = useCallback(() => setArrival(null), []);

  const value = useMemo<ArrivalsValue>(
    () => ({ enabled, permission, setEnabled, arrival, dismiss }),
    [enabled, permission, setEnabled, arrival, dismiss],
  );

  return <ArrivalsContext.Provider value={value}>{children}</ArrivalsContext.Provider>;
}

export function useArrivals(): ArrivalsValue {
  const value = useContext(ArrivalsContext);
  if (!value) throw new Error('useArrivals must be used inside an <ArrivalsProvider>');
  return value;
}
