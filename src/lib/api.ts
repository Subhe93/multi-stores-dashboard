// Exported so non-JSON requests (CSV downloads) can reuse the same base URL.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

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

export async function api<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

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
