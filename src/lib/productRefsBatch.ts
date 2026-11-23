// Batched lookup of products by id for the link field / menu chips (M165).
// Pure core (no React, no fetch): ids asked for in the same tick go out as
// ONE request of at most PRODUCT_REFS_MAX_IDS ids, results are cached per
// id, and a network error is kept apart from "missing" (deleted or not the
// owner's) so a chip never claims a product was deleted when the request
// simply failed. Tested by src/lib/productRefsBatch.test.mjs.

export const PRODUCT_REFS_MAX_IDS = 50;

export interface ProductRefRow {
  id: string;
  slug?: string | null;
  status?: string | null;
  translations?: Array<{ locale?: string | null; title?: string | null; slug?: string | null }> | null;
  images?: Array<{ url?: string | null }> | null;
}

export type ProductRefResult =
  | { state: 'ok'; product: ProductRefRow }
  | { state: 'missing' }
  | { state: 'error' };

export interface ProductRefsBatcher {
  /** Result for one id (cached; batched with the other ids of this tick). */
  get(id: string): Promise<ProductRefResult>;
  /** Cached result, if any (synchronous, for the first render). */
  peek(id: string): ProductRefResult | undefined;
  /** Stores a product the picker just returned (no request needed). */
  seed(product: ProductRefRow): void;
  /** Forgets one id (retry) or everything. */
  invalidate(id?: string): void;
}

export function createProductRefsBatcher(opts: {
  fetchIds: (ids: string[]) => Promise<ProductRefRow[]>;
  /** Defers the flush; default `queueMicrotask` (same tick). */
  schedule?: (fn: () => void) => void;
}): ProductRefsBatcher {
  const schedule = opts.schedule ?? ((fn: () => void) => queueMicrotask(fn));
  const cache = new Map<string, ProductRefResult>();
  const inflight = new Map<string, Promise<ProductRefResult>>();
  let queue: Array<{ id: string; resolve: (r: ProductRefResult) => void }> = [];
  let scheduled = false;

  const flush = () => {
    scheduled = false;
    const batch = queue;
    queue = [];
    for (let i = 0; i < batch.length; i += PRODUCT_REFS_MAX_IDS) {
      const chunk = batch.slice(i, i + PRODUCT_REFS_MAX_IDS);
      const ids = chunk.map((c) => c.id);
      opts.fetchIds(ids).then(
        (rows) => {
          const byId = new Map((rows ?? []).map((r) => [String(r.id).toLowerCase(), r]));
          for (const { id, resolve } of chunk) {
            const row = byId.get(id);
            const result: ProductRefResult = row ? { state: 'ok', product: row } : { state: 'missing' };
            cache.set(id, result);
            inflight.delete(id);
            resolve(result);
          }
        },
        () => {
          for (const { id, resolve } of chunk) {
            // Errors are not cached: the next get() retries.
            inflight.delete(id);
            resolve({ state: 'error' });
          }
        },
      );
    }
  };

  return {
    get(rawId) {
      const id = rawId.toLowerCase();
      const hit = cache.get(id);
      if (hit) return Promise.resolve(hit);
      const pending = inflight.get(id);
      if (pending) return pending;
      const p = new Promise<ProductRefResult>((resolve) => {
        queue.push({ id, resolve });
      });
      inflight.set(id, p);
      if (!scheduled) {
        scheduled = true;
        schedule(flush);
      }
      return p;
    },
    peek(rawId) {
      return cache.get(rawId.toLowerCase());
    },
    seed(product) {
      cache.set(String(product.id).toLowerCase(), { state: 'ok', product });
    },
    invalidate(id) {
      if (id) cache.delete(id.toLowerCase());
      else cache.clear();
    },
  };
}

/** Title of a product row in `locale`, else the primary locale, else any title. */
export function productRefTitle(product: ProductRefRow, locale: string, primaryLocale?: string): string {
  const trs = product.translations ?? [];
  const pick = (l?: string) => (l ? trs.find((t) => t?.locale === l && t.title?.trim()) : undefined);
  return (pick(locale) ?? pick(primaryLocale) ?? trs.find((t) => t?.title?.trim()))?.title?.trim() ?? '';
}

/** `/products/<slug>` address of a product row (the menu editor's url), or ''. */
export function productRefSlug(product: ProductRefRow, locale?: string): string {
  const trs = product.translations ?? [];
  const own = locale ? trs.find((t) => t?.locale === locale && t.slug)?.slug : undefined;
  return own ?? product.slug ?? trs.find((t) => t?.slug)?.slug ?? '';
}
