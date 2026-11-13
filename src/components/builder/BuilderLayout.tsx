'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Layers, Loader2, Palette } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';
import { layoutBlocksEnabled } from '@/lib/layoutBlocksFlag';
import { findSectionSchema } from '@/lib/section-schemas';
import {
  canDropInto,
  flattenTree,
  moveSection as moveSectionInTree,
  removeSubtree,
  collectSubtreeIds,
  toTreeReorderPayload,
  validateMove,
  type MoveTarget,
} from '@/lib/sectionTree';
import {
  missingInCreateOrder,
  newSubtreeRootId,
  parentIdOf,
  remapSectionId,
  siblingMoveTarget,
  siblingsOf,
  survivorsInsideDropped,
  topMostDropped,
  usesSectionTree,
} from '@/lib/builderTreeActions';
import { presetTreeBodies } from '@/lib/section-presets';
import { createPresetTree, presetIsNested } from '@/lib/productBlocksPreset';
import { cn } from '@/lib/utils';
import { SlugAdjustedNotice } from '@/components/common/SlugAdjustedNotice';
import { LivePreview, type LivePreviewHandle } from './LivePreview';
import { SectionInspector } from './SectionInspector';
import { SectionList } from './SectionList';
import { PublishBar } from './PublishBar';
import { TranslatePageDialog } from './TranslatePageDialog';
import { ThemePanel, type ThemeCustomizations } from './ThemePanel';
import type { ThemeTokenCustomizations } from './ThemeCustomizer';
import type { StorePageSummary } from './PageSwitcher';
import type { BuilderPage, SectionInstance } from './types';
import { StorefrontEditHandoff } from '@/components/creator/StorefrontEditHandoff';
import { LegalReviewHint } from '@/components/creator/LegalPagesCard';
import { legalSlugForKind } from '@/lib/legalPages';

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
    /** Trader country (store trader_details); drives the legal-page review warning. */
    trader_country?: string | null;
    language_config: {
      primary_locale: string;
      secondary_locales: string[];
    };
  };
}

type LeftMode = 'sections' | 'theme';

// Autosave lifecycle surfaced in the PublishBar chip.
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// Deep-clone helper for history snapshots — section objects are plain JSON.
function cloneSections(list: SectionInstance[]): SectionInstance[] {
  return JSON.parse(JSON.stringify(list)) as SectionInstance[];
}

