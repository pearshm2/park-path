/**
 * Your trip journal: one entry per visit to a park, with a title, notes,
 * photos and who was with you. Logging an entry is what marks a park
 * visited, so the map's visited pins and region stamps, the cards' Visited
 * stamp and the Visits view all come from here.
 *
 * Saved on the server (api/trips.ts), with a copy on the phone so Trips
 * opens at once and works without a signal. Every change is made on the
 * phone at once (never waiting on the network), then sent; one request at
 * a time, in order. Anything that
 * couldn't be sent (no signal, or the API asleep) is marked and sent on the
 * next sync: when the app opens, comes back to the front, or changes a trip.
 * A sync then fetches the server's trips, so ones logged or deleted on
 * another phone show up here too. Trips saved before the server existed
 * are sent up the first time.
 *
 * Photos and videos are copied into the app's own documents folder (the
 * picker's copies can be cleared by the phone), then uploaded to S3 as part
 * of the sync, before the trip is sent with their keys, so friends see
 * them too. An upload that can't happen now (no bucket on the server, no
 * signal) is tried again on the next sync; one the server or S3 turns down
 * (too big, an unknown type) stays on the phone only. Trips logged before
 * uploads existed send their photos on the next sync. The passport-stamp
 * photo stays on the phone: the server has nowhere to keep it yet.
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

import { AppState } from 'react-native';

import { ApiError } from '../api/client';
import type { Person } from '../api/friends';
import {
  contentTypeFor,
  createTrip,
  deleteTrip,
  fetchTrips,
  requestUpload,
  sendUpload,
  updateTrip,
  type TripFields,
  type TripOut,
  type Visibility,
} from '../api/trips';
import { useAuth } from '../auth/AuthContext';
import { readText, removeText, writeText } from '../lib/fileStore';
import { cleanFeedback, type FeedbackTag } from './feedback';

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
  with: Person[];
  /** How it was, 1 to 5 stars; null if not rated. */
  rating: number | null;
  /** Trails or spots they loved, shown on the entry and in friends' feeds. */
  trails: string[];
  /** How it went (trips/feedback.ts): tunes their picks, and shows on the trip. */
  feedback: FeedbackTag[];
  /** Who can see it. New trips from the app are always shared with friends;
   *  older ones may still be private. */
  visibility: Visibility;
  /**
   * A photo of the park's official stamp in a Passport To Your National
   * Parks book: the souvenir of being there in person. A file on the
   * phone, or a link to the server's copy (from another phone). Null if
   * none. Uploaded during sync like the photos, so friends see it too.
   */
  passportStamp: string | null;
  /** The stamp photo's storage key on the server, once uploaded. */
  stampKey?: string;
  /** The stamp photo couldn't be uploaded: kept on this phone only. */
  stampLocalOnly?: true;
  createdAt: string;
  /** Its id on the server, once it's been sent. */
  serverId?: number;
  /** The park the server has it under, to notice a change of park. */
  serverPark?: string;
  /** Changed on the phone and not yet sent. */
  unsent?: boolean;
  /** Why the server turned it down; not retried until it's edited. */
  syncError?: string;
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
  /** Its storage key on the server, once uploaded (or when it came from the server). */
  key?: string;
  /** The server or S3 turned the upload down: kept on this phone only, not retried. */
  localOnly?: true;
};

/** A photo or video still to be uploaded: a file on this phone with no key yet. */
function needsUpload(media: TripMedia): boolean {
  return !media.key && !media.localOnly && !isWeb(media.uri);
}

/** A passport-stamp photo still to be uploaded. */
function stampNeedsUpload(entry: TripEntry): boolean {
  return !!entry.passportStamp && !entry.stampKey && !entry.stampLocalOnly && !isWeb(entry.passportStamp);
}

/** The photo to show for an entry: its first photo, skipping videos. */
export function leadPhoto(entry: Pick<TripEntry, 'media'>): string | null {
  return entry.media.find((m) => m.kind === 'photo')?.uri ?? null;
}

/** What the entry sheet fills in. */
export type TripDraft = Pick<
  TripEntry,
  | 'siteId'
  | 'date'
  | 'title'
  | 'notes'
  | 'media'
  | 'with'
  | 'rating'
  | 'trails'
  | 'feedback'
  | 'visibility'
  | 'passportStamp'
