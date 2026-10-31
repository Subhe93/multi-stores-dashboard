// Pure helpers for the one-click (magic link) login page. Kept free of React
// and browser globals so they can be unit-tested with node:test.

/** Dashboard home per role. CUSTOMER (and unknown roles) have no dashboard home. */
const ROLE_HOMES: Record<string, string> = {
  ADMIN: '/admin',
  PROVIDER: '/provider',
  CREATOR: '/creator',
};

/** Dashboard landing path for a role, or null when the role has no dashboard. */
export function roleHomePath(role: string | null | undefined): string | null {
  if (!role || !Object.prototype.hasOwnProperty.call(ROLE_HOMES, role)) return null;
  return ROLE_HOMES[role];
}

// The API issues 32 random bytes as base64url (43 chars). Accept a sane
// base64url range so a mangled or hostile value never reaches the API.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,200}$/;

/**
 * Reads and validates the magic token. Current emails carry it in the URL
 * fragment (`#token=`, never sent to the server, so it stays out of access
 * logs); links mailed before that carry it in the query (`?token=`).
 */
export function readMagicToken(search: string, hash = ''): string | null {
  const raw =
    new URLSearchParams(hash.replace(/^#/, '')).get('token') ||
    new URLSearchParams(search).get('token');
  if (!raw) return null;
  const token = raw.trim();
  return TOKEN_PATTERN.test(token) ? token : null;
}

/** True when the URL carries a token in its query or fragment. */
export function hasMagicToken(search: string, hash = ''): boolean {
  return (
    new URLSearchParams(search).has('token') ||
    new URLSearchParams(hash.replace(/^#/, '')).has('token')
  );
}

/**
 * Returns the given path + search + hash with the `token` parameter removed
 * from both the query and the fragment, so the single-use secret does not
 * stay in the address bar or history.
 */
export function stripMagicToken(pathname: string, search: string, hash = ''): string {
  const params = new URLSearchParams(search);
  params.delete('token');
  const rest = params.toString();
  const fragmentParams = new URLSearchParams(hash.replace(/^#/, ''));
  let fragment = hash;
  if (fragmentParams.has('token')) {
    fragmentParams.delete('token');
    const restHash = fragmentParams.toString();
    fragment = restHash ? `#${restHash}` : '';
  }
  return `${pathname}${rest ? `?${rest}` : ''}${fragment}`;
}

export type MagicFailure = 'invalid' | 'network' | 'error';

/** Maps an error thrown by the magic-login request to a UI failure kind. */
export function classifyMagicError(err: unknown): MagicFailure {
  // fetch() rejects with a TypeError when the API is unreachable.
  if (err instanceof TypeError) return 'network';
  const e = err as { status?: number; code?: string } | null;
  if (e?.code === 'MAGIC_LINK_INVALID' || e?.status === 401 || e?.status === 400) return 'invalid';
  return 'error';
}
