'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Loader2, Palette } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { findSectionSchema } from '@/lib/section-schemas';
import { cn } from '@/lib/utils';
import { LivePreview, type LivePreviewHandle } from './LivePreview';
import { SectionInspector } from './SectionInspector';
import { SectionList } from './SectionList';
import { PublishBar } from './PublishBar';
import { ThemePanel, type ThemeCustomizations } from './ThemePanel';
import type { ThemeTokenCustomizations } from './ThemeCustomizer';
import type { StorePageSummary } from './PageSwitcher';
import type { BuilderPage, SectionInstance } from './types';

interface BuilderLayoutProps {
  page: BuilderPage;
  initialSections: SectionInstance[];
  allPages: StorePageSummary[];
  store: {
    slug: string;
    theme_key: string;
    // Token-shape overrides merged onto the theme (drives the live preview).
    theme_customizations: Record<string, unknown>;
    // Legacy flat config (brand override colors, per-element typography, header).
    theme_config: Record<string, unknown>;
    logo_url: string;
    favicon_url: string;
    language_config: {
      primary_locale: string;
      secondary_locales: string[];
    };
  };
}

type LeftMode = 'sections' | 'theme';

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// How long after the last edit before we hit the API. Keeps the UI snappy while
// avoiding a request per keystroke.
const AUTOSAVE_DEBOUNCE_MS = 600;

// Navigation menu shape forwarded to the preview (mirrors the storefront's
// NavMenu so chrome sections resolve a selected menu key to its items).
interface BuilderMenuItem {
  id: string;
  parent_id?: string | null;
  label: string;
  label_i18n?: Record<string, string>;
  url: string;
  open_in_new_tab?: boolean;
}
interface BuilderMenu {
  id: string;
  key: string;
  name: string;
  items: BuilderMenuItem[];
}

