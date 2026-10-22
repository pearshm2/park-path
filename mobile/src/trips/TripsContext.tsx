/**
 * Your trip journal: one entry per visit to a park, with a title, notes,
 * photos and who was with you. Logging an entry is what marks a park
 * visited, so the map's visited pins and region stamps, the cards' Visited
 * stamp and the Visits view all come from here.
 *
 * Kept on the device for now, per account (like the quiz answers), until
 * the trips backend exists (Sebastian, week 5): then `add` and `remove`
 * call the API and photos upload, and nothing above this file changes.
 * Photos and videos are copied into the app's own documents folder, since
 * the picker's copies can be cleared by the phone.
 *
 * Entries saved before captions, videos and several trails existed are
 * read in the current shape: their photos with blank captions, their one
 * trail as a list of one.
 */

import { Directory, File, Paths } from 'expo-file-system';
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

import { useAuth } from '../auth/AuthContext';
import { getItem, removeItem, setItem } from '../lib/storage';

export type TripEntry = {
  id: string;
  siteId: string;
  /** The day of the visit, as YYYY-MM-DD. (Entries logged before exact
   *  dates were asked for have the first of the month.) */
  date: string;
  title: string;
  notes: string;
  /** Photos and videos, in order, each with its own caption. */
  media: TripMedia[];
  /** Friends who were there: their ids and, so the entry reads the same
   *  if they're later removed, their emails as they were. */
  with: { id: number; email: string }[];
  /** How it was, 1 to 5 stars; null if not rated. */
  rating: number | null;
  /** Trails or spots they loved, shown on the entry and in friends' feeds. */
  trails: string[];
  createdAt: string;
};

/** A photo or video in an entry. */
export type TripMedia = {
  /** A file in the app's documents folder (or, for the samples, a web link). */
  uri: string;
  kind: 'photo' | 'video';
  /** Words shown over it in Relive; may be empty. */
  caption: string;
  /** A video's length in ms, when known. */
  duration?: number;
};

/** The photo to show for an entry: its first photo, skipping videos. */
export function leadPhoto(entry: Pick<TripEntry, 'media'>): string | null {
  return entry.media.find((m) => m.kind === 'photo')?.uri ?? null;
}

export type TripDraft = Omit<TripEntry, 'id' | 'createdAt'>;

/**
 * A new entry that was started but not saved, kept so closing the sheet
 * by accident doesn't lose what was typed. Its media are the picker's
 * URIs, not yet copied into the app's folder.
 */
export type EntryDraft = {
  siteId: string | null;
  date: string;
  title: string;
  notes: string;
  rating: number | null;
  trails: string[];
  withIds: number[];
  media: TripMedia[];
  /** When it was last changed, as an ISO timestamp. */
  savedAt: string;
};

/** How long an untouched draft is kept. */
const DRAFT_DAYS = 7;

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
  /** Replace an entry's details, keeping its id and when it was made. */
  update: (id: string, draft: TripDraft) => Promise<TripEntry | undefined>;
  /** Add ready-made entries as they are (the sample trips): their photos
   *  are left where they are rather than copied. */
  addEntries: (entries: TripEntry[]) => Promise<void>;
  /** The unsaved new entry, if there is one. */
  getDraft: () => EntryDraft | null;
  /** Keep a draft, or pass null to drop it. Not state: typing in the
   *  sheet doesn't re-render everything that reads trips. */
  setDraft: (draft: EntryDraft | null) => void;
};

const TripsContext = createContext<TripsValue | null>(null);

function storageKey(userId: string): string {
  return `parkpath.trips.${userId}`;
}

function draftKey(userId: string): string {
  return `parkpath.tripDraft.${userId}`;
}

/** A stored draft, if it's still recent enough to keep. */
function parseDraft(raw: string | null): EntryDraft | null {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as EntryDraft & OldShape;
    if (!draft || typeof draft.savedAt !== 'string' || typeof draft.date !== 'string') return null;
    const age = Date.now() - new Date(draft.savedAt).getTime();
    if (age >= DRAFT_DAYS * 24 * 60 * 60 * 1000) return null;
    // Drafts kept before captions and several trails.
    const { photos, stamp, ...rest } = draft;
    return {
      ...rest,
      media: draft.media ?? (photos ?? []).map(asPhoto),
      trails: draft.trails ?? (stamp?.trim() ? [stamp.trim()] : []),
    };
  } catch {
    return null;
  }
}

/** What entries and drafts held before media and trails replaced these. */
type OldShape = { photos?: string[]; stamp?: string | null };

