/**
 * Your trip journal: one entry per visit to a park, with a title, notes,
 * photos and who was with you. Logging an entry is what marks a park
 * visited, so the map's visited pins and region stamps, the cards' Visited
 * stamp and the Visits view all come from here.
 *
 * Kept on the device for now, per account (like the quiz answers), until
 * the trips backend exists (Sebastian, week 5): then `add` and `remove`
 * call the API and photos upload, and nothing above this file changes.
 * Photos are copied into the app's own documents folder, since the
 * picker's copies can be cleared by the phone.
 */

import { Directory, File, Paths } from 'expo-file-system';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '../auth/AuthContext';
import { getItem, setItem } from '../lib/storage';

export type TripEntry = {
  id: string;
  siteId: string;
  /** The month of the visit, as YYYY-MM-01. */
  date: string;
  title: string;
  notes: string;
  /** Photo file URIs in the app's documents folder. */
  photos: string[];
  /** Friends who were there: their ids and, so the entry reads the same
   *  if they're later removed, their emails as they were. */
  with: { id: number; email: string }[];
  createdAt: string;
};

export type TripDraft = Omit<TripEntry, 'id' | 'createdAt'>;

/** What a park's card shows about your visits to it. */
export type VisitSummary = {
  count: number;
  /** The latest visit, as YYYY-MM-DD. */
  last: string;
  /** The entry for the latest visit. */
  entry: TripEntry;
};

type TripsValue = {
  entries: TripEntry[];
  /** Parks with at least one entry. */
  visitedIds: Set<string>;
  visitSummary: (siteId: string) => VisitSummary | undefined;
  add: (draft: TripDraft) => Promise<TripEntry>;
  remove: (id: string) => Promise<void>;
};

const TripsContext = createContext<TripsValue | null>(null);

function storageKey(userId: string): string {
  return `parkpath.trips.${userId}`;
}

/** Stored JSON is untrusted: anything that isn't an entry is dropped. */
function parse(raw: string | null): TripEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is TripEntry =>
        !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.siteId === 'string',
    );
  } catch {
    return [];
  }
}

/** Copy picked photos into the app's documents folder; returns their new URIs. */
function keepPhotos(uris: string[]): string[] {
  if (uris.length === 0) return [];
  const folder = new Directory(Paths.document, 'trip-photos');
  folder.create({ idempotent: true, intermediates: true });
  return uris.map((uri, i) => {
    const extension = uri.split('?')[0].split('.').pop()?.toLowerCase() || 'jpg';
    const target = new File(folder, `${Date.now()}-${i}.${extension}`);
    new File(uri).copySync(target);
    return target.uri;
  });
}

function deletePhotos(uris: string[]) {
  for (const uri of uris) {
    try {
      new File(uri).delete();
    } catch {
      // Already gone; nothing to do.
    }
  }
}

/** Newest visit first, then newest entry. */
function byVisit(a: TripEntry, b: TripEntry): number {
  return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
}

export function TripsProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [loaded, setLoaded] = useState<{ userId: string; entries: TripEntry[] } | null>(null);
  const entries = useMemo(
    () => (loaded && loaded.userId === userId ? loaded.entries : []),
    [loaded, userId],
  );

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const stored = parse(await getItem(storageKey(userId)));
      if (!cancelled) setLoaded({ userId, entries: stored.sort(byVisit) });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const save = useCallback(
    async (next: TripEntry[]) => {
      if (!userId) return;
      setLoaded({ userId, entries: next });
      await setItem(storageKey(userId), JSON.stringify(next));
    },
    [userId],
  );

  const add = useCallback(
    async (draft: TripDraft) => {
      const entry: TripEntry = {
        ...draft,
        id: `trip-${Date.now()}`,
        photos: keepPhotos(draft.photos),
        createdAt: new Date().toISOString(),
      };
      await save([entry, ...entries].sort(byVisit));
      return entry;
    },
    [entries, save],
  );

  const remove = useCallback(
    async (id: string) => {
      const entry = entries.find((e) => e.id === id);
      if (entry) deletePhotos(entry.photos);
      await save(entries.filter((e) => e.id !== id));
    },
    [entries, save],
  );

  const visitedIds = useMemo(() => new Set(entries.map((e) => e.siteId)), [entries]);

  const visitSummary = useCallback(
    (siteId: string): VisitSummary | undefined => {
      // Entries are kept newest first, so the first one is the latest visit.
      const visits = entries.filter((e) => e.siteId === siteId);
      if (visits.length === 0) return undefined;
      return { count: visits.length, last: visits[0].date, entry: visits[0] };
    },
    [entries],
  );

  const value = useMemo<TripsValue>(
    () => ({ entries, visitedIds, visitSummary, add, remove }),
    [entries, visitedIds, visitSummary, add, remove],
  );

  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>;
}

export function useTrips(): TripsValue {
  const value = useContext(TripsContext);
  if (!value) throw new Error('useTrips must be used inside a <TripsProvider>');
  return value;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2024-06-01" -> "Jun 2024". */
export function monthLabel(date: string): string {
  const [year, month] = date.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
}
