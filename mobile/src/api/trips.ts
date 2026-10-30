/**
 * The trip journal, against api/app/routers/trips.py. Every call needs a
 * token.
 *
 * The server keeps a trip's park, date, title, notes, rating, trails,
 * feedback tags, who
 * was there and who can see it (always friends, from the app), and its
 * photos and videos with their captions, and a photo of the park's
 * passport stamp. Those go to S3 by a signed upload
 * (requestUpload, then sendUpload, below); trips/TripsContext.tsx uploads
 * them as part of each sync.
 */

import { File, UploadType } from 'expo-file-system';

import { ApiError, request } from './client';
import type { components } from './schema';

/** Generated from the API; see src/api/schema.ts. */
export type TripOut = components['schemas']['TripOut'];
export type Visibility = components['schemas']['Visibility'];
/** A photo or video on a trip, as sent: its storage key and caption. */
export type TripPhotoIn = components['schemas']['TripPhotoIn'];
/** A signed form for uploading one photo or video straight to S3. */
export type PhotoUpload = components['schemas']['PhotoUploadOut'];

/** What the app sends to create or change a trip. */
export type TripFields = {
  park_code: string;
  visited_on: string;
  title: string;
  notes: string;
  rating: number | null;
  trails: string[];
  /**
   * The first trail, for a server from before `trails` (Render until this
   * backend is deployed); a newer one ignores it when `trails` is sent.
   */
  stamp: string | null;
  /** How it went: feedback tags, at most one of each pair (trips/feedback.ts). */
  feedback: NonNullable<components['schemas']['TripCreate']['feedback']>;
  visibility: Visibility;
  companion_ids: number[];
  /**
   * The trip's uploaded photos and videos, in order. Undefined leaves the
   * server's as they are (sent only when the phone knows the full list).
   */
  photos?: TripPhotoIn[];
  /**
   * The passport-stamp photo's storage key, or null for none. Undefined
   * leaves the server's as it is (the phone's isn't uploaded yet).
   */
  stamp_photo_key?: string | null;
};

/** GET /trips — my trips, newest visit first. */
export function fetchTrips(token: string): Promise<TripOut[]> {
  return request<TripOut[]>('/trips', { token });
}

/** POST /trips — log a visit. */
export function createTrip(token: string, fields: TripFields): Promise<TripOut> {
  return request<TripOut>('/trips', {
    method: 'POST',
    token,
    body: { ...fields, photos: fields.photos ?? [] },
  });
}

/**
 * PATCH /trips/{id} — change a trip. The server can't move a trip to
 * another park, so the park isn't sent (moving one means deleting it and
 * creating it again). Photos are sent only when `fields.photos` is set;
 * the server then keeps exactly those, deleting any others from S3.
 */
export function updateTrip(token: string, id: number, fields: TripFields): Promise<TripOut> {
  return request<TripOut>(`/trips/${id}`, {
    method: 'PATCH',
    token,
    body: {
      visited_on: fields.visited_on,
      title: fields.title,
      notes: fields.notes,
      rating: fields.rating,
      trails: fields.trails,
      stamp: fields.stamp,
      feedback: fields.feedback,
      visibility: fields.visibility,
      companion_ids: fields.companion_ids,
      ...(fields.photos ? { photos: fields.photos } : {}),
      ...(fields.stamp_photo_key !== undefined ? { stamp_photo_key: fields.stamp_photo_key } : {}),
    },
  });
}

/**
 * POST /trips/photos/upload-url — permission to upload one photo or video.
 * 503 means the server has no bucket set up; 422, a type or size it won't take.
 */
export function requestUpload(
  token: string,
  contentType: PhotoContentType,
  sizeBytes: number,
): Promise<PhotoUpload> {
  return request<PhotoUpload>('/trips/photos/upload-url', {
    method: 'POST',
    token,
    body: { content_type: contentType, size_bytes: sizeBytes },
  });
}

/** The types the server takes, by file extension. */
const CONTENT_TYPES: Record<string, PhotoContentType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};

export type PhotoContentType = components['schemas']['PhotoUploadRequest']['content_type'];

/** The upload type for a file, from its extension; undefined if the server won't take it. */
export function contentTypeFor(uri: string): PhotoContentType | undefined {
  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES[extension];
}

/**
 * Send a file to S3 with the signed form: a multipart POST of the form's
 * fields, then the file as the part named `file` (S3 needs it last). Done
 * natively by expo-file-system, which streams the file from disk: Expo's
 * `fetch` can't send a file from a path inside FormData ("Unsupported
 * FormDataPart implementation"). Throws an ApiError with S3's status if S3
 * turns it down, or a plain Error if there's no connection.
 */
export async function sendUpload(upload: PhotoUpload, uri: string, contentType: string): Promise<void> {
  const result = await new File(uri).upload(upload.upload_url, {
    httpMethod: 'POST',
    uploadType: UploadType.MULTIPART,
    fieldName: 'file',
    mimeType: contentType,
    parameters: upload.fields,
  });
  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(result.status, `S3 refused the upload (${result.status})`);
  }
}

/** DELETE /trips/{id}. */
export async function deleteTrip(token: string, id: number): Promise<void> {
  await request<null>(`/trips/${id}`, { method: 'DELETE', token });
}

/**
 * GET /trips/feed — the trips your friends shared with friends, newest
 * posted first. Page further back with `before` (an entry id).
 */
export function fetchFeed(token: string, before?: number): Promise<TripOut[]> {
  return request<TripOut[]>(`/trips/feed?limit=30${before ? `&before=${before}` : ''}`, { token });
}