function asPhoto(uri: string): TripMedia {
  return { uri, kind: 'photo', caption: '' };
}

/** Stored JSON is untrusted: anything that isn't an entry is dropped. */
function parse(raw: string | null): TripEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is TripEntry & OldShape =>
          !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.siteId === 'string',
      )
      .map(({ photos, stamp, ...e }) => ({
        ...e,
        // Saved before ratings existed.
        rating: e.rating ?? null,
        // Saved before captions and videos: photos, captions blank.
        media: e.media ?? (photos ?? []).map(asPhoto),
        // Saved with one trail, or none.
        trails: e.trails ?? (stamp ? [stamp] : []),
      }));
  } catch {
    return [];
  }
}

/** Web links (the samples' park photos) are used where they are. */
function isWeb(uri: string): boolean {
  return /^https?:/.test(uri);
}

/** Copy a picked photo or video into the app's documents folder; returns its new URI. */
function keepFile(uri: string, i: number): string {
  const folder = new Directory(Paths.document, 'trip-photos');
  folder.create({ idempotent: true, intermediates: true });
  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase() || 'jpg';
  const target = new File(folder, `${Date.now()}-${i}.${extension}`);
  new File(uri).copySync(target);
  return target.uri;
}

/**
 * The media to save: ones already the entry's (or on the web) stay where
 * they are; newly picked ones are copied in.
 */
function keepMedia(media: TripMedia[], already: TripMedia[] = []): TripMedia[] {
  const owned = new Set(already.map((m) => m.uri));
  return media.map((m, i) => (owned.has(m.uri) || isWeb(m.uri) ? m : { ...m, uri: keepFile(m.uri, i) }));
}

function deleteMedia(media: TripMedia[]) {
  for (const m of media) {
    if (isWeb(m.uri)) continue;
    try {
      new File(m.uri).delete();
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

  const draft = useRef<{ userId: string; value: EntryDraft | null } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const stored = parse(await getItem(storageKey(userId)));
      if (!cancelled) setLoaded({ userId, entries: stored.sort(byVisit) });
      const storedDraft = parseDraft(await getItem(draftKey(userId)));
      // Unless the sheet already wrote a newer one while this loaded.
      if (!cancelled && draft.current?.userId !== userId) {
        draft.current = { userId, value: storedDraft };
      }
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
        media: keepMedia(draft.media),
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
      if (entry) deleteMedia(entry.media);
      await save(entries.filter((e) => e.id !== id));
    },
    [entries, save],
  );

  const update = useCallback(
    async (id: string, draft: TripDraft) => {
      const old = entries.find((e) => e.id === id);
      if (!old) return undefined;
      // Media already in the entry stay as they are (their captions may have
      // changed); newly picked ones are copied in, and ones taken out of the
      // entry are deleted.
      const media = keepMedia(draft.media, old.media);
      const stillThere = new Set(draft.media.map((m) => m.uri));
      deleteMedia(old.media.filter((m) => !stillThere.has(m.uri)));
      const entry: TripEntry = { ...old, ...draft, media };
      await save(entries.map((e) => (e.id === id ? entry : e)).sort(byVisit));
      return entry;
    },
    [entries, save],
  );

  const addEntries = useCallback(
    async (more: TripEntry[]) => {
      const ids = new Set(entries.map((e) => e.id));
      await save([...entries, ...more.filter((e) => !ids.has(e.id))].sort(byVisit));
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

  const getDraft = useCallback(
    () => (draft.current && draft.current.userId === userId ? draft.current.value : null),
    [userId],
  );

  const setDraft = useCallback(
    (next: EntryDraft | null) => {
      if (!userId) return;
      draft.current = { userId, value: next };
      if (next) void setItem(draftKey(userId), JSON.stringify(next));
      else void removeItem(draftKey(userId));
    },
    [userId],
  );

  const value = useMemo<TripsValue>(
    () => ({ entries, visitedIds, visitSummary, add, remove, update, addEntries, getDraft, setDraft }),
    [entries, visitedIds, visitSummary, add, remove, update, addEntries, getDraft, setDraft],
  );

  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>;
}

export function useTrips(): TripsValue {
  const value = useContext(TripsContext);
  if (!value) throw new Error('useTrips must be used inside a <TripsProvider>');
  return value;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2024-06-12" -> "Jun 12, 2024". */
export function dateLabel(date: string): string {
  const [year, month, day] = date.split('-');
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
}

/** "2024-06-12" -> "Jun 2024". */
export function monthLabel(date: string): string {
  const [year, month] = date.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
}
