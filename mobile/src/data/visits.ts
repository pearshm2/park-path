/**
 * When you visited each site, and the trip each visit belongs to.
 *
 * PLACEHOLDER: there is no visits or trips backend yet (Trips is still a
 * Coming Soon screen), so there are no visits on record and nothing is
 * shown as visited. Fill these from the real visits once Trips logs them;
 * a visit is a site, a date and optionally the trip it was part of.
 */

export type Trip = { id: string; title: string };

type Visit = { siteId: string; date: string; tripId?: string };

const TRIPS: Trip[] = [];

const VISITS: Visit[] = [];

const TRIP_BY_ID = new Map(TRIPS.map((trip) => [trip.id, trip]));

/** What a card shows about your visits to a site. */
export type VisitSummary = {
  /** How many times you've been. */
  count: number;
  /** The latest visit, as YYYY-MM-DD. */
  last: string;
  /** The trip the latest visit was part of, if it was logged in one. */
  trip?: Trip;
};

/** Your visits to a site, latest first; undefined if there are none on record. */
export function visitSummary(siteId: string): VisitSummary | undefined {
  const visits = VISITS.filter((visit) => visit.siteId === siteId).sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  if (visits.length === 0) return undefined;
  const latest = visits[0];
  return {
    count: visits.length,
    last: latest.date,
    trip: latest.tripId ? TRIP_BY_ID.get(latest.tripId) : undefined,
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2024-06-12" -> "Jun 2024". */
export function visitMonth(date: string): string {
  const [year, month] = date.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
}
