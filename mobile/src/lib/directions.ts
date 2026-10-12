/**
 * The Google Maps directions handoff (week 5): a link that opens Google
 * Maps with the route to a site from wherever the phone is.
 *
 * Uses Google's cross-platform Maps URL, which opens the Google Maps app
 * when it's installed and google.com/maps in the browser when it isn't,
 * on both iOS and Android, with no API key.
 *
 * The destination is the site's full name rather than its coordinates:
 * NPS coordinates are a point in the middle of the park, often far from
 * any road (Denali's is in the backcountry), while Google resolves the
 * park's name to the place itself and routes to its main entrance.
 */

import { Linking } from 'react-native';

import type { Site } from '../data/parks';

/** "Zion" + "National Park" -> "Zion National Park"; "Blue Ridge Parkway" stays as is. */
function fullName(site: Site): string {
  return site.name.endsWith(site.kind) ? site.name : `${site.name} ${site.kind}`;
}

export function directionsUrl(site: Site): string {
  // Multi-state sites read "TN / NC", the state holding the site's point
  // first; that one is enough to tell Google which place is meant.
  const state = site.state.split(' / ')[0];
  const destination = encodeURIComponent(state ? `${fullName(site)}, ${state}` : fullName(site));
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

/** Opens directions to the site. Resolves false if nothing could open the link. */
export async function openDirections(site: Site): Promise<boolean> {
  try {
    await Linking.openURL(directionsUrl(site));
    return true;
  } catch {
    return false;
  }
}
