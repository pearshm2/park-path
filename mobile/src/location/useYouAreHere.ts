/**
 * Where the phone is, for the "you are here" star on a park's map.
 *
 * Asks for location permission the first time a park map opens (the
 * prompt's wording is in app.json's expo-location plugin), then follows
 * the phone while the map is on screen. If the person says no, the maps
 * work as before, just without the star.
 */

import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export type YouAreHere = {
  /** [longitude, latitude], or null until there is a fix. */
  point: [number, number] | null;
  /** 'denied' also covers location being switched off on the phone. */
  status: 'asking' | 'granted' | 'denied';
};

export function useYouAreHere(): YouAreHere {
  const [point, setPoint] = useState<[number, number] | null>(null);
  const [status, setStatus] = useState<YouAreHere['status']>('asking');

  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      setStatus(granted ? 'granted' : 'denied');
      if (!granted) return;
      // Walking pace: a new fix every 20 m is plenty for a park map.
      const watch = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 20 },
        (fix) => setPoint([fix.coords.longitude, fix.coords.latitude]),
      );
      if (cancelled) watch.remove();
      else subscription = watch;
    })().catch(() => {
      if (!cancelled) setStatus('denied');
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return { point, status };
}
