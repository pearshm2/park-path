/**
 * A site's short facts, worded once for everywhere they show: the line on
 * its card and the facts on its park page. Only facts we have real data
 * for are given; camping, lodging, conditions and accessibility come later.
 */

import { colors } from '../theme';
import type { Site } from './parks';

export type FactRow = { label: string; value: string; color: string };

/** A plus in green, everything else plain. */
const YES = colors.accent2Ramp[700];
const PLAIN = colors.neutral[700];

const EFFORT = ['Easy', 'Moderate', 'Strenuous'];

/** Visitation is the closest thing the data has to a crowd signal. */
export function crowdLabel(visitsMillions: number): string {
  if (visitsMillions >= 4) return 'Very busy';
  if (visitsMillions >= 1.5) return 'Busy';
  if (visitsMillions >= 0.5) return 'Some company';
  return 'Quiet';
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function visitsLabel(millions: number): string {
  return millions >= 1 ? `${millions.toFixed(1)}M visits` : `${Math.round(millions * 1000)}K visits`;
}

/** "Spring & fall", "Summer", "Spring, summer & fall"; null with no data. */
export function seasonsLabel(site: Site): string | null {
  if (site.seasons.length === 0) return null;
  if (site.seasons.length === 4) return 'Any season';
  const names = site.seasons.map((season, i) => (i === 0 ? capitalise(season) : season));
  return names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/** "A day trip", "3 days"; null with no data. */
export function stayLabel(site: Site): string | null {
  if (site.days === null) return null;
  return site.days === 1 ? 'A day trip' : `${site.days} days`;
}

/**
 * Every fact for the park page. `referenceVisits` is Great Smoky Mountains'
 * annual visits, the busiest park, which puts crowding in proportion.
 */
export function factRows(site: Site, referenceVisits?: number): FactRow[] {
  const rows: FactRow[] = [];
  const seasons = seasonsLabel(site);
  if (seasons) rows.push({ label: 'Best time to go', value: seasons, color: YES });
  const stay = stayLabel(site);
  if (stay) rows.push({ label: 'Typical stay', value: stay, color: PLAIN });
  if (site.effort !== null) {
    rows.push({ label: 'Effort', value: EFFORT[site.effort - 1], color: PLAIN });
  }
  if (site.permit !== null) {
    rows.push({
      label: 'Permit or lottery',
      value: site.permit ? 'Needed for some areas' : 'None needed',
      color: site.permit ? PLAIN : YES,
    });
  }
  if (site.vis !== null) {
    rows.push({ label: 'Annual visits', value: visitsLabel(site.vis), color: PLAIN });
    rows.push({
      label: 'Average per day',
      value: `${Math.round((site.vis * 1_000_000) / 365).toLocaleString()} people`,
      color: PLAIN,
    });
    if (referenceVisits) {
      const share = (site.vis / referenceVisits) * 100;
      const crowd = crowdLabel(site.vis);
      rows.push({
        label: 'Crowding',
        value: `${crowd} · ${share < 1 ? 'under 1' : Math.round(share)}% of Smokies traffic`,
        color: crowd === 'Quiet' ? YES : PLAIN,
      });
    }
  }
  rows.push({ label: 'Designation', value: site.kind, color: PLAIN });
  return rows;
}
