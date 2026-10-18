'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, ArrowLeft, Loader2, Redo2, Save, Send, Trash2, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { alignBox, sendInStack, type AlignKind, type Box } from '@/lib/designer/editorGeometry';
import { HISTORY_LIMIT } from './template-editor/history';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { ApiError } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import { useTransientFlag } from '@/lib/useTransientFlag';
import { loadStoreLocales } from '@/lib/personalization';
import type { DesignElement, DesignStateV1, TemplateSpecV1 } from '@/lib/designer/design-renderer';
import {
  addTemplateVersion,
  deleteTemplate,
  designerFileUrl,
  errorParams,
  getTemplate,
  getTemplateVersion,
  listAssets,
  listFonts,
  publishTemplate,
  specIssuesFromError,
  updateTemplate,
  type DesignerAssetView,
  type DesignerFontView,
  type SpecIssue,
  type TemplateDetail,
} from '@/lib/designer/designer.api';
import {
  cloneSpec,
  moveInStack,
  stackOrder,
  newElementId,
  newImageElement,
  newSlotElement,
  newTextElement,
  rebuildFonts,
  type FontFaceOption,
  type IssueLocation,
} from '@/lib/designer/templateSpec';
import { useDateTimeFormat } from '@/components/importer/ImporterBits';
import { SAMPLE_PHOTO_ID, SAMPLE_PHOTO_SIZE, type PreviewFont } from '@/components/designer/DesignPreviewCanvas';
import { AssetPickerDialog } from '@/components/designer/AssetPickerDialog';
import { TemplateStatusBadge } from '@/components/designer/DesignerBits';
import { elementFieldId } from '@/components/designer/TemplateElementForm';
import { GeneralPanel } from './template-editor/GeneralPanel';
import { BackgroundPanel } from './template-editor/BackgroundPanel';
import { ElementsPanel } from './template-editor/ElementsPanel';
import { VersionsPanel } from './template-editor/VersionsPanel';
import { EditorCanvas } from './template-editor/EditorCanvas';
import { AlignToolbar, type StackMove } from './template-editor/AlignToolbar';
import {
  areaFieldId,
  groupIssues,
  issueTargetId,
  linkedProductCount,
  locatePublishIssue,
  prepareSpec,
  printPxOf,
  type Issue,
} from './template-editor/specIssues';
import { elementsUpdater, useTemplateEditorState, type SideTab, type TemplateEditorPatch } from './template-editor/useTemplateEditorState';

const BACK_HREF = '/creator/designer?tab=templates';

/** Rank of an element from the bottom of the stack (0 = drawn first). */
const stackPos = (els: DesignElement[], index: number) => stackOrder(els).reverse().indexOf(index);
const FONTS_HREF = '/creator/designer?tab=assets';
const PRODUCTS_HREF = '/creator/products/own';

/**
 * Template editor (M4.2 §8.2): live preview with the renderer mirror on the
 * left, a Shopify-style side panel on the right (general, background,
 * elements with z-order, versions — `template-editor/*Panel`). Saving creates
 * a new immutable version; "Publish" makes the latest version the one new
 * designs use. Validation issues (client `prepareSpec` + server
 * DESIGNER_TEMPLATE_INVALID paths) open the right tab and focus the field.
 * State lives in the `useTemplateEditorState` reducer (E18); in-app links
 * ask before leaving with unsaved changes (E9).
 */