export function BuilderLayout({ page, initialSections, allPages, store }: BuilderLayoutProps) {
  const { token } = useAuth();
  const previewRef = useRef<LivePreviewHandle>(null);

  const [sections, setSections] = useState<SectionInstance[]>(initialSections);
  const [selectedId, setSelectedId] = useState<string | null>(initialSections[0]?.id ?? null);
  const [activeLocale, setActiveLocale] = useState(store.language_config.primary_locale);
  const [pageStatus, setPageStatus] = useState<'DRAFT' | 'PUBLISHED'>(page.status);

  // Left-pane mode. "sections" is the catalog the builder always had;
  // "theme" swaps it out for the Design panel that used to live at
  // /creator/store. The right inspector + center canvas stay the same so
  // the creator can flip back and forth without losing context.
  const [leftMode, setLeftMode] = useState<LeftMode>('sections');

  // Store-level theme state — lifted so the live preview can react to
  // edits made in ThemePanel without a page reload.
  const [themeKey, setThemeKey] = useState(store.theme_key);
  const [themeCustomizations, setThemeCustomizations] = useState<ThemeTokenCustomizations>(
    (store.theme_customizations as ThemeTokenCustomizations) || {},
  );
  // Legacy flat config edited by the ThemePanel groups (header / brand override
  // / per-element typography). Kept separate from the token customizations so
  // each persists to its own column without cross-contamination.
  const [themeConfig, setThemeConfig] = useState<ThemeCustomizations>(
    (store.theme_config as ThemeCustomizations) || {},
  );
  const [logoUrl, setLogoUrl] = useState(store.logo_url || '');
  const [faviconUrl, setFaviconUrl] = useState(store.favicon_url || '');
  // Mirror of the server's seo + translations so the SEO dialog and PublishBar
  // share a single source of truth. Updated after a SeoDialog save (and after
  // a version restore via reloadFromServer below).
  const [pageSeo, setPageSeo] = useState<Record<string, unknown>>(page.seo || {});
  const [pageTranslations, setPageTranslations] = useState(page.translations);

  // Creator's navigation menus, forwarded to the preview so chrome sections
  // (header/footer) resolve a selected menu live — even one created this
  // session — instead of falling back to inline links.
  const [menus, setMenus] = useState<BuilderMenu[]>([]);
  useEffect(() => {
    if (!token) return;
    api<BuilderMenu[]>('/menus/mine', { token })
      .then((list) => setMenus(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, [token]);

  const selected = useMemo(
    () => sections.find((s) => s.id === selectedId) ?? null,
    [sections, selectedId],
  );

  // ── Autosave queue ──────────────────────────────────────
  // We accumulate pending updates per section and flush them on a single timer.
  // The dependency is intentionally a serialized snapshot so React schedules a
  // new timer when any field changes.
  const pendingRef = useRef<Map<string, { settings?: Record<string, unknown>; translations?: Map<string, Record<string, unknown>>; is_hidden?: boolean }>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushAutosave = useCallback(async () => {
    if (!token) return;
    const queue = pendingRef.current;
    if (queue.size === 0) return;
    pendingRef.current = new Map();

    await Promise.all(
      Array.from(queue.entries()).map(async ([sectionId, patch]) => {
        const body: Record<string, unknown> = {};
        if (patch.settings) body.settings = patch.settings;
        if (patch.is_hidden !== undefined) body.is_hidden = patch.is_hidden;
        if (patch.translations) {
          body.translations = Array.from(patch.translations.entries()).map(([locale, content]) => ({
            locale,
            content,
          }));
        }
        await api(`/v2/pages/sections/${sectionId}`, {
          method: 'PUT',
          token,
          body: JSON.stringify(body),
        });
      }),
    );
  }, [token]);

  const queueAutosave = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      void flushAutosave();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [flushAutosave]);

  // Flush on unmount so a fast back-button doesn't drop the last edit.
  useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      void flushAutosave();
    };
  }, [flushAutosave]);

  // ── Mutations ───────────────────────────────────────────

  const patchSectionSettings = useCallback(
    (sectionId: string, partial: Record<string, unknown>) => {
      setSections((prev) =>
        prev.map((s) => (s.id === sectionId ? { ...s, settings: { ...s.settings, ...partial } } : s)),
      );
      const entry = pendingRef.current.get(sectionId) || {};
      // Always send the FULL latest settings, not just the patch, so server
      // doesn't merge stale state from concurrent edits.
      const next = sections.find((s) => s.id === sectionId);
      entry.settings = { ...(next?.settings || {}), ...partial };
      pendingRef.current.set(sectionId, entry);
      queueAutosave();
    },
    [sections, queueAutosave],
  );

  const patchSectionContent = useCallback(
    (sectionId: string, locale: string, partial: Record<string, unknown>) => {
      setSections((prev) =>
        prev.map((s) => {
          if (s.id !== sectionId) return s;
          const existing = s.translations.find((t) => t.locale === locale);
          const mergedContent = { ...(existing?.content || {}), ...partial };
          const nextTranslations = existing
            ? s.translations.map((t) => (t.locale === locale ? { ...t, content: mergedContent } : t))
            : [...s.translations, { locale, content: mergedContent }];
          return { ...s, translations: nextTranslations };
        }),
      );
      const entry = pendingRef.current.get(sectionId) || {};
      const trMap = entry.translations || new Map<string, Record<string, unknown>>();
      const current = trMap.get(locale) || sections.find((s) => s.id === sectionId)?.translations.find((t) => t.locale === locale)?.content || {};
      trMap.set(locale, { ...current, ...partial });
      entry.translations = trMap;
      pendingRef.current.set(sectionId, entry);
      queueAutosave();
    },
    [sections, queueAutosave],
  );

  const toggleHidden = useCallback(
    (sectionId: string, hidden: boolean) => {
      setSections((prev) =>
        prev.map((s) => (s.id === sectionId ? { ...s, is_hidden: hidden } : s)),
      );
      const entry = pendingRef.current.get(sectionId) || {};
      entry.is_hidden = hidden;
      pendingRef.current.set(sectionId, entry);
      queueAutosave();
    },
    [queueAutosave],
  );

  const addSection = useCallback(
    async (sectionKey: string) => {
      if (!token) return;
      const schema = findSectionSchema(sectionKey);
      // Seed with the schema's defaults so a freshly added section already has
      // visible content (heading, sample items, etc.). Without this creators
      // see an "empty section" placeholder until they fill every field.
      const defaultSettings = schema?.defaultSettings || {};
      const defaultContent = schema?.defaultContent || {};
      const created = await api<SectionInstance>(`/v2/pages/${page.id}/sections`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          section_key: sectionKey,
          settings: defaultSettings,
          translations: [
            { locale: store.language_config.primary_locale, content: defaultContent },
          ],
        }),
      });
      setSections((prev) => [...prev, created]);
      setSelectedId(created.id);
    },
    [token, page.id, store.language_config.primary_locale],
  );

  const deleteSection = useCallback(
    async (sectionId: string) => {
      if (!token) return;
      await api(`/v2/pages/sections/${sectionId}`, { method: 'DELETE', token });
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
      setSelectedId((curr) => (curr === sectionId ? null : curr));
    },
    [token],
  );

  const reorderSections = useCallback(
    async (orderedIds: string[]) => {
      // Optimistic: reorder locally first.
      setSections((prev) => {
        const byId = new Map(prev.map((s) => [s.id, s]));
        return orderedIds
          .map((id, idx) => {
            const s = byId.get(id);
            return s ? { ...s, sort_order: idx } : null;
          })
          .filter((s): s is SectionInstance => !!s);
      });
      if (!token) return;
      await api(`/v2/pages/${page.id}/sections/sort`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ section_ids: orderedIds }),
      });
    },
    [token, page.id],
  );

  const publishPage = useCallback(async () => {
    if (!token) return;
    // Make sure pending edits are flushed before we snapshot.
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    await flushAutosave();
    await api(`/v2/pages/${page.id}/publish`, {
      method: 'POST',
      token,
      body: JSON.stringify({}),
    });
    setPageStatus('PUBLISHED');
  }, [token, page.id, flushAutosave]);

  // Full reload — pulls everything fresh from the server and drops any unsent
  // local edits. Used after a destructive op (version restore) where the
  // server snapshot is authoritative and pending edits would be invalid.
  const reloadFromServer = useCallback(async () => {
    if (!token) return;
    pendingRef.current.clear();
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const fresh = await api<{
      sections: SectionInstance[];
      status: 'DRAFT' | 'PUBLISHED';
      seo: Record<string, unknown>;
      translations: typeof pageTranslations;
    }>(`/v2/pages/${page.id}`, { token });
    setSections(fresh.sections);
    setPageStatus(fresh.status);
    setPageSeo(fresh.seo || {});
    setPageTranslations(fresh.translations);
    setSelectedId(fresh.sections[0]?.id ?? null);
  }, [token, page.id]);

  // Lighter reload — only refreshes page-level meta (seo + translations) without
  // touching sections or pending edits. Used after a SeoDialog save so the
  // creator's in-flight section work isn't discarded.
  const reloadPageMeta = useCallback(async () => {
    if (!token) return;
    const fresh = await api<{
      status: 'DRAFT' | 'PUBLISHED';
      seo: Record<string, unknown>;
      translations: typeof pageTranslations;
    }>(`/v2/pages/${page.id}`, { token });
    setPageStatus(fresh.status);
    setPageSeo(fresh.seo || {});
    setPageTranslations(fresh.translations);
  }, [token, page.id]);

  // ── Theme mutations (store-level) ──────────────────────
  // The ThemePanel owns its own working copy and debounces its own save,
  // so these are thin pass-throughs to the API — no extra debouncing here.

  const saveThemeCustomizations = useCallback(
    async (theme: ThemeCustomizations, branding: { logo_url: string; favicon_url: string }) => {
      if (!token) return;
      // The /theme endpoint owns colors / typography / header / etc. The
      // /store endpoint owns logo and favicon URLs (those live on the store
      // row, not in theme_config). Fire both in parallel.
      await Promise.all([
        api('/stores/my/theme', {
          method: 'PUT',
          token,
          body: JSON.stringify({ theme_config: theme }),
        }),
        api('/stores/my/store', {
          method: 'PUT',
          token,
          body: JSON.stringify({
            logo_url: branding.logo_url,
            favicon_url: branding.favicon_url,
          }),
        }),
      ]);
    },
    [token],
  );

  const applyThemeTemplate = useCallback(
    async (newKey: string) => {
      if (!token) return;
      // Applying a theme installs it as a fresh preset: the API clears token
      // overrides and strips brand fields from theme_config so the theme's
      // colours/fonts take effect. Mirror that locally so the live preview and
      // the design panel reset to the theme's defaults.
      await api('/stores/my/theme-selection', {
        method: 'PUT',
        token,
        body: JSON.stringify({ theme_key: newKey, reset_customizations: true }),
      });
      setThemeKey(newKey);
      setThemeCustomizations({});
      // Mirror the API's brand strip so the design panel resets too.
      setThemeConfig((prev) => {
        const next = { ...prev } as Record<string, unknown>;
        delete next.primaryColor;
        delete next.secondaryColor;
        delete next.fontFamily;
        delete next.typography;
        return next as ThemeCustomizations;
      });
    },
    [token],
  );

  // Persist the token-shape theme customizations (colors / fonts) edited via
  // the ThemeCustomizer popup. theme_key is omitted so only overrides change.
  const saveThemeTokens = useCallback(
    async (tokens: ThemeTokenCustomizations) => {
      if (!token) return;
      await api('/stores/my/theme-selection', {
        method: 'PUT',
        token,
        body: JSON.stringify({ theme_customizations: tokens }),
      });
    },
    [token],
  );

  // The store is "customized" when it carries token overrides (e.g. from an
  // imported template). Drives the "Custom" card in the theme picker.
  const isThemeCustomized = Object.keys(themeCustomizations || {}).length > 0;

  // ── Click-in-preview to select section ──────────────────

  const handlePreviewSectionClicked = useCallback((sectionId: string) => {
    setSelectedId(sectionId);
    setLeftMode('sections');
  }, []);

  // When selection changes from the list, scroll the iframe to it.
  useEffect(() => {
    if (selectedId) previewRef.current?.scrollToSection(selectedId);
  }, [selectedId]);

  // ── Render ──────────────────────────────────────────────

  const pageTitle =
    page.translations.find((t) => t.locale === activeLocale)?.title ||
    page.translations.find((t) => t.locale === store.language_config.primary_locale)?.title ||
    (page.type === 'HOME' ? 'Home' : page.slug || 'Untitled');

  return (
    <div className="h-screen w-full flex flex-col bg-zinc-50">
      <PublishBar
        pageId={page.id}
        pageTitle={pageTitle}
        pageType={page.type}
        status={pageStatus}
        storeUrl={`${WEB_ORIGIN}/store/${store.slug}`}
        primaryLocale={store.language_config.primary_locale}
        secondaryLocales={store.language_config.secondary_locales}
        activeLocale={activeLocale}
        allPages={allPages}
        seo={pageSeo}
        translations={pageTranslations}
        onLocaleChange={setActiveLocale}
        onBack={() => history.back()}
        onPublish={publishPage}
        onRestored={reloadFromServer}
        onSeoSaved={reloadPageMeta}
      />

      <div className="flex-1 grid grid-cols-[280px_1fr_360px] min-h-0">
        <aside className="border-r bg-white overflow-hidden flex flex-col">
          {/* Mode switcher — toggles the left pane between section catalog
              and theme/design controls. Right inspector + canvas stay put. */}
          <ModeSwitch mode={leftMode} onChange={setLeftMode} primaryLocale={store.language_config.primary_locale} />
          {/* Bounded flex region for the active panel. Without min-h-0 the
              panel's own h-full resolves to the FULL aside height — ignoring
              the ModeSwitch above it — so its bottom (the SectionList's pinned
              "Add Section" footer) gets clipped by the aside's overflow-hidden. */}
          <div className="flex-1 min-h-0">
            {leftMode === 'sections' ? (
              <SectionList
                sections={sections}
                selectedId={selectedId}
                locale={activeLocale}
                primaryLocale={store.language_config.primary_locale}
                pageType={page.type}
                onSelect={setSelectedId}
                onReorder={reorderSections}
                onAdd={addSection}
                onToggleHidden={toggleHidden}
              />
            ) : (
              <ThemePanel
                token={token ?? ''}
                apiBase={API_BASE}
                primaryLocale={store.language_config.primary_locale}
                themeKey={themeKey}
                customizations={themeConfig}
                logoUrl={logoUrl}
                faviconUrl={faviconUrl}
                onLocalChange={({ customizations, logoUrl: nextLogo, faviconUrl: nextFavicon }) => {
                  setThemeConfig(customizations);
                  setLogoUrl(nextLogo);
                  setFaviconUrl(nextFavicon);
                }}
                onSaveCustomizations={saveThemeCustomizations}
                onApplyTheme={applyThemeTemplate}
                isCustomized={isThemeCustomized}
                themeTokens={themeCustomizations}
                onTokensChange={setThemeCustomizations}
                onTokensSave={saveThemeTokens}
              />
            )}
          </div>
        </aside>

        {/* min-w-0 lets the 1fr track shrink below its content's intrinsic
            width. Without it the desktop preview (fixed 1280px box) forces the
            track wider than the viewport, spilling the right inspector off-
            screen behind a page-level horizontal scrollbar. The preview's own
            overflow-auto scrolls any excess width internally instead. */}
        <section className="min-h-0 min-w-0">
          {token ? (
            <LivePreview
              ref={previewRef}
              webOrigin={WEB_ORIGIN}
              storeSlug={store.slug}
              storeLocale={activeLocale}
              themeKey={themeKey}
              themeCustomizations={themeCustomizations}
              sections={sections}
              primaryLocale={store.language_config.primary_locale}
              pageType={page.type}
              menus={menus}
              onSectionClicked={handlePreviewSectionClicked}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
            </div>
          )}
        </section>

        <aside className="border-l bg-white overflow-hidden">
          <SectionInspector
            section={selected}
            locale={activeLocale}
            primaryLocale={store.language_config.primary_locale}
            token={token ?? ''}
            apiBase={API_BASE}
            onPatchSettings={patchSectionSettings}
            onPatchContent={patchSectionContent}
            onDelete={deleteSection}
            onToggleHidden={toggleHidden}
          />
        </aside>
      </div>
    </div>
  );
}

/** Two-tab toggle that drives which panel fills the left aside. */
function ModeSwitch({
  mode,
  onChange,
  primaryLocale,
}: {
  mode: LeftMode;
  onChange: (m: LeftMode) => void;
  primaryLocale: string;
}) {
  const ar = primaryLocale === 'ar';
  const tabs: { id: LeftMode; label: string; Icon: typeof Layers }[] = [
    { id: 'sections', label: ar ? 'الأقسام' : 'Sections', Icon: Layers },
    { id: 'theme', label: ar ? 'التصميم' : 'Design', Icon: Palette },
  ];
  return (
    <div className="flex items-stretch border-b border-zinc-200/80 bg-white shrink-0 relative">
      {tabs.map((t) => {
        const isActive = mode === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11.5px] font-semibold transition-colors',
              isActive ? 'text-indigo-600' : 'text-zinc-500 hover:text-zinc-900',
            )}
          >
            <t.Icon className={cn('size-3.5 transition', isActive && 'scale-110')} />
            {t.label}
            {isActive && <span className="absolute bottom-0 inset-x-2 h-0.5 rounded-t bg-indigo-600" />}
          </button>
        );
      })}
    </div>
  );
}
