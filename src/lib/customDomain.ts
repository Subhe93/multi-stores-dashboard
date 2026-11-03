// Helpers for the store's legacy external domain (Store.custom_domain).

export interface CustomDomainStore {
  slug: string;
  custom_domain?: string | null;
  /** Canonical public host from the API; may be the custom domain itself. */
  public_host?: string | null;
}

const norm = (host: string | null | undefined): string =>
  (host ?? '').trim().toLowerCase().replace(/\.$/, '');

/** `<slug>.<platform host>` built from the web origin (port kept for dev). */
export function platformSubdomainHost(slug: string, webOrigin: string): string {
  try {
    return `${slug}.${new URL(webOrigin).host}`;
  } catch {
    return `${slug}.localhost:3003`;
  }
}

/**
 * Host the storefront links fall back to once the custom domain is removed:
 * the Markets public host when it is a different host, else the platform
 * subdomain. A public host that is itself the store's platform subdomain
 * under ANY platform host (`platformHosts`, old or new apex during a domain
 * move) is not "different": the link then follows the primary web origin.
 */
export function domainRemovalFallbackHost(
  store: CustomDomainStore,
  webOrigin: string,
  platformHosts: readonly string[] = [],
): string {
  const publicHost = norm(store.public_host);
  if (
    publicHost &&
    publicHost !== norm(store.custom_domain) &&
    !isPlatformSubdomainHost(publicHost, store.slug, platformHosts)
  ) {
    return publicHost;
  }
  return platformSubdomainHost(store.slug, webOrigin);
}

/** `<slug>.<host>` for one of the given platform hostnames (no port)? */
export function isPlatformSubdomainHost(
  host: string,
  slug: string,
  platformHosts: readonly string[],
): boolean {
  const h = norm(host).split(':')[0];
  const s = slug.trim().toLowerCase();
  return platformHosts.some((p) => h === `${s}.${norm(p)}`);
}
