// The platform's own hostnames (domain-move overlap, plans/domain-move/PLAN.md).
// Pure (no imports) so the node unit test can load it directly.
//
// During the move from the old apex to the new one both apexes serve the
// platform side by side, so anything that asks "is this host ours?" checks
// this LIST, while everything that GENERATES a link keeps following the
// single primary NEXT_PUBLIC_WEB_URL (storefrontBaseUrl, platformSubdomainHost).
//
// The list = the host of NEXT_PUBLIC_WEB_URL (bare and `www.` forms, primary
// first) + every entry of NEXT_PUBLIC_PLATFORM_HOSTS (comma separated).
// Nothing configured → ['localhost']. Hostnames only: lower-case, no port.
// NEXT_PUBLIC_* values are inlined at build time (literal references below).

/** Lower-case hostname (no port) of a URL or host string; null when unparsable. */
export function hostnameOf(value: string | undefined | null): string | null {
  const v = (value ?? '').trim().toLowerCase();
  if (!v) return null;
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(v) ? v : `http://${v}`).hostname || null;
  } catch {
    return null;
  }
}

/** Pure form of `platformHosts()` for tests: list value + web URL. */
export function platformHostsFrom(
  hostsList: string | undefined | null,
  webUrl: string | undefined | null,
): string[] {
  const out: string[] = [];
  const add = (h: string | null) => {
    if (h && !out.includes(h)) out.push(h);
  };
  // The web URL must be a real URL (scheme + host); a bare word is ignored.
  const primary = /^https?:\/\//i.test((webUrl ?? '').trim()) ? hostnameOf(webUrl) : null;
  if (primary) {
    const bare = primary.replace(/^www\./, '');
    add(primary);
    add(bare);
    if (bare !== 'localhost' && !/^\d+(\.\d+){3}$/.test(bare)) add(`www.${bare}`);
  }
  for (const part of (hostsList ?? '').split(',')) add(hostnameOf(part));
  return out.length > 0 ? out : ['localhost'];
}

/** Every hostname the platform is served on (primary first). */
export function platformHosts(): string[] {
  return platformHostsFrom(process.env.NEXT_PUBLIC_PLATFORM_HOSTS, process.env.NEXT_PUBLIC_WEB_URL);
}

/** `<slug>.<any platform host>`? `host` may carry a port. */
export function isPlatformSubdomainHost(
  host: string | null | undefined,
  slug: string,
  hosts: readonly string[],
): boolean {
  const h = hostnameOf(host);
  if (!h) return false;
  const s = slug.trim().toLowerCase();
  return hosts.some((p) => h === `${s}.${p}`);
}
