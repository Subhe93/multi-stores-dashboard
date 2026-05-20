'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Wand2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { BuilderLayout } from '@/components/builder/BuilderLayout';
import type { StorePageSummary } from '@/components/builder/PageSwitcher';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import type { BuilderPage, SectionInstance } from '@/components/builder/types';

interface StoreResponse {
  id: string;
  slug: string;
  theme_key?: string;
  theme_customizations?: Record<string, unknown>;
  theme_config?: Record<string, unknown>;
  logo_url?: string;
  favicon_url?: string;
  language_config?: {
    primary_locale?: string;
    secondary_locales?: string[];
  } | null;
}

interface V2PageResponse extends BuilderPage {
  sections: SectionInstance[];
}

interface LegacyPageResponse {
  id: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED';
  type: string;
  translations: { locale: string; title: string; content?: string }[];
}

// /v2/pages POST only accepts a fixed enum of types. Map legacy content-page
// types (ABOUT, CONTACT, policies, custom slugs) to STATIC since the v2
// builder treats them all the same way — a slug + sections. The slug keeps
// the original page identity in the storefront URL.
const V2_ACCEPTED_TYPES = new Set(['HOME', 'STATIC', 'LANDING', 'PRODUCT_TEMPLATE', 'HEADER', 'FOOTER']);

// Accepted `static_kind` values when `type === 'STATIC'`. The legacy `type`
// field on /pages rows already speaks this vocabulary (uppercase snake_case),
// so we just normalize the casing. Anything we don't recognise lands on
// CUSTOM, which is the v2 "anything goes" bucket.
const V2_STATIC_KINDS = new Set([
  'ABOUT', 'CONTACT', 'PRIVACY_POLICY', 'TERMS',
  'SHIPPING_POLICY', 'RETURN_POLICY', 'FAQ', 'CUSTOM',
]);

function v2TypeFor(legacyType: string): string {
  const upper = legacyType.toUpperCase();
  return V2_ACCEPTED_TYPES.has(upper) ? upper : 'STATIC';
}

function v2StaticKindFor(legacyType: string): string {
  const upper = legacyType.toUpperCase();
  return V2_STATIC_KINDS.has(upper) ? upper : 'CUSTOM';
}

// Top-level route so the builder gets a full-screen canvas without the
// creator sidebar/header. ProtectedRoute still gates access to CREATOR users.
export default function BuilderPageRoute() {
  return (
    <ProtectedRoute allowedRoles={['CREATOR']}>
      <BuilderInner />
    </ProtectedRoute>
  );
}

function BuilderInner() {
  const { token } = useAuth();
  const params = useParams<{ pageId: string }>();
  const pageId = params?.pageId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<V2PageResponse | null>(null);
  const [store, setStore] = useState<StoreResponse | null>(null);
  const [allPages, setAllPages] = useState<StorePageSummary[]>([]);
  // Legacy page detected (not in v2 yet) — drives the one-click migration UI.
  const [legacy, setLegacy] = useState<LegacyPageResponse | null>(null);

  useEffect(() => {
    if (!token || !pageId) return;
    setLoading(true);
    setError(null);
    setLegacy(null);

    (async () => {
      try {
        // Resolve the store first so we can hit /stores/{id}/pages even when
        // the page load itself fails (the migration prompt below needs the
        // list to navigate to siblings).
        const s = await api<StoreResponse>('/stores/my/store', { token });
        setStore(s);

        // Page list is non-fatal; the builder still works with just the
        // current page if the list call rejects.
        try {
          const list = await api<StorePageSummary[]>(`/stores/${s.id}/pages`, { token });
          setAllPages(Array.isArray(list) ? list : []);
        } catch {
          /* ignore */
        }

        // Try v2 first — every page that has already been adopted by the
        // section builder responds here. Anything that 404s is a legacy
        // rich-text page that needs a one-time upgrade.
        try {
          const p = await api<V2PageResponse>(`/v2/pages/${pageId}`, { token });
          setPage(p);
        } catch (err) {
          const e = err as { status?: number };
          if (e?.status !== 404) throw err;
          // Fall back to the legacy record so we can show the migration
          // prompt with the page's actual content.
          const lp = await api<LegacyPageResponse>(`/pages/${pageId}`, { token });
          setLegacy(lp);
        }
      } catch (err) {
        const e = err as Error;
        setError(e.message || 'Failed to load page');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, pageId]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-red-500">
        {error || 'Page not found'}
      </div>
    );
  }

  // Legacy page detected → show migration UI instead of the builder.
  if (legacy) {
    return (
      <MigrationPrompt
        token={token!}
        legacy={legacy}
        primaryLocale={store.language_config?.primary_locale || 'en'}
      />
    );
  }

  if (!page) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-red-500">
        Page not found
      </div>
    );
  }

  // Make sure the current page is always in the switcher list — covers the
  // rare case where the /stores/{id}/pages list call failed or hasn't returned
  // a fresh entry for a just-created page.
  const allPagesWithCurrent = allPages.some((p) => p.id === page.id)
    ? allPages
    : [
        {
          id: page.id,
          slug: page.slug || '',
          status: page.status,
          type: page.type,
          translations: page.translations.map((t) => ({ locale: t.locale, title: t.title || '' })),
        },
        ...allPages,
      ];

  return (
    <BuilderLayout
      page={page}
      initialSections={page.sections}
      allPages={allPagesWithCurrent}
      store={{
        slug: store.slug,
        theme_key: store.theme_key || 'minimal',
        theme_customizations: store.theme_config || store.theme_customizations || {},
        logo_url: store.logo_url || '',
        favicon_url: store.favicon_url || '',
        language_config: {
          primary_locale: store.language_config?.primary_locale || 'en',
          secondary_locales: store.language_config?.secondary_locales || [],
        },
      }}
    />
  );
}

