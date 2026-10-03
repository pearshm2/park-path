/**
 * Thin fetch wrapper around the ParkPath API.
 *
 * Everything the app sends goes through here so the base URL, the JSON
 * headers, the bearer token and FastAPI's error shape are handled once.
 */

import { Platform } from 'react-native';

/**
 * FastAPI returns errors as `{"detail": ...}`. For a plain HTTPException
 * that is a string; for a 422 validation failure it is an array of
 * per-field objects. Both are handled in `readDetail` below.
 */
type FastApiValidationItem = {
  loc?: (string | number)[];
  msg?: string;
};

/**
 * An HTTP error from the API, carrying the status code so callers can
 * branch on it — the auth screens distinguish 401 from 409, for example.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** The request never reached the server (offline, wrong host, DNS). */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Resolved from EXPO_PUBLIC_API_URL in mobile/.env. Expo inlines any
 * EXPO_PUBLIC_* variable at build time, so this is a literal by the time
 * it runs — changing .env needs a dev-server restart to take effect.
 */
function resolveBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  // Running in a browser on the same machine as the API, localhost is
  // almost always right, so default to it rather than hard-failing.
  if (Platform.OS === 'web') return 'http://localhost:8000';

  // On a phone, localhost means the phone itself — there is no sensible
  // guess, so say exactly what to do instead of failing obscurely later.
  throw new Error(
    'EXPO_PUBLIC_API_URL is not set in mobile/.env. A physical device ' +
      "cannot reach localhost, so set it to your computer's LAN address " +
      '(e.g. http://192.168.1.20:8000) and restart the dev server.',
  );
}

export const API_BASE_URL = resolveBaseUrl();

function readDetail(body: unknown, fallback: string): string {
  if (typeof body !== 'object' || body === null) return fallback;
  const detail = (body as { detail?: unknown }).detail;

  if (typeof detail === 'string') return detail;

  // 422 from Pydantic: surface the first field message, which is the one
  // the person can act on ("value is not a valid email address").
  if (Array.isArray(detail)) {
    const first = detail[0] as FastApiValidationItem | undefined;
    if (first?.msg) {
      const field = first.loc?.filter((p) => p !== 'body').join('.');
      return field ? `${field}: ${first.msg}` : first.msg;
    }
  }

  return fallback;
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Sent as `Authorization: Bearer <token>`. */
  token?: string | null;
  signal?: AbortSignal;
};

/**
 * Performs a request and returns the parsed JSON body.
 *
 * Throws {@link ApiError} for any non-2xx response and
 * {@link NetworkError} if the request never completed.
 */
export async function request<T>(
  path: string,
  { method = 'GET', body, token, signal }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    // An aborted request is the caller's own doing — let it through as-is
    // rather than reporting it as a connectivity problem.
    if (cause instanceof Error && cause.name === 'AbortError') throw cause;
    throw new NetworkError(
      `Could not reach the ParkPath API at ${API_BASE_URL}. ` +
        'Check that it is running and that EXPO_PUBLIC_API_URL points at it.',
    );
  }

  // 204 and friends have no body to parse.
  const raw = response.status === 204 ? null : await response.text();
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      // A non-JSON body means something other than the API answered —
      // a proxy or an error page. Keep a snippet for the message.
      if (!response.ok) {
        throw new ApiError(response.status, raw.slice(0, 200));
      }
    }
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      readDetail(parsed, `Request failed (${response.status})`),
    );
  }

  return parsed as T;
}
