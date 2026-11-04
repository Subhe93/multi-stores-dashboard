// Exported so non-JSON requests (CSV downloads) can reuse the same base URL.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
// Origin of the API host for files it serves (`/uploads/...`). Anchored strip of
// the `/api` SUFFIX only: a host such as api.shopsdoor.com contains "api" too.
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

interface FetchOptions extends RequestInit {
  token?: string;
}

/** Error thrown by `api()` for non-2xx responses; carries the HTTP status and validation details. */
export class ApiError extends Error {
  status?: number;
  errors?: string[];
  code?: string;
  /** Raw error body for codes that carry extra fields (e.g. `observed` DNS records). */
  payload?: Record<string, unknown>;
}

/**
 * Window event fired for every ApiError that carries a code, so global UI
 * (e.g. the "verify your email" dialog) can react without every call site
 * handling the code itself. Detail: the ApiError.
 */
export const API_ERROR_EVENT = 'ms-api-error';

/** localStorage keys: the access token, and the refresh token of sessions
 *  signed in before the httpOnly cookie (read once, then dropped). */
export const ACCESS_TOKEN_KEY = 'auth_token';
export const LEGACY_REFRESH_KEY = 'refresh_token';

/** Window event with the new access token after a silent refresh (detail). */
export const AUTH_TOKEN_EVENT = 'ms-auth-token';

/**
 * Auth routes run with the httpOnly refresh cookie: the API keeps the
 * refresh token in a cookie scoped to /api/auth (only for this dashboard's
 * origin) instead of the JSON body, so page scripts never see it.
 */
function isAuthRoute(endpoint: string): boolean {
  return endpoint.startsWith('/auth/');
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

let refreshing: Promise<string | null> | null = null;

/**
 * New access token from the refresh cookie (or a legacy stored refresh
 * token). One request at a time: parallel 401s share it. Resolves null when
 * the session is gone.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const store = storage();
    const legacy = store?.getItem(LEGACY_REFRESH_KEY) ?? null;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Cookie': '1' },
        body: JSON.stringify(legacy ? { refresh_token: legacy } : {}),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: { access_token?: string; refresh_token?: string } };
      const access = json.data?.access_token;
      if (!access) return null;
      store?.setItem(ACCESS_TOKEN_KEY, access);
      // The API now keeps the refresh token in the cookie.
      if (json.data?.refresh_token) store?.setItem(LEGACY_REFRESH_KEY, json.data.refresh_token);
      else store?.removeItem(LEGACY_REFRESH_KEY);
      window.dispatchEvent(new CustomEvent<string>(AUTH_TOKEN_EVENT, { detail: access }));
      return access;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  return request<T>(endpoint, options, true);
}

async function request<T>(endpoint: string, options: FetchOptions, mayRefresh: boolean): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const auth = isAuthRoute(endpoint);
  if (auth) headers['X-Auth-Cookie'] = '1';

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
    ...(auth ? { credentials: 'include' as const } : {}),
  });

  // Expired access token: refresh once through the cookie and retry.
  if (res.status === 401 && token && mayRefresh && endpoint !== '/auth/refresh' && endpoint !== '/auth/logout') {
    const fresh = await refreshAccessToken();
    if (fresh) return request<T>(endpoint, { ...options, token: fresh }, false);
  }

  // 204 No Content (e.g. DELETE routes) has no body: resolve with `undefined`
  // instead of failing on `res.json()`.
  if (res.status === 204) return undefined as T;

  const json = await res.json();

  if (!res.ok) {
    const err = new ApiError(
      Array.isArray(json.message) ? json.message.join(' · ') : (json.message || 'API request failed')
    );
    err.status = res.status;
    err.errors = Array.isArray(json.message) ? json.message : undefined;
    // Stable machine-readable error code (when the API provides one). The UI can
    // translate `errors.<code>`, falling back to the English `message` above.
    err.code = typeof json.code === 'string' ? json.code : undefined;
    err.payload = json && typeof json === 'object' ? json : undefined;
    if (err.code && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<ApiError>(API_ERROR_EVENT, { detail: err }));
    }
    throw err;
  }

  return json.data;
}
