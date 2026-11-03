// Pure URL helpers of the storefront edit-hint hand-off (no imports, so the
// node unit test can load them directly). See storefrontEditHint.ts.

export const EDIT_HINT_PARAM = 'ms_edit';

/** `href` with the hand-off fragment (an existing fragment is replaced). */
export function withEditHint(href: string, token: string): string {
  const url = new URL(href);
  url.hash = `${EDIT_HINT_PARAM}=${token}`;
  return url.toString();
}

/**
 * Whether `href` points at this creator's storefront: one of its hosts
 * (custom domain or any served market domain from `storefront_hosts`, each
 * with or without www, or the platform subdomain under ANY platform host)
 * or a platform host's `/store/<slug>` path (redirected to the subdomain,
 * fragment kept by the browser).
 *
 * `webOrigin` is the primary platform origin (port kept for dev);
 * `platformHosts` the extra hostnames the platform is served on during a
 * domain move (see platformHosts.ts), so a link to the old or the new
 * platform subdomain is recognised either way.
 */
export function isOwnStorefrontUrl(
  href: string,
  store: {
    slug: string;
    custom_domain?: string | null;
    public_host?: string | null;
    storefront_hosts?: string[] | null;
  },
  webOrigin: string,
  platformHosts: readonly string[] = [],
): boolean {
  let url: URL;
  let web: URL;
  try {
    url = new URL(href);
    web = new URL(webOrigin);
  } catch {
    return false;
  }
  const host = url.host.toLowerCase();
  const bare = host.replace(/^www\./, '');
  const own = [store.custom_domain, store.public_host, ...(store.storefront_hosts ?? [])];
  for (const h of own) {
    const known = h?.trim().toLowerCase().replace(/^www\./, '');
    if (known && bare === known) return true;
  }
  const slug = store.slug.toLowerCase();
  const isStorePath =
    url.pathname === `/store/${store.slug}` || url.pathname.startsWith(`/store/${store.slug}/`);
  // Primary origin: host with port (dev) — then every listed platform host.
  const platform = [web.host.toLowerCase(), ...platformHosts.map((h) => h.trim().toLowerCase())];
  const hostname = url.hostname.toLowerCase();
  for (const p of platform) {
    if (!p) continue;
    if (host === `${slug}.${p}` || hostname === `${slug}.${p}`) return true;
    if ((host === p || hostname === p) && isStorePath) return true;
  }
  return false;
}
