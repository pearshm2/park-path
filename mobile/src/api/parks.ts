/**
 * Park data access.
 *
 * Reads the bundled fixtures in src/data/parks.ts because the API has no
 * /parks route yet, and Dylan's NPS sync job (week 2) is what will
 * eventually supply this data for real. The functions are async and
 * shaped like network calls on purpose: when the endpoint lands, their
 * bodies change and nothing above them does.
 *
 * Scoring/ranking deliberately does NOT live here — see
 * src/api/provisionalMatches.ts and the banner at the top of it.
 */

import { NAMED_PARKS, SITES, type Site } from '../data/parks';

export type SiteScope = 'parks' | 'all';

/** All sites, or just the 63 named national parks. */
export async function listSites(scope: SiteScope = 'parks'): Promise<Site[]> {
  return scope === 'parks' ? NAMED_PARKS : SITES;
}
