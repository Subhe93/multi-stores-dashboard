// Content-Security-Policy builder for the dashboard (security audit M6,
// plans/security-hardening/CSP-ROLLOUT.md). Pure (no imports) so
// next.config.ts and the node unit test can load it directly.
//
// next.config.ts evaluates headers() at BUILD time: every env value read
// here (NEXT_PUBLIC_API_URL, CSP_EXTRA_ORIGINS, CSP_REPORT_URI, CSP_ENFORCE)
// needs `npm run build` + restart to take effect.
//
// script-src still carries 'unsafe-inline': Next.js inlines its bootstrap
// scripts, and dropping it needs a per-request nonce set by a proxy
// (src/proxy.ts) plus dynamic rendering of every page. That is the next
// step before enforcing (see CSP-ROLLOUT.md); the rest of the policy is
// already strict: no third-party scripts, connect-src = the API only,
// frame-ancestors 'none'.

export type CspDirectives = Record<string, string[]>;

export interface CspContext {
  /** Origin(s) of the API (NEXT_PUBLIC_API_URL). */
  apiOrigins: string[];
  /** CSP_EXTRA_ORIGINS: e.g. the old API host still used for media links. */
  extraOrigins: string[];
  /** Absolute report endpoint, or null when no API URL is configured. */
  reportUri: string | null;
  /** `next dev`: React needs eval and HMR needs websockets. */
  dev: boolean;
  /** CSP_ENFORCE=1 sends the enforcing header instead of Report-Only. */
  enforce: boolean;
}

export interface CspEnv {
  NEXT_PUBLIC_API_URL?: string;
  CSP_EXTRA_ORIGINS?: string;
  CSP_REPORT_URI?: string;
  CSP_ENFORCE?: string;
  NODE_ENV?: string;
}

/** Name of the Reporting API endpoint used by `report-to`. */
export const CSP_REPORT_GROUP = 'csp-endpoint';

const ORIGIN_RE = /^(https?|wss?):\/\/(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*(:\d{1,5})?$/;

/** A CSP source origin (`scheme://host[:port]`, optional `*.`), else null. */
export function cspOrigin(value: string | undefined | null): string | null {
  const v = (value ?? '').trim().toLowerCase();
  if (!v) return null;
  const m = /^([a-z][a-z0-9+.-]*:\/\/[^/?#]+)/.exec(v);
  if (!m) return null;
  return ORIGIN_RE.test(m[1]) ? m[1] : null;
}

/** Comma-separated origin list, invalid entries dropped, deduplicated. */
export function cspOriginList(raw: string | undefined | null): string[] {
  const out: string[] = [];
  for (const part of (raw ?? '').split(',')) {
    const o = cspOrigin(part);
    if (o && !out.includes(o)) out.push(o);
  }
  return out;
}

/** True for "1", "true", "yes", "on" (case-insensitive). */
export function envFlag(raw: string | undefined | null): boolean {
  return /^(1|true|yes|on)$/i.test((raw ?? '').trim());
}

export function cspContextFrom(env: CspEnv): CspContext {
  const apiUrl = (env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
  const apiOrigin = cspOrigin(apiUrl);
  const explicit = (env.CSP_REPORT_URI ?? '').trim();
  return {
    apiOrigins: apiOrigin ? [apiOrigin] : [],
    extraOrigins: cspOriginList(env.CSP_EXTRA_ORIGINS),
    reportUri: explicit || (apiOrigin ? `${apiUrl}/csp-report` : null),
    dev: env.NODE_ENV !== 'production',
    enforce: envFlag(env.CSP_ENFORCE),
  };
}

/** Header name: Report-Only unless CSP_ENFORCE is on. */
export function cspHeaderName(ctx: Pick<CspContext, 'enforce'>): string {
  return ctx.enforce ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
}

/** Serialize directives in insertion order, sources deduplicated. */
export function serializeCsp(directives: CspDirectives): string {
  return Object.entries(directives)
    .map(([name, sources]) => {
      const uniq = sources.filter((s, i) => s && sources.indexOf(s) === i);
      return uniq.length ? `${name} ${uniq.join(' ')}` : name;
    })
    .join('; ');
}

/**
 * Frame sources for the storefront the dashboard embeds (builder preview):
 * the NEXT_PUBLIC_WEB_URL origin plus every platform host and its store
 * subdomains (`https://*.<host>`). `www.` hosts are covered by the wildcard.
 */
export function storefrontFrameSources(
  webUrl: string | undefined | null,
  platformHosts: readonly string[],
): string[] {
  const out: string[] = [];
  const add = (o: string | null) => {
    if (o && !out.includes(o)) out.push(o);
  };
  add(cspOrigin(webUrl));
  for (const raw of platformHosts) {
    const host = raw.trim().toLowerCase();
    if (!host || host === 'localhost' || /^\d+(\.\d+){3}$/.test(host)) continue;
    if (host.startsWith('www.')) continue;
    add(cspOrigin(`https://${host}`));
    add(cspOrigin(`https://*.${host}`));
  }
  return out;
}

/** The dashboard policy. `frameSources`: see storefrontFrameSources. */
export function dashboardCspDirectives(
  ctx: CspContext,
  opts: { frameSources?: string[] } = {},
): CspDirectives {
  const own = ["'self'", ...ctx.apiOrigins, ...ctx.extraOrigins];
  const d: CspDirectives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(ctx.dev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    // Product / page images may sit on any host (imports, pasted URLs).
    'img-src': [...own, 'data:', 'blob:', 'https:'],
    'font-src': [...own, 'data:', 'https://fonts.gstatic.com'],
    'media-src': [...own, 'data:', 'blob:'],
    'connect-src': [...own, 'data:', 'blob:', ...(ctx.dev ? ['ws:', 'wss:', 'http://localhost:*'] : [])],
    'frame-src': ["'self'", ...(opts.frameSources ?? [])],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  if (ctx.reportUri) {
    d['report-uri'] = [ctx.reportUri];
    d['report-to'] = [CSP_REPORT_GROUP];
  }
  return d;
}

/** The CSP header (+ Reporting-Endpoints) for one policy. */
export function cspHeaders(
  ctx: CspContext,
  directives: CspDirectives,
): { key: string; value: string }[] {
  const out = [{ key: cspHeaderName(ctx), value: serializeCsp(directives) }];
  if (ctx.reportUri) {
    out.push({ key: 'Reporting-Endpoints', value: `${CSP_REPORT_GROUP}="${ctx.reportUri}"` });
  }
  return out;
}
