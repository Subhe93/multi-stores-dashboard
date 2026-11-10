import { api } from '@/lib/api';

/**
 * Storefront "Edit" button hand-off. The creator's "visit store" links open
 * the storefront with `#ms_edit=<token>`; the storefront keeps the token
 * and, for this browser only, shows a floating button that opens the
 * dashboard page editing what is on screen. The token (POST
 * /stores/my/edit-hint-token, valid 30 days) grants no API access.
 *
 * A URL fragment, not a query parameter: it never reaches the storefront
 * server, its logs or cache, nor a Referer header. URL helpers live in
 * storefrontEditHintUrl.ts.
 */

const STORAGE_PREFIX = 'ms_edit_hint_token:';
/** Re-issue once less than this is left of the 30-day token. */
const RENEW_BEFORE_MS = 7 * 24 * 60 * 60 * 1000;

interface CachedHint {
  token: string;
  /** Epoch ms when the token expires. */
  exp: number;
}

/** After a failed request, wait this long before asking again. */
const RETRY_AFTER_MS = 60 * 1000;

const memory = new Map<string, CachedHint>();
let inflight: Promise<void> | null = null;
let lastFailureAt = 0;

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function readCached(userId: string): CachedHint | null {
  const hit = memory.get(userId);
  if (hit) return hit;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedHint>;
    if (typeof parsed.token !== 'string' || typeof parsed.exp !== 'number') return null;
    const value = { token: parsed.token, exp: parsed.exp };
    memory.set(userId, value);
    return value;
  } catch {
    return null;
  }
}

/** The cached, still-valid token for this user, synchronously (or null). */
export function cachedEditHintToken(userId: string): string | null {
  const hit = readCached(userId);
  return hit && hit.exp > Date.now() ? hit.token : null;
}

/**
 * Fetches a token when none is cached or the cached one is close to expiry.
 * Called lazily (hovering / focusing a store link), at most one request at
 * a time; failures are silent (the link then opens without the hand-off).
 */
export function prefetchEditHintToken(userId: string, authToken: string): void {
  const hit = readCached(userId);
  if (hit && hit.exp - Date.now() > RENEW_BEFORE_MS) return;
  if (inflight || Date.now() - lastFailureAt < RETRY_AFTER_MS) return;
  inflight = requestEditHintToken(userId, authToken);
}

/**
 * A valid token, fetched when none is cached (DRAFT product preview: the
 * storefront serves the draft only with the hand-off, so the caller waits
 * for it). Shares the in-flight request with the prefetch; null when the
 * API refused or is unreachable (after a failure the prefetch backs off,
 * this call retries right away).
 */
export async function ensureEditHintToken(userId: string, authToken: string): Promise<string | null> {
  const cached = cachedEditHintToken(userId);
  if (cached) return cached;
  if (!inflight) inflight = requestEditHintToken(userId, authToken);
  await inflight;
  return cachedEditHintToken(userId);
}

function requestEditHintToken(userId: string, authToken: string): Promise<void> {
  return api<{ token: string; expires_in: number }>('/stores/my/edit-hint-token', {
    method: 'POST',
    token: authToken,
  })
    .then(({ token, expires_in }) => {
      const value = { token, exp: Date.now() + expires_in * 1000 };
      memory.set(userId, value);
      try {
        window.localStorage.setItem(storageKey(userId), JSON.stringify(value));
      } catch {
        /* storage unavailable: memory only */
      }
    })
    .catch(() => {
      // No hand-off this time; links open the plain URL.
      lastFailureAt = Date.now();
    })
    .finally(() => {
      inflight = null;
    });
}