>;

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
  feedback: FeedbackTag[];
  withIds: number[];
  media: TripMedia[];
  visibility: Visibility;
  passportStamp: string | null;
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
  /** Trips changed on the phone and not yet on the server. */
  unsentCount: number;
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

/** Server ids of trips deleted on the phone, not yet deleted on the server. */
function deletesKey(userId: string): string {
  return `parkpath.tripDeletes.${userId}`;
}

function draftKey(userId: string): string {
  return `parkpath.tripDraft.${userId}`;
}

/** Stored server ids awaiting deletion; anything else is dropped. */
function parseDeletes(raw: string | null): number[] {
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : [];
  } catch {
    return [];
  }
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
      visibility: draft.visibility ?? 'friends',
      passportStamp: draft.passportStamp ?? null,
      feedback: cleanFeedback(draft.feedback),
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
        // Saved before trips could be shared.
        visibility: e.visibility ?? 'friends',
        // Saved before passport stamps.
        passportStamp: e.passportStamp ?? null,
        // Saved before feedback tags.
        feedback: cleanFeedback(e.feedback),
        // Saved before the server: send it.
        unsent: e.unsent ?? e.serverId == null,
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

function deleteFile(uri: string) {
  if (isWeb(uri)) return;
  try {
    new File(uri).delete();
  } catch {
    // Already gone; nothing to do.
  }
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

/**
 * The trip's photos as the server takes them: the uploaded ones, in order.
 * Undefined while any of its media is a web link with no key (a sample
 * trip, or one fetched before keys were kept), so the server's list is
 * left alone rather than cut down to what this phone can name.
 */
function photosFor(entry: TripEntry): TripFields['photos'] {
  if (entry.media.some((m) => isWeb(m.uri) && !m.key)) return undefined;
  return entry.media.flatMap((m) =>
    m.key
      ? [
          {
            key: m.key,
            caption: m.caption.slice(0, 500),
            duration_ms: m.duration != null ? Math.round(m.duration) : null,
          },
        ]
      : [],
  );
}

/**
 * The stamp photo as the server takes it: its key, or null for none.
 * Undefined while it's only on this phone, so the server's is left alone.
 */
function stampFor(entry: TripEntry): string | null | undefined {
  if (!entry.passportStamp) return null;
  return entry.stampKey;
}

/** A trip as the server takes it. */
function toFields(entry: TripEntry): TripFields {
  return {
    photos: photosFor(entry),
    stamp_photo_key: stampFor(entry),
    park_code: entry.siteId,
    visited_on: entry.date,
    title: entry.title.slice(0, 200),
    notes: entry.notes,
    rating: entry.rating,
    trails: entry.trails.map((t) => t.slice(0, 200)).slice(0, 20),
    feedback: cleanFeedback(entry.feedback),
    stamp: entry.trails[0]?.slice(0, 200) ?? null,
    visibility: entry.visibility,
    companion_ids: entry.with.map((p) => p.id),
  };
}

/** A trip's photos as the server has them, with fresh links. */
function serverMedia(trip: TripOut): TripMedia[] {
  return trip.photos.flatMap((p) =>
    p.url
      ? [
          {
            uri: p.url,
            kind: p.kind,
            caption: p.caption,
            key: p.key,
            ...(p.duration_ms != null ? { duration: p.duration_ms } : {}),
          },
        ]
      : [],
  );
}

/** The server's copy of a trip, over the phone's (whose extras it keeps). */
function fromServer(trip: TripOut, local?: TripEntry): TripEntry {
  // Links to the server's photos expire, so ones this phone shows from the
  // server get fresh links on every sync.
  const freshUrl = new Map(trip.photos.flatMap((p) => (p.url ? [[p.key, p.url] as const] : [])));
  return {
    id: local?.id ?? `trip-server-${trip.id}`,
    siteId: trip.park_code,
    date: trip.visited_on,
    title: trip.title,
    notes: trip.notes,
    rating: trip.rating,
    // An older server has only `stamp`.
    trails: trip.trails ?? (trip.stamp ? [trip.stamp] : []),
    // An older server has none: keep the phone's.
    feedback: trip.feedback ? cleanFeedback(trip.feedback) : (local?.feedback ?? []),
    visibility: trip.visibility,
    with: trip.companions,
    ...stampFromServer(trip, local),
    // Photos stay as the phone has them; a trip new to this phone shows the
    // server's (links that expire; fetched fresh on each sync).
    media: local
      ? [
          ...local.media.map((m) =>
            m.key && isWeb(m.uri) ? { ...m, uri: freshUrl.get(m.key) ?? m.uri } : m,
          ),
          // Photos added on another phone since this one last saw the trip.
          // (Kept, too, so editing it here doesn't remove them from the server.)
          ...serverMedia(trip).filter((m) => !local.media.some((own) => own.key === m.key)),
        ]
      : serverMedia(trip),
    createdAt: local?.createdAt ?? trip.created_at,
    serverId: trip.id,
    serverPark: trip.park_code,
  };
}

/**
 * The stamp photo: this phone's file while it's the one the server has (or
 * isn't sent yet), else the server's (a link that expires, fresh each sync).
 */
function stampFromServer(
  trip: TripOut,
  local?: TripEntry,
): Pick<TripEntry, 'passportStamp' | 'stampKey' | 'stampLocalOnly'> {
  const own = local?.passportStamp ?? null;
  const ownStamp = { passportStamp: own, stampKey: local?.stampKey, stampLocalOnly: local?.stampLocalOnly };
  // An older server without stamp photos, or a stamp this phone hasn't sent.
  if (trip.stamp_photo === undefined || (own && !local?.stampKey)) return ownStamp;
  const server = trip.stamp_photo;
  if (!server) {
    // Taken off on another phone.
    if (own) deleteFile(own);
    return { passportStamp: null };
  }
  if (own && local?.stampKey === server.key && !isWeb(own)) return ownStamp;
  if (!server.url) return ownStamp;
  // New from another phone (or a fresh link for one already shown from the server).
  if (own && local?.stampKey !== server.key) deleteFile(own);
  return { passportStamp: server.url, stampKey: server.key };
}

/** A request that failed for want of a connection, not because it was refused. */
function offline(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status === 401 || error.status >= 500;
}

/** Newest visit first, then newest entry. */
function byVisit(a: TripEntry, b: TripEntry): number {
  return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
}

export function TripsProvider({ children }: { children: ReactNode }) {
  const { userId, token } = useAuth();
  const [loaded, setLoaded] = useState<{ userId: string; entries: TripEntry[] } | null>(null);
  const entries = useMemo(
    () => (loaded && loaded.userId === userId ? loaded.entries : []),
    [loaded, userId],
  );

  const draft = useRef<{ userId: string; value: EntryDraft | null } | null>(null);

  // The latest entries and pending deletes, for the sync, which runs after
  // the render that started it.
  const latest = useRef<{ userId: string; entries: TripEntry[]; deletes: number[] } | null>(null);
  // Changes and syncs run one after another, never side by side.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = queue.current.then(job, job);
    queue.current = run.catch(() => undefined);
    return run;
  }

  /** Change the entries (and pending deletes) for this account, and keep them. */
  const commit = useCallback(
    async (change: (current: { entries: TripEntry[]; deletes: number[] }) => {
      entries: TripEntry[];
      deletes: number[];
    }) => {
      const current = latest.current;
      if (!userId || !current || current.userId !== userId) return;
      const next = change(current);
      const sorted = next.entries.slice().sort(byVisit);
      latest.current = { userId, entries: sorted, deletes: next.deletes };
      setLoaded({ userId, entries: sorted });
      // Kept on the phone, in files (lib/fileStore.ts).
      writeText(storageKey(userId), JSON.stringify(sorted));
      writeText(deletesKey(userId), JSON.stringify(next.deletes));
    },
    [userId],
  );

  /**
   * Change an entry's media where it's kept (matched by file, so a caption
   * edited meanwhile isn't lost); returns the entry as it now is.
   */
  const setMedia = useCallback(
    async (entry: TripEntry, change: (media: TripMedia) => TripMedia): Promise<TripEntry> => {
      const changed = new Map(entry.media.map((m) => [m.uri, change(m)]));
      await commit((c) => ({
        ...c,
        entries: c.entries.map((e) =>
          e.id === entry.id
            ? {
                ...e,
                media: e.media.map((m) => {
                  const next = changed.get(m.uri);
                  return next ? { ...m, key: next.key, localOnly: next.localOnly } : m;
                }),
              }
            : e,
        ),
      }));
      return latest.current?.entries.find((e) => e.id === entry.id) ?? entry;
    },
    [commit],
  );

  /**
   * Upload an entry's photos and videos that aren't on the server yet, one
   * at a time, keeping each key as soon as it's up. `storageOff`: the
   * server has no bucket, so later entries needn't try.
   */
  const uploadMedia = useCallback(
    async (token: string, entry: TripEntry): Promise<{ entry: TripEntry; storageOff: boolean }> => {
      let current = entry;
      for (const media of entry.media.filter(needsUpload)) {
        const contentType = contentTypeFor(media.uri);
        let size: number | null = null;
        try {
          size = new File(media.uri).size;
        } catch {
          size = null;
        }
        if (!contentType || !size) {
          // Gone from the phone, or a type the server won't take.
          current = await setMedia(current, (m) => (m.uri === media.uri ? { ...m, localOnly: true } : m));
          continue;
        }
        try {
          const upload = await requestUpload(token, contentType, size);
          await sendUpload(upload, media.uri, contentType);
          current = await setMedia(current, (m) => (m.uri === media.uri ? { ...m, key: upload.key } : m));
        } catch (error) {
          if (error instanceof ApiError && error.status === 503) {
            return { entry: current, storageOff: true };
          }
          if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401) {
            // Too big, or refused: keep it on the phone only.
            current = await setMedia(current, (m) => (m.uri === media.uri ? { ...m, localOnly: true } : m));
            continue;
          }
          // No signal, or a hiccup: the next sync tries again.
          return { entry: current, storageOff: false };
        }
      }
      return { entry: current, storageOff: false };
    },
    [setMedia],
  );

  /**
   * Change an entry's stamp-photo upload state where it's kept, if the
   * stamp is still the same file; returns the entry as it now is.
   */
  const setStamp = useCallback(
    async (entry: TripEntry, change: Pick<TripEntry, 'stampKey' | 'stampLocalOnly'>): Promise<TripEntry> => {
      await commit((c) => ({
        ...c,
        entries: c.entries.map((e) =>
          e.id === entry.id && e.passportStamp === entry.passportStamp ? { ...e, ...change } : e,
        ),
      }));
      return latest.current?.entries.find((e) => e.id === entry.id) ?? entry;
    },
    [commit],
  );

  /** Upload an entry's passport-stamp photo, as uploadMedia does a photo. */
  const uploadStamp = useCallback(
    async (token: string, entry: TripEntry): Promise<{ entry: TripEntry; storageOff: boolean }> => {
      const uri = entry.passportStamp!;
      const contentType = contentTypeFor(uri);
      let size: number | null = null;
      try {
        size = new File(uri).size;
      } catch {
        size = null;
      }
      if (!contentType || contentType.startsWith('video/') || !size) {
        // Gone from the phone, or a type the server won't take.
        return { entry: await setStamp(entry, { stampLocalOnly: true }), storageOff: false };
      }
      try {
        const upload = await requestUpload(token, contentType, size);
        await sendUpload(upload, uri, contentType);
        return { entry: await setStamp(entry, { stampKey: upload.key }), storageOff: false };
      } catch (error) {
        if (error instanceof ApiError && error.status === 503) return { entry, storageOff: true };
        if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401) {
          // Too big, or refused: keep it on the phone only.
          return { entry: await setStamp(entry, { stampLocalOnly: true }), storageOff: false };
        }
        // No signal, or a hiccup: the next sync tries again.
        return { entry, storageOff: false };
      }
    },
    [setStamp],
  );

  /**
   * Send what's waiting, then take the server's trips. Stops quietly when
   * offline; whatever's left goes next time.
   */
  const sync = useCallback(async () => {
    if (!userId || !token) return;
    const mine = () => latest.current && latest.current.userId === userId;
    if (!mine()) return;
    try {
      // Deletes.
      for (const serverId of latest.current!.deletes) {
        try {
          await deleteTrip(token, serverId);
        } catch (error) {
          // Already gone is as good as deleted.
          if (!(error instanceof ApiError && error.status === 404)) throw error;
        }
        await commit((c) => ({ ...c, deletes: c.deletes.filter((id) => id !== serverId) }));
      }

      // Trips changed on the phone, and ones with photos still to upload.
      const waiting = latest.current!.entries.filter(
        (e) => !e.syncError && (e.unsent || e.media.some(needsUpload) || stampNeedsUpload(e)),
      );
      let storageOff = false;
      for (const waitingEntry of waiting) {
        let entry = waitingEntry;
        let saved: TripOut;
        try {
          // Moving parks deletes the old trip, and its photos with it, so
          // they're uploaded again for the new one.
          const moving = entry.serverId != null && entry.serverPark !== entry.siteId;
          if (moving && entry.media.some((m) => m.key && !isWeb(m.uri))) {
            entry = await setMedia(entry, (m) => (isWeb(m.uri) ? m : { ...m, key: undefined }));
          }
          if (moving && entry.stampKey && entry.passportStamp && !isWeb(entry.passportStamp)) {
            entry = await setStamp(entry, { stampKey: undefined });
          }
          if (!storageOff && entry.media.some(needsUpload)) {
            const uploaded = await uploadMedia(token, entry);
            storageOff = uploaded.storageOff;
            entry = uploaded.entry;
          }
          if (!storageOff && stampNeedsUpload(entry)) {
            const uploaded = await uploadStamp(token, entry);
            storageOff = uploaded.storageOff;
            entry = uploaded.entry;
          }
          if (entry.serverId != null && entry.serverPark === entry.siteId) {
            try {
              saved = await updateTrip(token, entry.serverId, toFields(entry));
            } catch (error) {
              // Deleted on another phone meanwhile: log it again.
              if (!(error instanceof ApiError && error.status === 404)) throw error;
              saved = await createTrip(token, toFields(entry));
            }
          } else {
            // New, or moved to another park (which the server can't do in place).
            if (entry.serverId != null) {
              await deleteTrip(token, entry.serverId).catch((error) => {
                if (!(error instanceof ApiError && error.status === 404)) throw error;
              });
            }
            saved = await createTrip(token, toFields(entry));
          }
        } catch (error) {
          if (offline(error)) throw error;
          // Refused (a friend removed since, say): keep it on the phone with
          // the reason, and don't retry until it's edited.
          const reason = error instanceof Error ? error.message : 'Not saved';
          await commit((c) => ({
            ...c,
            entries: c.entries.map((e) => (e.id === entry.id ? { ...e, syncError: reason } : e)),
          }));
          continue;
        }
        // Deleted on the phone while this was sending: delete it there too.
        if (!latest.current?.entries.some((e) => e.id === entry.id)) {
          await commit((c) => ({ ...c, deletes: [...c.deletes, saved.id] }));
          continue;
        }
        await commit((c) => ({
          ...c,
          entries: c.entries.map((e) =>
            e.id === entry.id
              ? {
                  ...e,
                  serverId: saved.id,
                  serverPark: saved.park_code,
                  // Edited again while this was sending: still waiting.
                  unsent: e !== entry && e.unsent ? true : undefined,
                  syncError: undefined,
                }
              : e,
          ),
        }));
      }

      // The server's trips: new ones from other phones in, deleted ones out.
      const server = await fetchTrips(token);
      if (!mine()) return;
      await commit((c) => {
        const byServerId = new Map(server.map((t) => [t.id, t]));
        const known = new Set<number>();
        const next: TripEntry[] = [];
        for (const e of c.entries) {
          if (e.serverId == null) {
            next.push(e);
            continue;
          }
          known.add(e.serverId);
          const remote = byServerId.get(e.serverId);
          if (e.unsent || e.syncError) next.push(e);
          else if (remote) next.push(fromServer(remote, e));
          // Gone from the server and not changed here: deleted on another phone.
          else deleteMedia(e.media);
        }
        for (const t of server) {
          if (!known.has(t.id) && !c.deletes.includes(t.id)) next.push(fromServer(t));
        }
        return { ...c, entries: next };
      });
    } catch {
      // Offline, or the API asleep: try again next time.
    }
  }, [userId, token, commit, setMedia, uploadMedia, setStamp, uploadStamp]);

  const syncSoon = useCallback(() => {
    void enqueue(sync);
  }, [sync]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const stored = parse(await readText(storageKey(userId)));
      const deletes = parseDeletes(await readText(deletesKey(userId)));
      if (cancelled) return;
      const sorted = stored.sort(byVisit);
      latest.current = { userId, entries: sorted, deletes };
      setLoaded({ userId, entries: sorted });
      const storedDraft = parseDraft(await readText(draftKey(userId)));
      // Unless the sheet already wrote a newer one while this loaded.
      if (!cancelled && draft.current?.userId !== userId) {
        draft.current = { userId, value: storedDraft };
      }
      if (!cancelled) syncSoon();
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, syncSoon]);

  // Back in the app: catch up.
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncSoon();
    });
    return () => listener.remove();
  }, [syncSoon]);

  const add = useCallback(
    (draft: TripDraft) =>
      (async () => {
        const entry: TripEntry = {
          ...draft,
          id: `trip-${Date.now()}`,
          media: keepMedia(draft.media),
          passportStamp: draft.passportStamp ? keepFile(draft.passportStamp, 99) : null,
          createdAt: new Date().toISOString(),
          unsent: true,
        };
        await commit((c) => ({ ...c, entries: [entry, ...c.entries] }));
        syncSoon();
        return entry;
      })(),
    [commit, syncSoon],
  );

  const remove = useCallback(
    (id: string) =>
      (async () => {
        const entry = latest.current?.entries.find((e) => e.id === id);
        if (!entry) return;
        deleteMedia(entry.media);
        if (entry.passportStamp) deleteFile(entry.passportStamp);
        await commit((c) => ({
          entries: c.entries.filter((e) => e.id !== id),
          deletes: entry.serverId != null ? [...c.deletes, entry.serverId] : c.deletes,
        }));
        syncSoon();
      })(),
    [commit, syncSoon],
  );

  const update = useCallback(
    (id: string, draft: TripDraft) =>
      (async () => {
        const old = latest.current?.entries.find((e) => e.id === id);
        if (!old) return undefined;
        // Media already in the entry stay as they are (their captions may have
        // changed); newly picked ones are copied in, and ones taken out of the
        // entry are deleted.
        const media = keepMedia(draft.media, old.media);
        const stillThere = new Set(draft.media.map((m) => m.uri));
        deleteMedia(old.media.filter((m) => !stillThere.has(m.uri)));
        // The passport stamp: kept, replaced, or taken off.
        let passportStamp = draft.passportStamp;
        let stamp = { stampKey: old.stampKey, stampLocalOnly: old.stampLocalOnly };
        if (passportStamp !== old.passportStamp) {
          if (old.passportStamp) deleteFile(old.passportStamp);
          if (passportStamp) passportStamp = keepFile(passportStamp, 99);
          // A new photo goes up on the next sync; the server then drops the old one.
          stamp = { stampKey: undefined, stampLocalOnly: undefined };
        }
        // Edited: send it again, even if it was refused before.
        const entry: TripEntry = {
          ...old,
          ...draft,
          media,
          passportStamp,
          ...stamp,
          unsent: true,
          syncError: undefined,
        };
        await commit((c) => ({ ...c, entries: c.entries.map((e) => (e.id === id ? entry : e)) }));
        syncSoon();
        return entry;
      })(),
    [commit, syncSoon],
  );

  const addEntries = useCallback(
    (more: TripEntry[]) =>
      (async () => {
        await commit((c) => {
          const ids = new Set(c.entries.map((e) => e.id));
          return { ...c, entries: [...c.entries, ...more.filter((e) => !ids.has(e.id))] };
        });
        syncSoon();
      })(),
    [commit, syncSoon],
  );

  const unsentCount = useMemo(() => entries.filter((e) => e.unsent).length, [entries]);

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
      if (next) writeText(draftKey(userId), JSON.stringify(next));
      else removeText(draftKey(userId));
    },
    [userId],
  );

  const value = useMemo<TripsValue>(
    () => ({
      entries,
      visitedIds,
      visitSummary,
      unsentCount,
      add,
      remove,
      update,
      addEntries,
      getDraft,
      setDraft,
    }),
    [entries, visitedIds, visitSummary, unsentCount, add, remove, update, addEntries, getDraft, setDraft],
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