export function TemplateEditor({ id, token }: { id: string; token: string }) {
  const t = useTranslations('creator.designer.editor');
  const tc = useTranslations('creator.designer.common');
  const tr = useTranslations('creator.designer.editor.rules');
  const locale = useLocale();
  const router = useRouter();
  const describeError = useApiError();
  const formatDate = useDateTimeFormat();
  const [saved, flashSaved] = useTransientFlag();

  const [state, dispatch] = useTemplateEditorState();
  const {
    detail, loadError, spec, baseJson, name, sizeDrafts, sideTab, selected, issues, busy, actionError, picker,
    confirmDelete, linkedCount, loadingVersion, previewPrint, samplePhoto, sampleTexts, previewProblems, leaveTo,
    past, future,
  } = state;
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  /**
   * The element just removed (confirm-free remove; undo restores it). `depth`
   * is the history length right after the removal: the banner's Undo only
   * makes sense while the removal is still the latest step.
   */
  const [removed, setRemoved] = useState<{ name: string; depth: number } | null>(null);
  const removedName = removed !== null && removed.depth === past.length ? removed.name : null;
  const patch = useCallback((p: TemplateEditorPatch) => dispatch({ type: 'patch', patch: p }), [dispatch]);

  // Library data (assets, fonts) and the store locales: loaded once, not edited.
  const [assets, setAssets] = useState<DesignerAssetView[]>([]);
  const [fonts, setFonts] = useState<DesignerFontView[]>([]);
  const [locales, setLocales] = useState<string[]>([locale]);
  const [primaryLocale, setPrimaryLocale] = useState(locale);

  const adopt = useCallback((d: TemplateDetail) => dispatch({ type: 'adopt', detail: d }), [dispatch]);

  const loadLibrary = useCallback(() => {
    listAssets(token, { limit: 200 })
      .then((res) => setAssets(res.items))
      .catch(() => setAssets([]));
    listFonts(token)
      .then((list) => setFonts(Array.isArray(list) ? list : []))
      .catch(() => setFonts([]));
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    getTemplate(token, id)
      .then((d) => {
        if (!cancelled) adopt(d);
      })
      .catch((err) => {
        if (!cancelled) patch({ loadError: describeError(err) });
      });
    loadLibrary();
    loadStoreLocales(token)
      .then(({ primary, locales: list }) => {
        if (cancelled) return;
        setPrimaryLocale(primary);
        setLocales(list);
      })
      .catch(() => {
        // Labels then use the dashboard locale only.
      });
    return () => {
      cancelled = true;
    };
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id, adopt, loadLibrary]);

  const dirtySpec = !!spec && JSON.stringify(spec) !== baseJson;
  const dirtyName = !!detail && name.trim() !== detail.name;
  const dirty = dirtySpec || dirtyName;

  // Warn before leaving with unsaved changes (browser navigation / reload).
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // E9: in-app links are intercepted while dirty and confirmed in a dialog.
  const onLeave = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!dirty || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    patch({ leaveTo: href });
  };
  const confirmLeave = () => {
    if (!leaveTo) return;
    const href = leaveTo;
    patch({ leaveTo: null });
    router.push(href);
  };

  const assetUrls = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of assets) {
      const u = designerFileUrl(a.url);
      if (u) map[a.id] = u;
    }
    return map;
  }, [assets]);
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const fontOptions: FontFaceOption[] = useMemo(
    () => fonts.filter((f) => !f.superseded).map((f) => ({ asset_id: f.id, family: f.family, weight: f.weight, style: f.style })),
    [fonts],
  );

  const previewFonts: PreviewFont[] = useMemo(() => {
    if (!spec) return [];
    const byId = new Map(fonts.map((f) => [f.id, f]));
    const { fonts: refs } = rebuildFonts(spec, fontOptions);
    return refs
      .map((r) => {
        const f = byId.get(r.asset_id);
        const url = designerFileUrl(f?.url);
        return url ? { family: r.family, weight: r.weight, style: r.style, url } : null;
      })
      .filter((x): x is PreviewFont => !!x);
  }, [spec, fonts, fontOptions]);

  const elements = useMemo(() => spec?.surfaces[0]?.elements ?? [], [spec]);

  const previewState: DesignStateV1 = useMemo(() => {
    const photos: DesignStateV1['photos'] = {};
    if (samplePhoto) {
      for (const el of elements) {
        if (el.type !== 'image_slot') continue;
        photos[el.id] = { asset_id: SAMPLE_PHOTO_ID, ...SAMPLE_PHOTO_SIZE, adj: { ...el.default_adj } };
      }
    }
    return { v: 1, texts: sampleTexts, photos };
  }, [elements, samplePhoto, sampleTexts]);

  const elementName = (el: DesignElement) => {
    if (el.type === 'image') return t('types.image');
    const label = el.label?.[primaryLocale] || Object.values(el.label ?? {}).find(Boolean);
    return label || el.id;
  };
  const sel = selected !== null && selected < elements.length ? selected : null;

  // ─── Mutations of the working spec ───────────────────────────────────────

  const updateSpec = (fn: (s: TemplateSpecV1) => TemplateSpecV1, coalesce?: string) => dispatch({ type: 'updateSpec', fn, coalesce });
  const setElements = (fn: (els: DesignElement[]) => DesignElement[], coalesce?: string) => updateSpec(elementsUpdater(fn), coalesce);
  const undo = useCallback(() => dispatch({ type: 'undo' }), [dispatch]);
  const redo = useCallback(() => dispatch({ type: 'redo' }), [dispatch]);
  const sealHistory = () => dispatch({ type: 'sealHistory' });
  const clearIssues = (pred: (i: Issue) => boolean) => dispatch({ type: 'clearIssues', pred });
  const setSelected = (index: number | null) => patch({ selected: index });

  const updateElement = (index: number, next: DesignElement) => {
    // Typing in the form coalesces per element + changed field (one undo step per edit run).
    const prev = elements[index];
    const changed = prev ? (Object.keys(next) as (keyof DesignElement)[]).find((k) => prev[k] !== next[k]) : undefined;
    setElements((els) => els.map((e, i) => (i === index ? next : e)), changed ? `form:${index}:${String(changed)}` : undefined);
    clearIssues((i) => i.loc.elementIndex === index);
  };

  /** Canvas gesture: geometry of one element (x, y, w, h, rot). */
  const changeBox = (index: number, box: Box, coalesce: string) => {
    setElements((els) => els.map((e, i) => (i === index ? { ...e, x: box.x, y: box.y, w: box.w, h: box.h, rot: box.rot } : e)), coalesce);
    clearIssues((i) => i.loc.elementIndex === index && i.loc.field === 'geometry');
  };

  const alignSelected = (kind: AlignKind) => {
    if (sel === null || !spec) return;
    const el = elements[sel];
    const box = alignBox({ x: el.x, y: el.y, w: el.w, h: el.h, rot: el.rot || 0 }, spec, kind);
    changeBox(sel, box, `align:${el.id}:${kind}:${Date.now()}`);
  };

  const stackSelected = (move: StackMove) => {
    if (sel === null) return;
    if (move === 'front' || move === 'back') setElements((els) => sendInStack(els, sel, move));
    else setElements((els) => moveInStack(els, sel, move === 'forward' ? 'up' : 'down'));
  };

  const addElement = (kind: 'text' | 'slot') => {
    if (!spec) return;
    const el = kind === 'text' ? newTextElement(spec, fontOptions[0] ?? null, primaryLocale) : newSlotElement(spec, primaryLocale);
    setElements((els) => [...els, el]);
    setSelected(elements.length);
  };

  const removeElement = (index: number) => {
    const el = elements[index];
    if (!el) return;
    setElements((els) => els.filter((_, i) => i !== index));
    patch({ selected: null, issues: [] });
    // The removal push (keyless) always adds one step.
    setRemoved({ name: elementName(el), depth: Math.min(past.length + 1, HISTORY_LIMIT) });
  };
  useEffect(() => {
    if (removed === null) return;
    const id = window.setTimeout(() => setRemoved(null), 8000);
    return () => window.clearTimeout(id);
  }, [removed]);

  /** Double-click on a text element: open its form and focus the default text. */
  const editText = (index: number) => {
    patch({ sideTab: 'elements', selected: index });
    window.setTimeout(() => {
      const node = document.getElementById(elementFieldId(index, 'default_text')) as HTMLInputElement | null;
      if (!node) return;
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      node.focus({ preventScroll: true });
      node.select?.();
    }, 80);
  };

  const duplicateElement = (index: number) => {
    if (!spec) return;
    const src = elements[index];
    const prefix = src.type === 'text' ? 'txt' : src.type === 'image_slot' ? 'slot' : 'img';
    const copy = { ...JSON.parse(JSON.stringify(src)), id: newElementId(spec, prefix), x: src.x + 10, y: src.y + 10 } as DesignElement;
    setElements((els) => [...els, copy]);
    setSelected(elements.length);
  };

  const onPicked = (a: DesignerAssetView) => {
    if (!picker || !spec) return;
    setAssets((prev) => (prev.some((x) => x.id === a.id) ? prev : [a, ...prev]));
    const ref = { asset_id: a.id, width: a.width, height: a.height };
    if (picker.target === 'web' || picker.target === 'print') {
      const key = picker.target;
      updateSpec((s) => {
        s.surfaces[0].background[key] = ref;
        return s;
      });
      clearIssues((i) => i.loc.area === 'background');
    } else if (picker.target === 'new-deco') {
      setElements((els) => [...els, newImageElement(spec, a)]);
      setSelected(elements.length);
    } else {
      const index = picker.target;
      setElements((els) => els.map((e, i) => (i === index && e.type === 'image' ? { ...e, asset: ref } : e)));
      clearIssues((i) => i.loc.elementIndex === index);
    }
  };

  // ─── Validation / jump ───────────────────────────────────────────────────

  const issueText = (i: Issue): string => (tr.has(i.rule) ? tr(i.rule) : tr('generic', { rule: i.rule }));

  const jumpTo = (loc: IssueLocation) => {
    patch({ sideTab: loc.area, ...(loc.elementIndex !== undefined ? { selected: loc.elementIndex } : {}) });
    const target = issueTargetId(loc);
    // Wait for the tab / element form to render before focusing.
    window.setTimeout(() => {
      const node = document.getElementById(target) ?? (loc.elementIndex !== undefined ? document.getElementById(elementFieldId(loc.elementIndex, 'label')) : null);
      if (!node) return;
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusable = node.matches('input,button,select,textarea,[tabindex]') ? node : node.querySelector<HTMLElement>('input,button,select,textarea');
      (focusable as HTMLElement | null)?.focus({ preventScroll: true });
    }, 80);
  };

  const showIssues = (list: SpecIssue[], s: TemplateSpecV1 | null) => {
    const mapped: Issue[] = list.map((i) => ({ ...i, loc: locatePublishIssue(i, s, fontOptions) }));
    patch({ issues: mapped });
    if (mapped[0]) jumpTo(mapped[0].loc);
  };

  /** The spec as it will be sent (fonts rebuilt) plus client-side issues. */
  const prepare = (): { spec: TemplateSpecV1 | null; issues: SpecIssue[] } =>
    spec ? prepareSpec(spec, name, fontOptions, cloneSpec) : { spec: null, issues: [] };

  const save = async () => {
    if (!detail || !spec || busy) return;
    patch({ actionError: null });
    const prepared = prepare();
    if (prepared.issues.length) {
      const nameIssue = prepared.issues.find((i) => i.path === 'name');
      if (nameIssue) {
        patch({ issues: [{ ...nameIssue, loc: { area: 'general', field: 'name' } }] });
        jumpTo({ area: 'general', field: 'name' });
        return;
      }
      showIssues(prepared.issues, prepared.spec);
      return;
    }
    patch({ busy: 'save' });
    try {
      let next = detail;
      if (dirtyName) next = await updateTemplate(token, detail.id, { name: name.trim() });
      if (dirtySpec && prepared.spec) {
        await addTemplateVersion(token, detail.id, prepared.spec);
        next = await getTemplate(token, detail.id);
      }
      adopt(next);
      patch({ issues: [] });
      flashSaved();
    } catch (err) {
      const list = specIssuesFromError(err);
      if (list.length) showIssues(list, prepared.spec);
      else patch({ actionError: describeError(err) });
    } finally {
      patch({ busy: null });
    }
  };

  // Page-wide shortcuts: Ctrl/Cmd+S saves, Ctrl/Cmd+Z / Shift+Z / Y undo and
  // redo (inside text fields undo / redo stay with the browser; none while a
  // dialog of the editor is open or an action is running).
  const dialogOpen = !!picker || confirmDelete || leaveTo !== null;
  const shortcutsRef = useRef<{ save: () => void; blocked: boolean }>({ save: () => {}, blocked: false });
  shortcutsRef.current = {
    save: () => {
      if (dirty && !busy) void save();
    },
    blocked: dialogOpen || !!busy,
  };
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (shortcutsRef.current.blocked) return;
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        shortcutsRef.current.save();
        return;
      }
      const target = e.target as HTMLElement | null;
      const inField = !!target && (target.matches('input, textarea, select, [contenteditable="true"]') || target.isContentEditable);
      if (inField) return;
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const publish = async (versionId: string) => {
    if (!detail || busy) return;
    patch({ busy: 'publish', actionError: null, linkedCount: null });
    try {
      adopt(await publishTemplate(token, detail.id, versionId));
      patch({ issues: [] });
      flashSaved();
    } catch (err) {
      const list = specIssuesFromError(err);
      if (list.length) showIssues(list, spec);
      else patch({ actionError: describeError(err) });
    } finally {
      patch({ busy: null });
    }
  };

  const setStatus = async (status: 'ARCHIVED' | 'PUBLISHED' | 'DRAFT') => {
    if (!detail || busy) return;
    patch({ busy: 'status', actionError: null, linkedCount: null });
    try {
      const next = await updateTemplate(token, detail.id, { status });
      patch({ detail: next });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DESIGNER_TEMPLATE_LINKED') {
        patch({ linkedCount: linkedProductCount(errorParams(err), detail.products.length) });
      } else {
        patch({ actionError: describeError(err) });
      }
    } finally {
      patch({ busy: null });
    }
  };

  const remove = async () => {
    if (!detail || busy) return;
    patch({ busy: 'delete', actionError: null });
    try {
      await deleteTemplate(token, detail.id);
      router.push(BACK_HREF);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DESIGNER_TEMPLATE_IN_USE') {
        const p = errorParams(err);
        patch({ confirmDelete: false, actionError: t('deleteInUse', { products: Number(p.products ?? 0), designs: Number(p.designs ?? 0), orders: Number(p.orders ?? 0) }) });
      } else {
        patch({ confirmDelete: false, actionError: describeError(err) });
      }
    } finally {
      patch({ busy: null });
    }
  };

  const loadVersion = async (versionId: string) => {
    if (!detail) return;
    patch({ loadingVersion: versionId, actionError: null });
    try {
      const v = await getTemplateVersion(token, detail.id, versionId);
      dispatch({ type: 'loadSpec', spec: v.spec });
    } catch (err) {
      patch({ actionError: describeError(err) });
    } finally {
      patch({ loadingVersion: null });
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="space-y-4">
        <Link href={BACK_HREF} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4 rtl:rotate-180" /> {t('back')}
        </Link>
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
      </div>
    );
  }
  if (!detail || !spec) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const bg = spec.surfaces[0].background;
  const latest = detail.latest_version;
  const latestIsCurrent = !!latest && latest.id === detail.current_version_id;
  const liveVersion = detail.versions.find((v) => v.current) ?? null;
  const grouped = groupIssues(issues, issueText);
  const printPx = printPxOf(spec);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Link href={BACK_HREF} onClick={(e) => onLeave(e, BACK_HREF)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5 rtl:rotate-180" /> {t('back')}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold">{detail.name}</h1>
            <TemplateStatusBadge status={detail.status} />
            {detail.source === 'npp' && <Badge variant="outline">NPP</Badge>}
            {latest && (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                  latestIsCurrent ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}
                title={latestIsCurrent ? t('statusLiveHint') : t('statusDraftHint')}
              >
                {latestIsCurrent
                  ? t('statusLive', { version: latest.version })
                  : liveVersion
                    ? t('statusDraft', { version: latest.version, live: liveVersion.version })
                    : t('statusNeverPublished', { version: latest.version })}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saved && <span className="text-xs font-medium text-emerald-600">{t('saved')}</span>}
          {dirty && <span className="text-xs text-amber-700">{t('unsaved')}</span>}
          <div className="inline-flex items-center rounded-md border bg-white">
            <Button type="button" variant="ghost" size="icon" className="size-8 pointer-coarse:size-11" disabled={!canUndo} onClick={undo} title={t('undo')} aria-label={t('undo')}>
              <Undo2 className="size-4 rtl:-scale-x-100" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-8 pointer-coarse:size-11" disabled={!canRedo} onClick={redo} title={t('redo')} aria-label={t('redo')}>
              <Redo2 className="size-4 rtl:-scale-x-100" />
            </Button>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={!dirty || !!busy} onClick={save} title={t('saveShortcut')}>
            {busy === 'save' ? <Loader2 className="animate-spin" /> : <Save />} {t('saveVersion')}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!latest || dirty || latestIsCurrent || !!busy}
            title={dirty ? t('saveBeforePublish') : undefined}
            onClick={() => latest && publish(latest.id)}
          >
            {busy === 'publish' ? <Loader2 className="animate-spin" /> : <Send />} {t('publish')}
          </Button>
        </div>
      </div>

      {/* Saved but not live: one prominent step left. */}
      {latest && !latestIsCurrent && !dirty && detail.status !== 'ARCHIVED' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <Send className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            {liveVersion ? t('publishNowBody', { version: latest.version, live: liveVersion.version }) : t('publishNowBodyFirst', { version: latest.version })}
          </span>
          <Button type="button" size="sm" className="max-sm:min-h-11" disabled={!!busy} onClick={() => publish(latest.id)}>
            {busy === 'publish' ? <Loader2 className="animate-spin" /> : <Send />} {t('publishNow')}
          </Button>
        </div>
      )}

      {removedName !== null && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border bg-zinc-50 p-2.5 text-sm" role="status">
          <span className="min-w-0 flex-1">{t('removedElement', { name: removedName })}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="max-sm:min-h-11"
            onClick={() => {
              undo();
              setRemoved(null);
            }}
          >
            <Undo2 className="rtl:-scale-x-100" /> {t('undo')}
          </Button>
        </div>
      )}

      {actionError && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {linkedCount !== null && (
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 flex-1">{t('linkedProducts', { count: linkedCount })}</span>
          <span className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="max-sm:min-h-11"
              onClick={() => {
                patch({ sideTab: 'general' });
                window.setTimeout(() => {
                  document.getElementById(areaFieldId('general', 'products'))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 80);
              }}
            >
              {t('linkedShow')}
            </Button>
            <Link href={PRODUCTS_HREF} onClick={(e) => onLeave(e, PRODUCTS_HREF)} className={buttonVariants({ size: 'sm', variant: 'ghost', className: 'max-sm:min-h-11' })}>
              {t('linkedOpenProducts')}
            </Link>
          </span>
        </div>
      )}

      {issues.length > 0 && (
        <div className="space-y-1.5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="flex items-center gap-2 font-medium">
            <AlertCircle className="size-4 shrink-0" />
            {t('issuesTitle', { count: issues.length })}
          </p>
          <ul className="space-y-1 ps-6 text-xs">
            {issues.slice(0, 8).map((i, n) => (
              <li key={n} className="list-disc">
                <button type="button" className="text-start underline-offset-2 hover:underline" onClick={() => jumpTo(i.loc)}>
                  {i.loc.elementIndex !== undefined && elements[i.loc.elementIndex]
                    ? `${elementName(elements[i.loc.elementIndex])}: `
                    : i.loc.area === 'background'
                      ? `${t('tabs.background')}: `
                      : ''}
                  {issueText(i)}
                </button>
              </li>
            ))}
          </ul>
          {issues.some((i) => i.rule === 'missing_font') && (
            <p className="ps-6 text-xs">
              <Link href={FONTS_HREF} onClick={(e) => onLeave(e, FONTS_HREF)} className="font-medium underline underline-offset-2">
                {t('openFonts')}
              </Link>
            </p>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_440px]">
        {/* Preview */}
        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <Card className="shadow-none">
            <CardContent className="space-y-3 pt-4">
              <EditorCanvas
                spec={spec}
                state={previewState}
                mode={previewPrint ? 'print' : 'edit'}
                assetUrls={assetUrls}
                fonts={previewFonts}
                locale={primaryLocale}
                emptySlotText={t('emptySlot')}
                onReport={(r) => dispatch({ type: 'previewReport', missing: r.missing, fonts: r.fontsFailed })}
                selected={sel}
                elementName={elementName}
                onSelect={(i) => {
                  setSelected(i);
                  if (i !== null && sideTab !== 'elements') patch({ sideTab: 'elements' });
                }}
                onChangeBox={changeBox}
                onGestureEnd={sealHistory}
                onEditText={editText}
                onDelete={removeElement}
                onDuplicate={duplicateElement}
                toolbarStart={
                  <>
                    <div className="inline-flex rounded-md border bg-zinc-50 p-0.5" role="radiogroup" aria-label={t('previewBackground')}>
                      {(['web', 'print'] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={previewPrint === (k === 'print')}
                          onClick={() => patch({ previewPrint: k === 'print' })}
                          className={`rounded px-2.5 py-1 text-xs pointer-coarse:min-h-11 ${previewPrint === (k === 'print') ? 'bg-white font-medium shadow-sm' : 'text-muted-foreground'}`}
                        >
                          {t(k === 'web' ? 'previewWeb' : 'previewPrint')}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                      <ToggleSwitch checked={samplePhoto} onChange={(v) => patch({ samplePhoto: v })} label={t('samplePhoto')} />
                      {t('samplePhoto')}
                    </label>
                  </>
                }
              >
                {sel !== null && elements[sel] && (
                  <AlignToolbar
                    name={elementName(elements[sel])}
                    locked={elements[sel].locked}
                    canForward={stackPos(elements, sel) < elements.length - 1}
                    canBackward={stackPos(elements, sel) > 0}
                    onAlign={alignSelected}
                    onStack={stackSelected}
                    onDuplicate={() => duplicateElement(sel)}
                    onRemove={() => removeElement(sel)}
                  />
                )}
              </EditorCanvas>
              <p className="text-center text-[11px] text-muted-foreground">
                {t('previewNote', { width: spec.width, height: spec.height, pw: printPx.w, ph: printPx.h })}
              </p>
              {(previewProblems.fonts.length > 0 || previewProblems.missing.length > 0) && (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                  {previewProblems.fonts.length > 0 && t('previewFontsFailed', { fonts: previewProblems.fonts.join(', ') })}{' '}
                  {previewProblems.missing.length > 0 && t('previewMissing', { count: previewProblems.missing.length })}
                </p>
              )}
            </CardContent>
          </Card>
          {elements.some((e) => e.type === 'text' && e.editable) && (
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t('sampleTexts')}</CardTitle>
                <p className="text-xs text-muted-foreground">{t('sampleTextsHint')}</p>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {elements.map((el) =>
                  el.type === 'text' && el.editable ? (
                    <div key={el.id} className="space-y-1">
                      <Label className="text-[11px] font-normal text-muted-foreground">{elementName(el)}</Label>
                      <Input
                        className="h-8 text-xs"
                        value={sampleTexts[el.id] ?? ''}
                        placeholder={el.default_text}
                        onChange={(e) => dispatch({ type: 'sampleText', id: el.id, value: e.target.value })}
                      />
                    </div>
                  ) : null,
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-3">
          <Tabs value={sideTab} onValueChange={(v) => patch({ sideTab: String(v) as SideTab })}>
            <TabsList variant="line" className="w-full justify-start rounded-none border-b px-0">
              {(['general', 'background', 'elements', 'versions'] as const).map((k) => (
                <TabsTrigger key={k} value={k} className="flex-none px-3">
                  {t(`tabs.${k}`)}
                  {k !== 'versions' && grouped.count(k) > 0 && (
                    <span className="ms-1 rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-700">{grouped.count(k)}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {sideTab === 'general' && (
            <GeneralPanel
              detail={detail}
              name={name}
              sizeDrafts={sizeDrafts}
              printPx={printPx}
              generalIssues={grouped.general}
              issueText={issueText}
              primaryLocale={primaryLocale}
              busy={!!busy}
              onName={(value) => {
                patch({ name: value });
                clearIssues((i) => i.rule === 'name_required');
              }}
              onSize={(key, value) => dispatch({ type: 'sizeDraft', key, value })}
              onStatus={setStatus}
              onDelete={() => patch({ confirmDelete: true })}
              onLeave={onLeave}
            />
          )}

          {sideTab === 'background' && (
            <BackgroundPanel
              spec={spec}
              assetById={assetById}
              assetUrls={assetUrls}
              printPx={printPx}
              bgIssues={grouped.background}
              onUpdateSpec={updateSpec}
              onPick={(key) => patch({ picker: { kind: key === 'web' ? 'TEMPLATE_BG_WEB' : 'TEMPLATE_BG_PRINT', target: key } })}
            />
          )}

          {sideTab === 'elements' && (
            <ElementsPanel
              elements={elements}
              selected={sel}
              issues={issues}
              elementIssues={grouped.element}
              elementName={elementName}
              fontOptions={fontOptions}
              locales={locales}
              assetUrls={assetUrls}
              onAdd={addElement}
              onAddDecoration={() => patch({ picker: { kind: 'TEMPLATE_DECO', target: 'new-deco' } })}
              onSelect={setSelected}
              onMove={(index, dir) => setElements((els) => moveInStack(els, index, dir))}
              onChange={updateElement}
              onDuplicate={duplicateElement}
              onRemove={removeElement}
              onPickImage={(index) => patch({ picker: { kind: 'TEMPLATE_DECO', target: index } })}
              onLeave={onLeave}
            />
          )}

          {sideTab === 'versions' && (
            <VersionsPanel
              versions={detail.versions}
              busy={!!busy}
              loadingVersion={loadingVersion}
              formatDate={formatDate}
              onLoad={loadVersion}
              onPublish={publish}
            />
          )}
        </div>
      </div>

      {picker && (
        <AssetPickerDialog
          open={!!picker}
          onOpenChange={(o) => {
            if (!o) patch({ picker: null });
          }}
          token={token}
          kind={picker.kind}
          templateId={detail.id}
          currentId={
            picker.target === 'web' || picker.target === 'print'
              ? bg[picker.target]?.asset_id ?? null
              : typeof picker.target === 'number'
                ? (() => {
                    const el = elements[picker.target];
                    return el?.type === 'image' ? el.asset.asset_id : null;
                  })()
                : null
          }
          onPick={onPicked}
        />
      )}

      <Dialog open={confirmDelete} onOpenChange={(o) => patch({ confirmDelete: o })}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteBody', { name: detail.name })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => patch({ confirmDelete: false })}>
              {tc('cancel')}
            </Button>
            <Button type="button" variant="destructive" disabled={busy === 'delete'} onClick={remove}>
              {busy === 'delete' ? <Loader2 className="animate-spin" /> : <Trash2 />} {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* E9: leave guard for in-app links while dirty */}
      <Dialog open={leaveTo !== null} onOpenChange={(o) => { if (!o) patch({ leaveTo: null }); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('leaveTitle')}</DialogTitle>
            <DialogDescription>{t('leaveBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => patch({ leaveTo: null })}>
              {tc('cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={confirmLeave}>
              {t('leaveConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