/**
 * One-time migration UI. Existing legacy pages were created before the
 * section builder; their title + rich-text body lives under /pages/{id}. We
 * upgrade them by creating a v2 sibling — same type / slug / translations —
 * and seeding it with a single rich-text section that carries the old HTML
 * so no content is lost. The legacy row is deleted on success; the user
 * lands in the builder on the new id.
 */
interface V2PageRow {
  id: string;
  slug: string;
  type: string;
  static_kind?: string;
}

function MigrationPrompt({
  token,
  legacy,
  primaryLocale,
}: {
  token: string;
  legacy: LegacyPageResponse;
  primaryLocale: string;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // While we check for a previously-migrated v2 sibling, we hide the prompt
  // body so the user doesn't see a flash of "Upgrade?" before being silently
  // redirected to the existing v2 page.
  const [checkingSibling, setCheckingSibling] = useState(true);
  const primaryTitle =
    legacy.translations.find((t) => t.title?.trim())?.title || legacy.slug || 'Untitled';

  // Check on mount whether the v2 list already contains a page that looks
  // like the migrated version of this legacy row (same slug + kind). If we
  // find one the user has already upgraded — just send them there. The
  // delete-the-legacy step in `upgrade` can fail silently on the backend
  // (e.g., FK constraint, partial rollback) which is what causes the
  // "A page with this slug or kind already exists" loop the second time
  // around.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api<V2PageRow[]>('/v2/pages/mine', { token });
        if (cancelled || !Array.isArray(list)) {
          if (!cancelled) setCheckingSibling(false);
          return;
        }
        const wantType = v2TypeFor(legacy.type);
        const wantKind = wantType === 'STATIC' ? v2StaticKindFor(legacy.type) : null;
        const match = list.find((p) => {
          if (p.slug !== legacy.slug) return false;
          if (p.type !== wantType) return false;
          if (wantKind !== null && (p.static_kind || '').toUpperCase() !== wantKind) return false;
          return true;
        });
        if (match && !cancelled) {
          // Best-effort: drop the legacy row so the pages list stops showing
          // the orphan. Ignore failures.
          try {
            await api(`/pages/${legacy.id}`, { method: 'DELETE', token });
          } catch {
            /* ignore */
          }
          router.replace(`/builder/${match.id}`);
          return;
        }
      } catch {
        /* fall through to the manual-upgrade UI */
      }
      if (!cancelled) setCheckingSibling(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, legacy.id, legacy.slug, legacy.type, router]);

  if (checkingSibling) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
      </div>
    );
  }

  async function upgrade() {
    if (running) return;
    setRunning(true);
    setError(null);
    try {
      // 1) The v2 schema accepts a fixed set of page types; legacy content
      //    types (ABOUT, CONTACT, CUSTOM, policy variants…) all collapse to
      //    STATIC in the builder. The slug carries the page identity, so
      //    "/about", "/contact", "/new-offer" still resolve in the storefront.
      //
      //    Delete the legacy row FIRST so the slug becomes free — otherwise
      //    a unique-(slug,store) constraint on the pages table would reject
      //    the POST below.
      try {
        await api(`/pages/${legacy.id}`, { method: 'DELETE', token });
      } catch (delErr) {
        // If the legacy delete fails we still try the create — the conflict
        // (if any) will surface as a clearer 409 from the create call.
        console.warn('Legacy page delete before upgrade failed', delErr);
      }

      // 2) Create the v2 page with the mapped type + same slug + per-locale
      //    titles. Translations only carry { locale, title } at this step;
      //    body HTML moves into a rich-text section in step 3.
      //
      //    `static_kind` carries the legacy semantic distinction inside the
      //    STATIC umbrella (about / contact / privacy_policy / …). The v2
      //    schema requires it whenever type === 'STATIC'.
      //
      //    If the legacy row has no translations at all, seed one with the
      //    slug as a placeholder title under the primary locale so the v2
      //    schema (which expects at least one translation) doesn't reject
      //    the create.
      const v2Type = v2TypeFor(legacy.type);
      const translations = legacy.translations.length > 0
        ? legacy.translations.map((t) => ({ locale: t.locale, title: t.title || legacy.slug }))
        : [{ locale: primaryLocale, title: legacy.slug || 'Untitled' }];

      const payload: Record<string, unknown> = {
        type: v2Type,
        slug: legacy.slug,
        translations,
      };
      if (v2Type === 'STATIC') {
        payload.static_kind = v2StaticKindFor(legacy.type);
      }

      const created = await api<{ id: string }>('/v2/pages', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      });

      // 2) If the legacy page had body HTML, seed the new page with a
      //    rich-text section so the content is preserved per-locale. We pick
      //    sensible defaults that match the rich-text schema's defaults.
      const hasBody = legacy.translations.some((t) => (t.content || '').trim());
      if (hasBody) {
        await api(`/v2/pages/${created.id}/sections`, {
          method: 'POST',
          token,
          body: JSON.stringify({
            section_key: 'rich-text',
            settings: { width: 'normal', alignment: 'left', padding: 'medium', surface: false },
            translations: legacy.translations
              .filter((t) => (t.title || t.content || '').trim())
              .map((t) => ({
                locale: t.locale,
                content: { heading: t.title || '', html: t.content || '' },
              })),
          }),
        });
      }

      // 4) Land the creator in the builder on the new id. `replace` so the
      //    old legacy URL leaves the history.
      router.replace(`/builder/${created.id}`);
    } catch (err) {
      const e = err as Error;
      setError(e.message || 'Upgrade failed');
      setRunning(false);
    }
  }

  return (
    <div className="h-screen flex items-center justify-center p-6 bg-linear-to-b from-zinc-50/40 to-white">
      <div className="max-w-lg w-full rounded-2xl border border-zinc-200 bg-white shadow-sm p-7 space-y-5">
        <div className="flex items-start gap-3">
          <div className="size-11 rounded-xl bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
            <Wand2 className="size-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-zinc-900">Upgrade this page to the builder</h1>
            <p className="text-[12.5px] text-zinc-500 leading-relaxed mt-1">
              <span className="font-medium text-zinc-700">"{primaryTitle}"</span> uses the old
              rich-text editor. Upgrade it to design with drag-and-drop sections — just like the
              home page. Your existing title and content will be preserved as a rich-text section
              that you can keep, edit, or replace.
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-zinc-50/70 border border-zinc-200/80 p-3 text-[11.5px] text-zinc-600 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-zinc-400 font-mono shrink-0 w-12">type</span>
            <span className="font-medium">{legacy.type.toLowerCase().replace(/_/g, ' ')}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-zinc-400 font-mono shrink-0 w-12">slug</span>
            <span className="font-mono">/{legacy.slug}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-zinc-400 font-mono shrink-0 w-12">locales</span>
            <span className="font-mono">{legacy.translations.map((t) => t.locale).join(', ') || '—'}</span>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/creator/pages')} disabled={running}>
            Cancel
          </Button>
          <Button size="sm" onClick={upgrade} disabled={running}>
            {running ? (
              <>
                <Loader2 className="size-3.5 me-1.5 animate-spin" />
                Upgrading…
              </>
            ) : (
              <>
                Upgrade to builder
                <ArrowRight className="size-3.5 ms-1.5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
