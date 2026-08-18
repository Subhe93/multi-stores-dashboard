'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Layers, Loader2, Palette } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { findSectionSchema } from '@/lib/section-schemas';
import { cn } from '@/lib/utils';
import { LivePreview, type LivePreviewHandle } from './LivePreview';
import { SectionInspector } from './SectionInspector';
import { SectionList } from './SectionList';
import { PublishBar } from './PublishBar';
import { TranslatePageDialog } from './TranslatePageDialog';
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
  const tBuilder = useTranslations('builder');
  const previewRef = useRef<LivePreviewHandle>(null);

  const [sections, setSections] = useState<SectionInstance[]>(initialSections);
  const [selectedId, setSelectedId] = useState<string | null>(initialSections[0]?.id ?? null);
  const [activeLocale, setActiveLocale] = useState(store.language_config.primary_locale);
  const [pageStatus, setPageStatus] = useState<'DRAFT' | 'PUBLISHED'>(page.status);
  const [saveState, setSaveState] = useState<SaveState>('idle');

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

  const addSection = useCallback(
    async (sectionKey: string) => {
      if (!token) return;
      recordHistory({ force: true });
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
      recordHistory({ force: true });
      await api(`/v2/pages/sections/${sectionId}`, { method: 'DELETE', token });
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
      setSelectedId((curr) => (curr === sectionId ? null : curr));
    },
    [token],
  );

  const duplicateSection = useCallback(
    async (sectionId: string) => {
      if (!token) return;
      // Local state already carries any unsaved edits, so copying from it makes
      // the duplicate reflect exactly what the creator sees.
      const source = sections.find((s) => s.id === sectionId);
      if (!source) return;
      recordHistory({ force: true });
      const created = await api<SectionInstance>(`/v2/pages/${page.id}/sections`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          section_key: source.section_key,
          settings: source.settings,
          translations: source.translations.map((tr) => ({
            locale: tr.locale,
            content: tr.content,
          })),
        }),
      });
      // CreateSectionDto has no is_hidden — carry the flag over separately.
      if (source.is_hidden) {
        await api(`/v2/pages/sections/${created.id}`, {
          method: 'PUT',
          token,
          body: JSON.stringify({ is_hidden: true }),
        });
      }
      const copy: SectionInstance = { ...created, is_hidden: source.is_hidden };
      // Insert the copy right below its source and persist that order.
      const idx = sections.findIndex((s) => s.id === sectionId);
      const next = [...sections];
      next.splice(idx + 1, 0, copy);
      setSections(next.map((s, i) => ({ ...s, sort_order: i })));
      setSelectedId(copy.id);
      await api(`/v2/pages/${page.id}/sections/sort`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ section_ids: next.map((s) => s.id) }),
      });
    },
    [token, page.id, sections],
  );

  const reorderSections = useCallback(
    async (orderedIds: string[]) => {
      recordHistory({ force: true });
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

  /** Move a section one slot up or down (keyboard + preview toolbar). */
  const moveSection = useCallback(
    (sectionId: string, delta: -1 | 1) => {
      const list = sectionsRef.current;
      const idx = list.findIndex((s) => s.id === sectionId);
      const to = idx + delta;
      if (idx < 0 || to < 0 || to >= list.length) return;
      const ids = list.map((s) => s.id);
      [ids[idx], ids[to]] = [ids[to], ids[idx]];
      void reorderSections(ids);
    },
    [reorderSections],
  );

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
        for (const s of current) {
          if (!targetIds.has(s.id)) {
            await api(`/v2/pages/sections/${s.id}`, { method: 'DELETE', token });
          }
        }
        for (const s of next) {
          const prev = currentById.get(s.id);
          if (!prev) {
            const created = await api<SectionInstance>(`/v2/pages/${page.id}/sections`, {
              method: 'POST',
              token,
              body: JSON.stringify({
                section_key: s.section_key,
                settings: s.settings,
                translations: s.translations,
              }),
            });
            if (s.is_hidden) {
              await api(`/v2/pages/sections/${created.id}`, {
                method: 'PUT',
                token,
                body: JSON.stringify({ is_hidden: true }),
              });
            }
            // Remap the stale id through both history stacks + selection.
            const oldId = s.id;
            s.id = created.id;
            const remap = (snap: SectionInstance[]) =>
              snap.forEach((row) => {
                if (row.id === oldId) row.id = created.id;
              });
            historyRef.current.past.forEach(remap);
            historyRef.current.future.forEach(remap);
            setSelectedId((curr) => (curr === oldId ? created.id : curr));
          } else if (
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
        // Re-sync local state (ids may have been remapped) + persist order.
        setSections(next.map((s, i) => ({ ...s, sort_order: i })));
        await api(`/v2/pages/${page.id}/sections/sort`, {
          method: 'PUT',
          token,
          body: JSON.stringify({ section_ids: next.map((s) => s.id) }),
        });
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    },
    [token, page.id],
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
        void duplicateSection(selectedId);
        return;
      }
      if (e.key === 'Delete') {
        e.preventDefault();
        void deleteSection(selectedId);
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
  }, [selectedId, undo, redo, duplicateSection, deleteSection, moveSection]);

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
          void duplicateSection(sectionId);
          break;
        case 'hide':
          toggleHidden(sectionId, true);
          break;
        case 'delete':
          void deleteSection(sectionId);
          break;
        case 'move-up':
          moveSection(sectionId, -1);
          break;
        case 'move-down':
          moveSection(sectionId, 1);
          break;
        default:
          break;
      }
    },
    [duplicateSection, toggleHidden, deleteSection, moveSection],
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

  // Untitled pages fall back to the translated page-type label ("Home",
  // "Header", …) so the builder chrome follows the dashboard language instead
  // of showing hardcoded English literals.
  const knownPageTypes = new Set([
    'HOME', 'STATIC', 'LANDING', 'PRODUCT_TEMPLATE', 'ABOUT', 'CONTACT',
    'PRIVACY_POLICY', 'TERMS', 'SHIPPING_POLICY', 'RETURN_POLICY',
    'CUSTOM', 'HEADER', 'FOOTER',
  ]);
  const pageTypeKey = (page.type || '').toUpperCase();
  const pageTitle =
    page.translations.find((t) => t.locale === activeLocale)?.title ||
    page.translations.find((t) => t.locale === store.language_config.primary_locale)?.title ||
    (knownPageTypes.has(pageTypeKey)
      ? tBuilder(`pageType.${pageTypeKey}`)
      : page.slug || tBuilder('untitledPage'));

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
                onDuplicate={duplicateSection}
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
            onDuplicate={duplicateSection}
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