// Cap the undo stack so a long editing session can't grow memory unbounded.
const HISTORY_LIMIT = 50;
// Rapid keystrokes within this window collapse into a single checkpoint.
const HISTORY_BURST_MS = 800;

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
  // Per-store beta flag (`product_layout` app): layout containers and the
  // new product blocks. Off (or still loading) keeps the builder as before.
  const { apps: storeApps } = useStoreApps();
  const layoutContainers = layoutBlocksEnabled(page.type, isAppEnabled(storeApps, 'product_layout'));
  const tBuilder = useTranslations('builder');
  const tRoot = useTranslations();
  const previewRef = useRef<LivePreviewHandle>(null);

  const [sections, setSections] = useState<SectionInstance[]>(initialSections);
  const [selectedId, setSelectedId] = useState<string | null>(initialSections[0]?.id ?? null);
  const [activeLocale, setActiveLocale] = useState(store.language_config.primary_locale);
  const [pageStatus, setPageStatus] = useState<'DRAFT' | 'PUBLISHED'>(page.status);
  // Permalink (editable in the SEO dialog) and whether the page is live: a
  // live page's old URL 301s to the new one when the slug changes.
  const [pageSlug, setPageSlug] = useState<string | null>(page.slug);
  const [isLive, setIsLive] = useState(!!page.published_version_id);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  // Transient feedback chip (the builder has no global toaster). Cleared by
  // the timer below; a new notice restarts it.
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  // Always-fresh mirror of `sections` for callbacks that must read the latest
  // state without re-subscribing (history capture, keyboard shortcuts).
  const sectionsRef = useRef(sections);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  // ── Undo/Redo history ───────────────────────────────────
  // Snapshots of the whole section list. Mutations record a checkpoint of the
  // PREVIOUS state before applying; undo/redo reconcile the server to the
  // restored snapshot (see applySnapshot).
  const historyRef = useRef<{
    past: SectionInstance[][];
    future: SectionInstance[][];
    lastPushAt: number;
  }>({ past: [], future: [], lastPushAt: 0 });
  const [historyFlags, setHistoryFlags] = useState({ canUndo: false, canRedo: false });

  const syncHistoryFlags = useCallback(() => {
    setHistoryFlags({
      canUndo: historyRef.current.past.length > 0,
      canRedo: historyRef.current.future.length > 0,
    });
  }, []);

  /**
   * Push a checkpoint of the current state onto the undo stack. Typing bursts
   * (rapid successive patches) collapse into one checkpoint; structural
   * operations (add / delete / duplicate / reorder / hide) pass force.
   */
  const recordHistory = useCallback(
    (opts: { force?: boolean } = {}) => {
      const h = historyRef.current;
      const now = Date.now();
      if (!opts.force && h.past.length > 0 && now - h.lastPushAt < HISTORY_BURST_MS) {
        // Same burst — keep extending the window without a new checkpoint.
        h.lastPushAt = now;
        return;
      }
      h.past.push(cloneSections(sectionsRef.current));
      if (h.past.length > HISTORY_LIMIT) h.past.shift();
      h.future = [];
      h.lastPushAt = now;
      syncHistoryFlags();
    },
    [syncHistoryFlags],
  );

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
  // Layout container the selected section sits in (drives the inspector's
  // "Layout in parent" panel). Null for root sections.
  const selectedParent = useMemo(() => {
    const pid = selected?.parent_id ?? null;
    return pid ? sections.find((s) => s.id === pid) ?? null : null;
  }, [sections, selected]);

  // Friendly text for a failed structural action: the API's PAGE_SECTION_*
  // code when it is translated, else a generic message.
  const actionErrorMessage = useCallback(
    (err: unknown): string => {
      if (err instanceof ApiError && err.code && tRoot.has(`errors.${err.code}`)) {
        return tRoot(`errors.${err.code}`);
      }
      return tBuilder('sectionActionFailed');
    },
    [tRoot, tBuilder],
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

    setSaveState('saving');
    try {
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
      setSaveState('saved');
    } catch {
      // The queue was already drained — surface the failure so the creator
      // knows the last change didn't reach the server.
      setSaveState('error');
    }
  }, [token]);

  const queueAutosave = useCallback(() => {
    // Pending-but-not-flushed already reads as "saving" in the chip.
    setSaveState('saving');
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
      recordHistory();
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

  // Base content a new locale row must start from: what the creator currently
  // SEES (locale → primary → first translation with content). Seeding from the
  // fallback matters after a primary-locale change: patching only the edited
  // key into an empty new-locale row would make the storefront (which prefers
  // the matching-locale row wholesale) drop every other field of the section.
  const contentBaseFor = useCallback(
    (translations: SectionInstance['translations'], locale: string): Record<string, unknown> => {
      return (
        translations.find((t) => t.locale === locale)?.content ??
        translations.find((t) => t.locale === store.language_config.primary_locale)?.content ??
        translations.find((t) => t.content && Object.keys(t.content).length > 0)?.content ??
        {}
      );
    },
    [store.language_config.primary_locale],
  );

  const patchSectionContent = useCallback(
    (sectionId: string, locale: string, partial: Record<string, unknown>) => {
      recordHistory();
      setSections((prev) =>
        prev.map((s) => {
          if (s.id !== sectionId) return s;
          const existing = s.translations.find((t) => t.locale === locale);
          const base = existing?.content || contentBaseFor(s.translations, locale);
          const mergedContent = { ...base, ...partial };
          const nextTranslations = existing
            ? s.translations.map((t) => (t.locale === locale ? { ...t, content: mergedContent } : t))
            : [...s.translations, { locale, content: mergedContent }];
          return { ...s, translations: nextTranslations };
        }),
      );
      const entry = pendingRef.current.get(sectionId) || {};
      const trMap = entry.translations || new Map<string, Record<string, unknown>>();
      const sectionRow = sections.find((s) => s.id === sectionId);
      const current =
        trMap.get(locale) ||
        sectionRow?.translations.find((t) => t.locale === locale)?.content ||
        (sectionRow ? contentBaseFor(sectionRow.translations, locale) : {});
      trMap.set(locale, { ...current, ...partial });
      entry.translations = trMap;
      pendingRef.current.set(sectionId, entry);
      queueAutosave();
    },
    [sections, queueAutosave, contentBaseFor],
  );

  const toggleHidden = useCallback(
    (sectionId: string, hidden: boolean) => {
      recordHistory({ force: true });
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

  /**
   * Persist the order (and parents) of `list` on the server. Pages without
   * nesting keep the legacy flat endpoint so they behave exactly as before;
   * nested pages send the whole tree in one validated transaction.
   */
  const persistOrder = useCallback(
    async (list: SectionInstance[], opts: { forceTree?: boolean } = {}) => {
      if (!token) return;
      if (opts.forceTree || usesSectionTree(list)) {
        await api(`/v2/pages/${page.id}/sections/tree`, {
          method: 'PUT',
          token,
          body: JSON.stringify(toTreeReorderPayload(list)),
        });
        return;
      }
      await api(`/v2/pages/${page.id}/sections/sort`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ section_ids: list.map((s) => s.id) }),
      });
    },
    [token, page.id],
  );

  const addSection = useCallback(
    async (sectionKey: string, target?: MoveTarget | null) => {
      if (!token) return;
      // The section list always reports the insert target with the add
      // (undefined = append at the root), so no remembered target is used:
      // a cancelled "+ add here" can never redirect a later add.
      const insert = target ?? null;
      const parentId = insert?.parentId ?? null;
      const before = sectionsRef.current;
      // Client-side guard (the dialog already filters): the parent must be a
      // container with room for this section.
      if (parentId) {
        const parentRow = flattenTree(before).find((f) => f.id === parentId);
        if (!parentRow || !canDropInto(sectionKey, parentRow.section, parentRow.depth + 1)) {
          setNotice(tRoot('errors.PAGE_SECTION_TREE_TOO_DEEP'));
          return;
        }
      }
      recordHistory({ force: true });
      const schema = findSectionSchema(sectionKey);
      // Seed with the schema's defaults so a freshly added section already has
      // visible content (heading, sample items, etc.). Without this creators
      // see an "empty section" placeholder until they fill every field.
      const defaultSettings = schema?.defaultSettings || {};
      const defaultContent = schema?.defaultContent || {};
      let created: SectionInstance;
      try {
        created = await api<SectionInstance>(`/v2/pages/${page.id}/sections`, {
          method: 'POST',
          token,
          body: JSON.stringify({
            section_key: sectionKey,
            settings: defaultSettings,
            translations: [
              { locale: store.language_config.primary_locale, content: defaultContent },
            ],
            // Only sent for nested inserts so root adds keep the old payload.
            ...(parentId ? { parent_id: parentId } : {}),
          }),
        });
      } catch (err) {
        setNotice(actionErrorMessage(err));
        throw err;
      }
      // The server appends after the last sibling; move it to the requested
      // slot when that is not the end.
      const appended = [...sectionsRef.current, { ...created, parent_id: created.parent_id ?? parentId }];
      const siblingCount = siblingsOf(sectionsRef.current, parentId).length;
      const wantsSlot = insert != null && insert.index < siblingCount;
      const next = wantsSlot
        ? moveSectionInTree(appended, created.id, { parentId, index: insert.index })
        : appended;
      setSections(next);
      setSelectedId(created.id);
      if (wantsSlot && next !== appended) {
        try {
          await persistOrder(next);
        } catch (err) {
          setNotice(actionErrorMessage(err));
        }
      }
    },
    [token, page.id, store.language_config.primary_locale, recordHistory, persistOrder, actionErrorMessage, tRoot],
  );

  /**
   * "+ add here" inside a container. The target reaches addSection through
   * onAdd's second argument, so nothing needs to be remembered here.
   */
  const addInto = useCallback(() => {}, []);

  // Insert every section of a preset (M6.5) at the end, in order. Nested
  // presets (layout containers) create each parent before its children,
  // then persist the whole tree. One history checkpoint covers the whole
  // batch so undo removes all of them at once.
  const addPreset = useCallback(
    async (presetId: string) => {
      if (!token) return;
      const bodies = presetTreeBodies(presetId, store.language_config.primary_locale);
      if (bodies.length === 0) return;
      recordHistory({ force: true });
      const created: SectionInstance[] = [];
      try {
        // Sequential so the server assigns consecutive positions.
        await createPresetTree(
          bodies,
          async (body, parentId) => {
            const row = await api<SectionInstance>(`/v2/pages/${page.id}/sections`, {
              method: 'POST',
              token,
              body: JSON.stringify({
                section_key: body.section_key,
                settings: body.settings,
                translations: [
                  { locale: store.language_config.primary_locale, content: body.content },
                ],
                ...(parentId ? { parent_id: parentId } : {}),
              }),
            });
            return { ...row, parent_id: row.parent_id ?? parentId };
          },
          created,
        );
      } finally {
        // A later POST may fail after earlier ones succeeded: those sections
        // exist on the server, so keep the local state in sync with them
        // before the error propagates (surfaced like addSection's errors).
        if (created.length > 0) {
          setSections((prev) => [...prev, ...created]);
          setSelectedId(created[0].id);
        }
      }
      if (presetIsNested(bodies)) {
        // Confirm the whole tree (parents + sibling order) in one PUT.
        const createdIds = new Set(created.map((c) => c.id));
        const next = [...sectionsRef.current.filter((s) => !createdIds.has(s.id)), ...created];
        try {
          await persistOrder(next, { forceTree: true });
        } catch (err) {
          setNotice(actionErrorMessage(err));
          return;
        }
      }
      setNotice(tBuilder('presets.addedToast', { count: created.length }));
    },
    [token, page.id, store.language_config.primary_locale, recordHistory, tBuilder, persistOrder, actionErrorMessage],
  );

  /**
   * "Convert to blocks" on a product-page section: the API hides it and
   * builds the Classic product block tree after it (draft only). The
   * returned list replaces the local one and the new row is selected.
   */
  const convertToBlocks = useCallback(
    async (sectionId: string) => {
      if (!token) return;
      recordHistory({ force: true });
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      await flushAutosave();
      const before = sectionsRef.current;
      let list: SectionInstance[];
      try {
        list = await api<SectionInstance[]>(`/v2/pages/${page.id}/convert-product-blocks`, {
          method: 'POST',
          token,
          body: JSON.stringify({ section_id: sectionId }),
        });
      } catch (err) {
        historyRef.current.past.pop();
        syncHistoryFlags();
        throw err;
      }
      if (!Array.isArray(list)) return;
      setSections(list);
      const rowId = newSubtreeRootId(before, list);
      if (rowId) setSelectedId(rowId);
      setNotice(tBuilder('convertBlocks.done'));
    },
    [token, page.id, recordHistory, flushAutosave, syncHistoryFlags, tBuilder],
  );

  /** Deletes a section with its whole subtree (the API cascades to children). */
  const deleteSection = useCallback(
    async (sectionId: string) => {
      if (!token) return;
      const before = sectionsRef.current;
      const removedIds = new Set(collectSubtreeIds(before, sectionId));
      if (removedIds.size === 0) return;
      const parentId = parentIdOf(before, sectionId);
      recordHistory({ force: true });
      try {
        await api(`/v2/pages/sections/${sectionId}`, { method: 'DELETE', token });
      } catch (err) {
        setNotice(actionErrorMessage(err));
        throw err;
      }
      // Pending autosave patches for removed sections would 404 on flush.
      for (const id of removedIds) pendingRef.current.delete(id);
      setSections((prev) => removeSubtree(prev, sectionId));
      // Deleting the selection (or its container) selects the parent, if any.
      setSelectedId((curr) => (curr && removedIds.has(curr) ? parentId : curr));
    },
    [token, recordHistory, actionErrorMessage],
  );

  /**
   * Server-side duplicate of the section and its subtree (placed right after
   * the original among its siblings). Pending edits are flushed first so the
   * copy reflects exactly what the creator sees; the returned list replaces
   * the local one.
   */
  const duplicateSection = useCallback(
    async (sectionId: string) => {
      if (!token) return;
      if (!sectionsRef.current.some((s) => s.id === sectionId)) return;
      recordHistory({ force: true });
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      await flushAutosave();
      const before = sectionsRef.current;
      let list: SectionInstance[];
      try {
        list = await api<SectionInstance[]>(`/v2/pages/sections/${sectionId}/duplicate`, {
          method: 'POST',
          token,
          body: JSON.stringify({}),
        });
      } catch (err) {
        setNotice(actionErrorMessage(err));
        throw err;
      }
      if (!Array.isArray(list)) return;
      // Keep edits typed while the request was in flight: rows that existed
      // before keep their local copy, new rows come from the server.
      const localById = new Map(sectionsRef.current.map((s) => [s.id, s]));
      const merged = list.map((row) => {
        const local = localById.get(row.id);
        return local ? { ...local, parent_id: row.parent_id ?? null, sort_order: row.sort_order } : row;
      });
      setSections(merged);
      const copyId = newSubtreeRootId(before, merged);
      if (copyId) setSelectedId(copyId);
    },
    [token, recordHistory, flushAutosave, actionErrorMessage],
  );

  /**
   * Optimistic structural change: apply `next` locally, persist its order and
   * parents, and roll back (with a friendly message) when the server refuses.
   */
  const applyStructure = useCallback(
    async (next: SectionInstance[], opts: { forceTree?: boolean } = {}) => {
      const prev = sectionsRef.current;
      recordHistory({ force: true });
      setSections(next);
      if (!token) return;
      try {
        await persistOrder(next, opts);
      } catch (err) {
        // Restore the previous structure and drop the checkpoint it created.
        historyRef.current.past.pop();
        syncHistoryFlags();
        setSections(prev);
        setNotice(actionErrorMessage(err));
      }
    },
    [token, recordHistory, persistOrder, syncHistoryFlags, actionErrorMessage],
  );

  /** Legacy flat reorder (display order of every section). Parents are kept. */
  const reorderSections = useCallback(
    async (orderedIds: string[]) => {
      const prev = sectionsRef.current;
      const byId = new Map(prev.map((s) => [s.id, s]));
      const ordered = orderedIds
        .map((id) => byId.get(id))
        .filter((s): s is SectionInstance => !!s);
      // Renumber per sibling group in the given order; parent_id unchanged.
      const nextIndex = new Map<string | null, number>();
      const next = ordered.map((s) => {
        const pid = s.parent_id ?? null;
        const idx = nextIndex.get(pid) ?? 0;
        nextIndex.set(pid, idx + 1);
        return { ...s, sort_order: idx };
      });
      await applyStructure(next);
    },
    [applyStructure],
  );

  /** Moves a section (with its subtree) to a new parent / sibling slot. */
  const moveSectionTo = useCallback(
    async (sectionId: string, target: MoveTarget) => {
      const prev = sectionsRef.current;
      const check = validateMove(prev, sectionId, target);
      if (!check.ok) {
        setNotice(
          tRoot(
            check.reason === 'cycle'
              ? 'errors.PAGE_SECTION_TREE_CYCLE'
              : check.reason === 'too-deep'
                ? 'errors.PAGE_SECTION_TREE_TOO_DEEP'
                : check.reason === 'parent-not-container'
                  ? 'errors.PAGE_SECTION_PARENT_NOT_CONTAINER'
                  : 'errors.PAGE_SECTION_PARENT_INVALID',
          ),
        );
        return;
      }
      const next = moveSectionInTree(prev, sectionId, target);
      if (next === prev) return;
      // A section leaving its container must reach the server through the
      // tree endpoint even when the page ends up flat.
      await applyStructure(next, { forceTree: usesSectionTree(prev) });
    },
    [applyStructure, tRoot],
  );

  /** Move a section one slot up or down among its siblings (keyboard + preview toolbar). */
  const moveSection = useCallback(
    (sectionId: string, delta: -1 | 1) => {
      const target = siblingMoveTarget(sectionsRef.current, sectionId, delta);
      if (!target) return;
      void moveSectionTo(sectionId, target);
    },
    [moveSectionTo],
  );

  /** Selects the container the section sits in (preview toolbar + shortcut). */
  const selectParent = useCallback((sectionId: string) => {
    const pid = parentIdOf(sectionsRef.current, sectionId);
    if (pid) setSelectedId(pid);
  }, []);

  // ── Undo / Redo ─────────────────────────────────────────

  /**
   * Reconcile local + server state to a history snapshot. Content/settings
   * diffs become full PUTs, extra sections are deleted, missing ones are
   * re-created (the server assigns a fresh id, which is remapped through the
   * remaining history so later undo/redo steps keep pointing at it), and the
   * snapshot's order is persisted.
   */
  const applySnapshot = useCallback(
    async (target: SectionInstance[]) => {
      const current = sectionsRef.current;
      const next = cloneSections(target);
      // Optimistic: show the restored state immediately.
      setSections(next);
      setSelectedId((curr) => (curr && next.some((s) => s.id === curr) ? curr : next[0]?.id ?? null));
      if (!token) return;
      // The snapshot is authoritative — drop pending autosave patches.
      pendingRef.current = new Map();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      setSaveState('saving');
      try {
        const currentById = new Map(current.map((s) => [s.id, s]));
        const targetIds = new Set(next.map((s) => s.id));
        const nested = usesSectionTree(current) || usesSectionTree(next);

        // 1. Kept sections that sit inside a container the snapshot drops
        //    would be cascade-deleted with it: lift them to the root first.
        const lifted = survivorsInsideDropped(current, targetIds);
        if (lifted.size > 0) {
          const interim = current.map((s, i) =>
            lifted.has(s.id) ? { ...s, parent_id: null, sort_order: current.length + i } : s,
          );
          await persistOrder(interim, { forceTree: true });
        }

        // 2. Delete what the snapshot drops (top-most only; the API cascades).
        for (const id of topMostDropped(current, targetIds)) {
          await api(`/v2/pages/sections/${id}`, { method: 'DELETE', token });
        }

        // 2b. Put the kept sections where the snapshot has them (parents that
        //     still need re-creating count as root for now), so the depth
        //     checks of the POSTs below see the snapshot's structure.
        const missingIds = new Set(next.filter((s) => !currentById.has(s.id)).map((s) => s.id));
        if (nested && missingIds.size > 0) {
          const kept = next
            .filter((s) => !missingIds.has(s.id))
            .map((s) => (s.parent_id && missingIds.has(s.parent_id) ? { ...s, parent_id: null } : s));
          await persistOrder(kept, { forceTree: true });
        }

        // 3. Re-create missing sections, parents before children, under
        //    their (possibly remapped) parent.
        for (const s of missingInCreateOrder(next, new Set(currentById.keys()))) {
          const created = await api<SectionInstance>(`/v2/pages/${page.id}/sections`, {
            method: 'POST',
            token,
            body: JSON.stringify({
              section_key: s.section_key,
              settings: s.settings,
              translations: s.translations,
              ...(s.parent_id ? { parent_id: s.parent_id } : {}),
            }),
          });
          if (s.is_hidden) {
            await api(`/v2/pages/sections/${created.id}`, {
              method: 'PUT',
              token,
              body: JSON.stringify({ is_hidden: true }),
            });
          }
          // Remap the stale id (and parent_id references) through the target,
          // both history stacks and the selection.
          const oldId = s.id;
          remapSectionId(next, oldId, created.id);
          historyRef.current.past.forEach((snap) => remapSectionId(snap, oldId, created.id));
          historyRef.current.future.forEach((snap) => remapSectionId(snap, oldId, created.id));
          setSelectedId((curr) => (curr === oldId ? created.id : curr));
        }

        // 4. Content / settings / hidden diffs of kept sections.
        for (const s of next) {
          const prev = currentById.get(s.id);
          if (
            prev &&
            JSON.stringify([prev.settings, prev.translations, prev.is_hidden ?? false]) !==
              JSON.stringify([s.settings, s.translations, s.is_hidden ?? false])
          ) {
            await api(`/v2/pages/sections/${s.id}`, {
              method: 'PUT',
              token,
              body: JSON.stringify({
                settings: s.settings,
                is_hidden: s.is_hidden ?? false,
                translations: s.translations,
              }),
            });
          }
        }

        // 5. Re-sync local state (ids may have been remapped) + persist the
        //    snapshot's order and parents.
        if (nested) {
          setSections(cloneSections(next));
          await persistOrder(next, { forceTree: true });
        } else {
          const flat = next.map((s, i) => ({ ...s, sort_order: i }));
          setSections(flat);
          await persistOrder(flat);
        }
        setSaveState('saved');
      } catch (err) {
        setSaveState('error');
        setNotice(actionErrorMessage(err));
      }
    },
    [token, page.id, persistOrder, actionErrorMessage],
  );

  const undo = useCallback(() => {
    const h = historyRef.current;
    const prev = h.past.pop();
    if (!prev) return;
    h.future.push(cloneSections(sectionsRef.current));
    h.lastPushAt = 0;
    syncHistoryFlags();
    void applySnapshot(prev);
  }, [applySnapshot, syncHistoryFlags]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    const nextSnap = h.future.pop();
    if (!nextSnap) return;
    h.past.push(cloneSections(sectionsRef.current));
    h.lastPushAt = 0;
    syncHistoryFlags();
    void applySnapshot(nextSnap);
  }, [applySnapshot, syncHistoryFlags]);

  // ── Keyboard shortcuts ──────────────────────────────────
  // Ctrl/Cmd+Z undo, Ctrl+Shift+Z / Ctrl+Y redo, Ctrl/Cmd+D duplicate,
  // Delete remove, Alt+Arrow move. Form fields keep their native behavior.
  useEffect(() => {
    function isTyping(target: EventTarget | null): boolean {
      const el = target as HTMLElement | null;
      if (!el) return false;
      return (
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable
      );
    }
    function onKeyDown(e: KeyboardEvent) {
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((mod && key === 'z' && e.shiftKey) || (mod && key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }
      if (!selectedId) return;
      if (mod && key === 'd') {
        e.preventDefault();
        duplicateSection(selectedId).catch(() => {});
        return;
      }
      if (e.key === 'Delete') {
        e.preventDefault();
        deleteSection(selectedId).catch(() => {});
        return;
      }
      // Alt+Shift+ArrowUp selects the container the section sits in.
      if (e.altKey && e.shiftKey && e.key === 'ArrowUp') {
        e.preventDefault();
        selectParent(selectedId);
        return;
      }
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        moveSection(selectedId, -1);
        return;
      }
      if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        moveSection(selectedId, 1);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, undo, redo, duplicateSection, deleteSection, moveSection, selectParent]);

  // ── Page translation (one-click machine translation) ────────────────────
  // The dialog persists server-side itself; here we just take the merged
  // sections into local state behind an undo checkpoint.
  const applyTranslatedSections = useCallback(
    (updated: SectionInstance[]) => {
      recordHistory({ force: true });
      setSections(updated);
    },
    [recordHistory],
  );

  // ── Inline editing (double-click a text in the preview) ─────────────────
  // The preview matched the clicked DOM text to a content field and sends its
  // path; we write the new value into the ACTIVE locale (so editing while
  // viewing a secondary locale creates/updates that translation).
  const handleInlineEdit = useCallback(
    (sectionId: string, path: (string | number)[], value: string) => {
      const section = sectionsRef.current.find((s) => s.id === sectionId);
      if (!section || path.length === 0) return;
      const topKey = String(path[0]);
      if (path.length === 1) {
        patchSectionContent(sectionId, activeLocale, { [topKey]: value });
        return;
      }
      // Nested (repeater) edit: start from the displayed content (active
      // locale → primary → first translation with content) so the rest of the
      // items keep what the creator currently sees — including after a
      // primary-locale change left the new locale empty.
      const base = contentBaseFor(section.translations, activeLocale)?.[topKey];
      if (!Array.isArray(base)) return;
      const clonedArr = JSON.parse(JSON.stringify(base)) as unknown[];
      let node: unknown = clonedArr;
      for (let i = 1; i < path.length - 1; i++) {
        node = (node as Record<string | number, unknown> | undefined)?.[path[i]];
      }
      if (node && typeof node === 'object') {
        (node as Record<string | number, unknown>)[path[path.length - 1]] = value;
        patchSectionContent(sectionId, activeLocale, { [topKey]: clonedArr });
      }
    },
    [activeLocale, patchSectionContent, contentBaseFor],
  );

  // ── Preview toolbar actions (floating toolbar inside the iframe) ────────
  const handlePreviewSectionAction = useCallback(
    (sectionId: string, action: string) => {
      switch (action) {
        case 'duplicate':
          duplicateSection(sectionId).catch(() => {});
          break;
        case 'hide':
          toggleHidden(sectionId, true);
          break;
        case 'delete':
          deleteSection(sectionId).catch(() => {});
          break;
        case 'move-up':
          moveSection(sectionId, -1);
          break;
        case 'move-down':
          moveSection(sectionId, 1);
          break;
        case 'select-parent':
          selectParent(sectionId);
          break;
        default:
          break;
      }
    },
    [duplicateSection, toggleHidden, deleteSection, moveSection, selectParent],
  );

  // ── Handlers for the section list + inspector ───────────
  // Errors were already shown as a notice; swallow them here so a click never
  // leaves an unhandled rejection behind.
  const handleDuplicate = useCallback(
    (sectionId: string) => duplicateSection(sectionId).catch(() => {}),
    [duplicateSection],
  );
  const handleDelete = useCallback(
    (sectionId: string) => {
      deleteSection(sectionId).catch(() => {});
    },
    [deleteSection],
  );
  // Accepts an explicit flag (old list rows / inspector) or flips the current one.
  const handleToggleHidden = useCallback(
    (sectionId: string, hidden?: boolean) => {
      const current = sectionsRef.current.find((s) => s.id === sectionId);
      if (!current) return;
      toggleHidden(sectionId, typeof hidden === 'boolean' ? hidden : !current.is_hidden);
    },
    [toggleHidden],
  );
  const handleMove = useCallback(
    (sectionId: string, target: MoveTarget) => {
      void moveSectionTo(sectionId, target);
    },
    [moveSectionTo],
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
    setIsLive(true);
  }, [token, page.id, flushAutosave]);

  // Manually clear the storefront cache. Publishing already triggers this on
  // the server, but the button lets creators force a refresh on demand.
  const flushCache = useCallback(async () => {
    if (!token) return;
    await api('/stores/my/cache/flush', { method: 'POST', token });
  }, [token]);

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
      slug: string | null;
      published_version_id: string | null;
      seo: Record<string, unknown>;
      translations: typeof pageTranslations;
    }>(`/v2/pages/${page.id}`, { token });
    setSections(fresh.sections);
    setPageStatus(fresh.status);
    setPageSlug(fresh.slug);
    setIsLive(!!fresh.published_version_id);
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
      slug: string | null;
      published_version_id: string | null;
      seo: Record<string, unknown>;
      translations: typeof pageTranslations;
    }>(`/v2/pages/${page.id}`, { token });
    setPageStatus(fresh.status);
    setPageSlug(fresh.slug);
    setIsLive(!!fresh.published_version_id);
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

  // Untitled pages fall back to the translated page-type label ("Home",
  // "Header", …) so the builder chrome follows the dashboard language instead
  // of showing hardcoded English literals.
  const knownPageTypes = new Set([
    'HOME', 'STATIC', 'LANDING', 'PRODUCT_TEMPLATE', 'CATALOG_TEMPLATE', 'COLLECTION_TEMPLATE',
    'ABOUT', 'CONTACT',
    'PRIVACY_POLICY', 'TERMS', 'SHIPPING_POLICY', 'RETURN_POLICY',
    'CUSTOM', 'HEADER', 'FOOTER',
  ]);
  const pageTypeKey = (page.type || '').toUpperCase();
  const pageTitle =
    page.translations.find((t) => t.locale === activeLocale)?.title ||
    page.translations.find((t) => t.locale === store.language_config.primary_locale)?.title ||
    (knownPageTypes.has(pageTypeKey)
      ? tBuilder(`pageType.${pageTypeKey}`)
      : pageSlug || tBuilder('untitledPage'));
  // The switcher lists this page with its current slug after a permalink edit.
  const switcherPages = allPages.map((p) => (p.id === page.id && pageSlug ? { ...p, slug: pageSlug } : p));
  // Legal-kind STATIC pages are served at /legal/<slug> on the storefront.
  const legalSlug = page.type === 'STATIC' ? legalSlugForKind(page.static_kind) : null;
  const storeUrl = `${WEB_ORIGIN}/store/${store.slug}`;

  return (
    <div className="h-screen w-full flex flex-col bg-zinc-50">
      {/* "View store" opens with the owner edit-button hand-off. */}
      <StorefrontEditHandoff />
      {/* "URL saved as …-2" after creating the page from the landing-pages list. */}
      <SlugAdjustedNotice />
      <PublishBar
        pageId={page.id}
        pageTitle={pageTitle}
        pageType={page.type}
        pageSlug={pageSlug}
        isLive={isLive}
        status={pageStatus}
        storeUrl={legalSlug ? `${storeUrl}/legal/${legalSlug}` : storeUrl}
        primaryLocale={store.language_config.primary_locale}
        secondaryLocales={store.language_config.secondary_locales}
        activeLocale={activeLocale}
        allPages={switcherPages}
        seo={pageSeo}
        translations={pageTranslations}
        saveState={saveState}
        canUndo={historyFlags.canUndo}
        canRedo={historyFlags.canRedo}
        onUndo={undo}
        onRedo={redo}
        extraActions={
          token ? (
            <TranslatePageDialog
              sections={sections}
              primaryLocale={store.language_config.primary_locale}
              secondaryLocales={store.language_config.secondary_locales}
              token={token}
              onApplied={applyTranslatedSections}
            />
          ) : null
        }
        onLocaleChange={setActiveLocale}
        onBack={() => history.back()}
        onPublish={publishPage}
        onRestored={reloadFromServer}
        onSeoSaved={reloadPageMeta}
        onFlushCache={flushCache}
      />

      {/* Legal pages: review checklist; until published visitors see the standard text. */}
      {legalSlug && (
        <LegalReviewHint
          traderCountry={store.trader_country}
          draftNote={!isLive}
          className="rounded-none border-x-0 border-t-0 px-4"
        />
      )}

      <div className="flex-1 grid grid-cols-[280px_1fr_360px] min-h-0">
        <aside className="border-e bg-white overflow-hidden flex flex-col">
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
                onAddPreset={addPreset}
                onToggleHidden={handleToggleHidden}
                onDuplicate={handleDuplicate}
                onMove={handleMove}
                onAddInto={addInto}
                layoutContainers={layoutContainers}
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
              selectedId={selectedId}
              onSectionClicked={handlePreviewSectionClicked}
              onSectionAction={handlePreviewSectionAction}
              onInlineEdit={handleInlineEdit}
              token={token}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
            </div>
          )}
        </section>

        <aside className="border-s bg-white overflow-hidden">
          <SectionInspector
            section={selected}
            parent={selectedParent}
            locale={activeLocale}
            primaryLocale={store.language_config.primary_locale}
            token={token ?? ''}
            apiBase={API_BASE}
            onPatchSettings={patchSectionSettings}
            onPatchContent={patchSectionContent}
            onDelete={handleDelete}
            onToggleHidden={handleToggleHidden}
            onDuplicate={handleDuplicate}
            onSelectParent={selectParent}
            layoutContainers={layoutContainers}
            onConvertToBlocks={convertToBlocks}
            pageType={page.type}
          />
        </aside>
      </div>

      {notice && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-4 inset-s-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-50 rounded-md bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white shadow-lg"
        >
          {notice}
        </div>
      )}
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
  // Store-content primary locale — kept on the props for callers; the tab
  // labels themselves are dashboard chrome translated via next-intl.
  primaryLocale: string;
}) {
  const t = useTranslations('builder');
  const tabs: { id: LeftMode; label: string; Icon: typeof Layers }[] = [
    { id: 'sections', label: t('sections'), Icon: Layers },
    { id: 'theme', label: t('design'), Icon: Palette },
  ];
  return (
    <div className="flex items-stretch border-b border-zinc-200/80 bg-white shrink-0 relative">
      {tabs.map((tab) => {
        const isActive = mode === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11.5px] font-semibold transition-colors',
              isActive ? 'text-indigo-600' : 'text-zinc-500 hover:text-zinc-900',
            )}
          >
            <tab.Icon className={cn('size-3.5 transition', isActive && 'scale-110')} />
            {tab.label}
            {isActive && <span className="absolute bottom-0 inset-x-2 h-0.5 rounded-t bg-indigo-600" />}
          </button>
        );
      })}
    </div>
  );
}
