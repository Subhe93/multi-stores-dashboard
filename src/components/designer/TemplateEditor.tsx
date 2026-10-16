'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Archive,
  ArchiveRestore,
  Copy,
  ImageIcon,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
  Type,
  UserSquare,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { ApiError } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import { useTransientFlag } from '@/lib/useTransientFlag';
import { loadStoreLocales } from '@/lib/personalization';
import { validateSpec, type DesignElement, type DesignStateV1, type TemplateSpecV1 } from '@/lib/designer/design-renderer';
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
  type TemplateAssetKind,
  type TemplateDetail,
} from '@/lib/designer/designer.api';
import {
  cloneSpec,
  ELEMENT_ID_RE,
  locateSpecIssue,
  moveInStack,
  newElementId,
  newImageElement,
  newSlotElement,
  newTextElement,
  rebuildFonts,
  stackOrder,
  type EditorArea,
  type FontFaceOption,
  type IssueLocation,
} from '@/lib/designer/templateSpec';
import { useDateTimeFormat } from '@/components/importer/ImporterBits';
import { DesignPreviewCanvas, SAMPLE_PHOTO_ID, SAMPLE_PHOTO_SIZE, type PreviewFont } from '@/components/designer/DesignPreviewCanvas';
import { AssetPickerDialog } from '@/components/designer/AssetPickerDialog';
import { TemplateElementForm, elementFieldId } from '@/components/designer/TemplateElementForm';
import { FieldError, TemplateStatusBadge, stretchDpi } from '@/components/designer/DesignerBits';

type SideTab = EditorArea | 'versions';

interface Issue {
  loc: IssueLocation;
  rule: string;
  path: string;
}

const PRINT_PX_PER_MM = 6;

/**
 * Linked product count of a DESIGNER_TEMPLATE_LINKED body: `params.products`
 * is a count or a list; `product_ids` is an optional list.
 */
function linkedProductCount(params: Record<string, unknown>, fallback: number): number {
  const p = params.products;
  if (typeof p === 'number' && Number.isFinite(p)) return p;
  if (Array.isArray(p)) return p.length;
  if (Array.isArray(params.product_ids)) return params.product_ids.length;
  return fallback;
}

/** DOM id of a background / general field. */
const areaFieldId = (area: 'bg' | 'general', field: string) => `dz-${area}-${field}`;

/**
 * Template editor (M4.2 §8.2): live preview with the renderer mirror on the
 * left, a Shopify-style side panel on the right (general, background,
 * elements with z-order, versions). Saving creates a new immutable version;
 * "Publish" makes the latest version the one new designs use. Validation
 * issues (client `validateSpec` + server DESIGNER_TEMPLATE_INVALID paths)
 * open the right tab and focus the field.
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

  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [spec, setSpec] = useState<TemplateSpecV1 | null>(null);
  const [baseJson, setBaseJson] = useState('');
  const [name, setName] = useState('');
  const [assets, setAssets] = useState<DesignerAssetView[]>([]);
  const [fonts, setFonts] = useState<DesignerFontView[]>([]);
  const [locales, setLocales] = useState<string[]>([locale]);
  const [primaryLocale, setPrimaryLocale] = useState(locale);

  const [sideTab, setSideTab] = useState<SideTab>('elements');
  const [selected, setSelected] = useState<number | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [busy, setBusy] = useState<'save' | 'publish' | 'status' | 'delete' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ kind: TemplateAssetKind; target: 'web' | 'print' | 'new-deco' | number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** 409 DESIGNER_TEMPLATE_LINKED: products still linked when archiving / unpublishing. */
  const [linkedCount, setLinkedCount] = useState<number | null>(null);
  const [loadingVersion, setLoadingVersion] = useState<string | null>(null);

  // Preview options.
  const [previewPrint, setPreviewPrint] = useState(false);
  const [samplePhoto, setSamplePhoto] = useState(true);
  const [sampleTexts, setSampleTexts] = useState<Record<string, string>>({});
  const [previewProblems, setPreviewProblems] = useState<{ missing: string[]; fonts: string[] }>({ missing: [], fonts: [] });

  const adopt = useCallback((d: TemplateDetail) => {
    setDetail(d);
    setName(d.name);
    const s = d.latest_version?.spec ?? d.current_spec;
    if (s) {
      setSpec(cloneSpec(s));
      setBaseJson(JSON.stringify(s));
    }
  }, []);

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
        if (!cancelled) setLoadError(describeError(err));
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

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

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

  // ─── Mutations of the working spec ───────────────────────────────────────

  const updateSpec = (fn: (s: TemplateSpecV1) => TemplateSpecV1) => {
    setSpec((prev) => (prev ? fn(cloneSpec(prev)) : prev));
  };
  const setElements = (fn: (els: DesignElement[]) => DesignElement[]) =>
    updateSpec((s) => {
      s.surfaces[0].elements = fn(s.surfaces[0].elements);
      return s;
    });

  // Issues are cleared field by field as the creator edits.
  const clearIssues = (pred: (i: Issue) => boolean) => setIssues((prev) => (prev.some(pred) ? prev.filter((i) => !pred(i)) : prev));

  const updateElement = (index: number, next: DesignElement) => {
    setElements((els) => els.map((e, i) => (i === index ? next : e)));
    clearIssues((i) => i.loc.elementIndex === index);
  };

  const addElement = (kind: 'text' | 'slot') => {
    if (!spec) return;
    const el = kind === 'text' ? newTextElement(spec, fontOptions[0] ?? null, primaryLocale) : newSlotElement(spec, primaryLocale);
    setElements((els) => [...els, el]);
    setSelected(elements.length);
  };

  const removeElement = (index: number) => {
    setElements((els) => els.filter((_, i) => i !== index));
    setSelected(null);
    setIssues([]);
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
    setSideTab(loc.area);
    if (loc.elementIndex !== undefined) setSelected(loc.elementIndex);
    const target =
      loc.area === 'elements' && loc.elementIndex !== undefined
        ? elementFieldId(loc.elementIndex, loc.field ?? 'label')
        : loc.area === 'background'
          ? areaFieldId('bg', loc.field ?? 'color')
          : areaFieldId('general', loc.field ?? 'name');
    // Wait for the tab / element form to render before focusing.
    window.setTimeout(() => {
      const node = document.getElementById(target) ?? (loc.elementIndex !== undefined ? document.getElementById(elementFieldId(loc.elementIndex, 'label')) : null);
      if (!node) return;
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusable = node.matches('input,button,select,textarea,[tabindex]') ? node : node.querySelector<HTMLElement>('input,button,select,textarea');
      (focusable as HTMLElement | null)?.focus({ preventScroll: true });
    }, 80);
  };

  /** Where a publish issue points: images that are not stored yet → Background, missing faces → the text using them. */
  const locatePublishIssue = (i: SpecIssue, s: TemplateSpecV1 | null): IssueLocation => {
    const loc = locateSpecIssue(i.path, i.rule, s);
    if (loc.area !== 'general') return loc;
    if (i.rule === 'pending_asset') return { area: 'background', field: /print/i.test(i.path) ? 'print' : 'web' };
    if (i.rule === 'missing_font' && s) {
      const els = s.surfaces[0]?.elements ?? [];
      const stored = new Set(fontOptions.map((f) => `${f.family.toLowerCase()}|${f.weight}|${f.style}`));
      const idx = els.findIndex((e) => e.type === 'text' && !stored.has(`${e.font.family.toLowerCase()}|${e.font.weight}|${e.font.style || 'normal'}`));
      if (idx >= 0) return { area: 'elements', elementIndex: idx, field: 'font' };
      const first = els.findIndex((e) => e.type === 'text');
      if (first >= 0) return { area: 'elements', elementIndex: first, field: 'font' };
    }
    return loc;
  };

  const showIssues = (list: SpecIssue[], s: TemplateSpecV1 | null) => {
    const mapped: Issue[] = list.map((i) => ({ ...i, loc: locatePublishIssue(i, s) }));
    setIssues(mapped);
    if (mapped[0]) jumpTo(mapped[0].loc);
  };

  /** The spec as it will be sent (fonts rebuilt) plus client-side issues. */
  const prepare = (): { spec: TemplateSpecV1 | null; issues: SpecIssue[] } => {
    if (!spec) return { spec: null, issues: [] };
    const out = cloneSpec(spec);
    const list: SpecIssue[] = [];
    if (!name.trim()) list.push({ path: 'name', rule: 'name_required' });
    const { fonts: rebuilt, missing } = rebuildFonts(out, fontOptions);
    out.fonts = rebuilt;
    out.surfaces[0].elements.forEach((el, i) => {
      const p = `surfaces[0].elements[${i}]`;
      if (!ELEMENT_ID_RE.test(el.id)) list.push({ path: `${p}.id`, rule: 'format' });
      if (el.type === 'text' && missing.some((m) => m.family === el.font.family && m.weight === el.font.weight)) {
        list.push({ path: `${p}.font`, rule: 'font_missing' });
      }
      if ((el.type === 'text' && el.editable) || el.type === 'image_slot') {
        if (!Object.values(el.label ?? {}).some((v) => v && v.trim())) list.push({ path: `${p}.label`, rule: 'label_required' });
      }
      if (el.type === 'text' && !/^#[0-9a-f]{3,8}$/i.test(el.color) && !/^[a-z]+$/i.test(el.color)) {
        list.push({ path: `${p}.color`, rule: 'color' });
      }
    });
    const structural = validateSpec(out);
    for (const e of structural.errors) {
      // A missing face is already reported as font_missing.
      if (e.rule === 'undeclared' && list.some((x) => x.path === e.path)) continue;
      list.push(e);
    }
    return { spec: out, issues: list };
  };

  const save = async () => {
    if (!detail || !spec || busy) return;
    setActionError(null);
    const prepared = prepare();
    if (prepared.issues.length) {
      const nameIssue = prepared.issues.find((i) => i.path === 'name');
      if (nameIssue) {
        setIssues([{ ...nameIssue, loc: { area: 'general', field: 'name' } }]);
        jumpTo({ area: 'general', field: 'name' });
        return;
      }
      showIssues(prepared.issues, prepared.spec);
      return;
    }
    setBusy('save');
    try {
      let next = detail;
      if (dirtyName) next = await updateTemplate(token, detail.id, { name: name.trim() });
      if (dirtySpec && prepared.spec) {
        await addTemplateVersion(token, detail.id, prepared.spec);
        next = await getTemplate(token, detail.id);
      }
      adopt(next);
      setIssues([]);
      flashSaved();
    } catch (err) {
      const list = specIssuesFromError(err);
      if (list.length) showIssues(list, prepared.spec);
      else setActionError(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  const publish = async (versionId: string) => {
    if (!detail || busy) return;
    setBusy('publish');
    setActionError(null);
    setLinkedCount(null);
    try {
      adopt(await publishTemplate(token, detail.id, versionId));
      setIssues([]);
      flashSaved();
    } catch (err) {
      const list = specIssuesFromError(err);
      if (list.length) showIssues(list, spec);
      else setActionError(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  const setStatus = async (status: 'ARCHIVED' | 'PUBLISHED' | 'DRAFT') => {
    if (!detail || busy) return;
    setBusy('status');
    setActionError(null);
    setLinkedCount(null);
    try {
      const next = await updateTemplate(token, detail.id, { status });
      setDetail(next);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DESIGNER_TEMPLATE_LINKED') {
        setLinkedCount(linkedProductCount(errorParams(err), detail.products.length));
      } else {
        setActionError(describeError(err));
      }
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!detail || busy) return;
    setBusy('delete');
    setActionError(null);
    try {
      await deleteTemplate(token, detail.id);
      router.push('/creator/designer?tab=templates');
    } catch (err) {
      setConfirmDelete(false);
      if (err instanceof ApiError && err.code === 'DESIGNER_TEMPLATE_IN_USE') {
        const p = errorParams(err);
        setActionError(t('deleteInUse', { products: Number(p.products ?? 0), designs: Number(p.designs ?? 0), orders: Number(p.orders ?? 0) }));
      } else {
        setActionError(describeError(err));
      }
    } finally {
      setBusy(null);
    }
  };

  const loadVersion = async (versionId: string) => {
    if (!detail) return;
    setLoadingVersion(versionId);
    setActionError(null);
    try {
      const v = await getTemplateVersion(token, detail.id, versionId);
      setSpec(cloneSpec(v.spec));
      setSelected(null);
      setIssues([]);
      setSideTab('elements');
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setLoadingVersion(null);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="space-y-4">
        <Link href="/creator/designer?tab=templates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
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
  const generalIssues = issues.filter((i) => i.loc.area === 'general');
  const bgIssues: Record<string, string> = {};
  for (const i of issues) if (i.loc.area === 'background') bgIssues[i.loc.field ?? 'color'] ??= issueText(i);
  const elementIssues = (index: number): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const i of issues) {
      if (i.loc.elementIndex !== index) continue;
      const f = i.loc.field ?? 'geometry';
      out[f] ??= issueText(i);
    }
    return out;
  };
  const issueCount = (area: SideTab) => issues.filter((i) => i.loc.area === area).length;
  const printPx = { w: Math.round(spec.width * PRINT_PX_PER_MM), h: Math.round(spec.height * PRINT_PX_PER_MM) };
  const elementName = (el: DesignElement) => {
    if (el.type === 'image') return t('types.image');
    const label = el.label?.[primaryLocale] || Object.values(el.label ?? {}).find(Boolean);
    return label || el.id;
  };

  const bgAssetBlock = (key: 'web' | 'print') => {
    const ref = bg[key];
    const a = ref ? assetById.get(ref.asset_id) : undefined;
    const url = ref ? assetUrls[ref.asset_id] : undefined;
    const target = key === 'print' ? printPx : { w: Math.round(spec.width * 2), h: Math.round(spec.height * 2) };
    const w = a?.width ?? ref?.width ?? 0;
    const h = a?.height ?? ref?.height ?? 0;
    const dpi = ref ? stretchDpi(w, h, spec) : 0;
    const low = !!ref && (w < target.w * 0.8 || h < target.h * 0.8);
    return (
      <div className="space-y-2 rounded-md border p-3" id={areaFieldId('bg', key)} tabIndex={-1}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium">{t(key === 'web' ? 'bgWeb' : 'bgPrint')}</p>
            <p className="text-[11px] text-muted-foreground">{t(key === 'web' ? 'bgWebHint' : 'bgPrintHint', { width: target.w, height: target.h })}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-24 w-[4.3rem] shrink-0 items-center justify-center overflow-hidden rounded border bg-zinc-50">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element -- API-hosted file
              <img src={url} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="size-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1 text-[11px]">
            {ref ? (
              <>
                <p className="tabular-nums" dir="ltr">
                  {w}×{h} px
                </p>
                <p className={low ? 'text-amber-700' : 'text-muted-foreground'}>{t('dpiLine', { dpi })}</p>
                {low && <p className="text-amber-700">{t('bgLowRes', { width: target.w, height: target.h })}</p>}
              </>
            ) : (
              <p className="text-muted-foreground">{key === 'print' ? t('bgPrintNone') : t('bgWebNone')}</p>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setPicker({ kind: key === 'web' ? 'TEMPLATE_BG_WEB' : 'TEMPLATE_BG_PRINT', target: key })}
              >
                {ref ? t('replace') : t('choose')}
              </Button>
              {ref && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-red-600"
                  onClick={() =>
                    updateSpec((s) => {
                      delete s.surfaces[0].background[key];
                      return s;
                    })
                  }
                >
                  {t('remove')}
                </Button>
              )}
            </div>
          </div>
        </div>
        <FieldError text={bgIssues[key]} />
      </div>
    );
  };

  const order = stackOrder(elements);
  const sel = selected !== null && selected < elements.length ? selected : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Link href="/creator/designer?tab=templates" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5 rtl:rotate-180" /> {t('back')}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold">{detail.name}</h1>
            <TemplateStatusBadge status={detail.status} />
            {detail.source === 'npp' && <Badge variant="outline">NPP</Badge>}
            {latest && (
              <span className="text-xs text-muted-foreground">
                {t('versionLabel', { version: latest.version })}
                {latestIsCurrent ? ` · ${t('live')}` : detail.current_version_id ? ` · ${t('notLive')}` : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saved && <span className="text-xs font-medium text-emerald-600">{t('saved')}</span>}
          {dirty && <span className="text-xs text-amber-700">{t('unsaved')}</span>}
          <Button type="button" variant="outline" size="sm" disabled={!dirty || !!busy} onClick={save}>
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
                setSideTab('general');
                window.setTimeout(() => {
                  document.getElementById(areaFieldId('general', 'products'))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 80);
              }}
            >
              {t('linkedShow')}
            </Button>
            <Link href="/creator/products/own" className={buttonVariants({ size: 'sm', variant: 'ghost', className: 'max-sm:min-h-11' })}>
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
              <Link href="/creator/designer?tab=assets" className="font-medium underline underline-offset-2">
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-md border bg-zinc-50 p-0.5" role="radiogroup" aria-label={t('previewBackground')}>
                  {(['web', 'print'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={previewPrint === (k === 'print')}
                      onClick={() => setPreviewPrint(k === 'print')}
                      className={`rounded px-2.5 py-1 text-xs ${previewPrint === (k === 'print') ? 'bg-white font-medium shadow-sm' : 'text-muted-foreground'}`}
                    >
                      {t(k === 'web' ? 'previewWeb' : 'previewPrint')}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <ToggleSwitch checked={samplePhoto} onChange={setSamplePhoto} label={t('samplePhoto')} />
                  {t('samplePhoto')}
                </label>
              </div>
              <div className="flex justify-center">
                <DesignPreviewCanvas
                  spec={spec}
                  state={previewState}
                  mode={previewPrint ? 'print' : 'edit'}
                  assetUrls={assetUrls}
                  fonts={previewFonts}
                  locale={primaryLocale}
                  selectedId={sel !== null ? elements[sel]?.id : null}
                  emptySlotText={t('emptySlot')}
                  onReport={(r) =>
                    setPreviewProblems((prev) =>
                      prev.missing.join() === r.missing.join() && prev.fonts.join() === r.fontsFailed.join()
                        ? prev
                        : { missing: r.missing, fonts: r.fontsFailed },
                    )
                  }
                />
              </div>
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
                        onChange={(e) => setSampleTexts((prev) => ({ ...prev, [el.id]: e.target.value }))}
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
          <Tabs value={sideTab} onValueChange={(v) => setSideTab(String(v) as SideTab)}>
            <TabsList variant="line" className="w-full justify-start rounded-none border-b px-0">
              {(['general', 'background', 'elements', 'versions'] as const).map((k) => (
                <TabsTrigger key={k} value={k} className="flex-none px-3">
                  {t(`tabs.${k}`)}
                  {k !== 'versions' && issueCount(k) > 0 && (
                    <span className="ms-1 rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-700">{issueCount(k)}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {sideTab === 'general' && (
            <Card className="shadow-none">
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-1">
                  <Label htmlFor={areaFieldId('general', 'name')} className="text-xs">
                    {t('name')}
                  </Label>
                  <Input
                    id={areaFieldId('general', 'name')}
                    className="h-9"
                    maxLength={160}
                    value={name}
                    aria-invalid={generalIssues.some((i) => i.rule === 'name_required') || undefined}
                    onChange={(e) => {
                      setName(e.target.value);
                      clearIssues((i) => i.rule === 'name_required');
                    }}
                  />
                  <FieldError text={generalIssues.find((i) => i.rule === 'name_required') ? tr('name_required') : null} />
                </div>
                <div className="space-y-2 rounded-md border bg-zinc-50/60 p-3 text-xs">
                  <p className="font-medium">{t('trimSize')}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['width', 'height', 'bleed_mm'] as const).map((k) => (
                      <div key={k} className="space-y-1">
                        <Label htmlFor={areaFieldId('general', k)} className="text-[11px] font-normal text-muted-foreground">
                          {t(`size.${k}`)}
                        </Label>
                        <Input
                          id={areaFieldId('general', k)}
                          type="number"
                          dir="ltr"
                          min={k === 'bleed_mm' ? 0 : 1}
                          className="h-8 text-xs tabular-nums"
                          value={Number.isFinite(spec[k]) ? String(spec[k]) : ''}
                          onChange={(e) => {
                            const v = e.target.value === '' ? NaN : Number(e.target.value);
                            updateSpec((s) => ({ ...s, [k]: v }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-muted-foreground">{t('printOutput', { width: printPx.w, height: printPx.h })}</p>
                  {generalIssues
                    .filter((i) => i.rule !== 'name_required')
                    .map((i, n) => (
                      <FieldError key={n} text={`${i.path ? `${i.path}: ` : ''}${issueText(i)}`} />
                    ))}
                </div>

                <div id={areaFieldId('general', 'products')} className="scroll-mt-4 space-y-2">
                  <p className="text-xs font-medium">{t('productsTitle', { count: detail.products.length })}</p>
                  {detail.products.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('productsEmpty')}</p>
                  ) : (
                    <ul className="divide-y rounded-md border text-xs">
                      {detail.products.map((p) => (
                        <li key={p.product_id} className="flex items-center justify-between gap-2 px-3 py-2">
                          <Link href={`/creator/products/own/${p.product_id}?tab=designer`} className="min-w-0 truncate hover:underline">
                            {p.titles[primaryLocale] || Object.values(p.titles)[0] || p.product_id.slice(0, 8)}
                          </Link>
                          <Badge variant="outline" className={p.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : ''}>
                            {p.enabled ? t('linkOn') : t('linkOff')}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 border-t pt-3">
                  {detail.status === 'ARCHIVED' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => setStatus(detail.current_version_id ? 'PUBLISHED' : 'DRAFT')}
                    >
                      <ArchiveRestore /> {t('unarchive')}
                    </Button>
                  ) : (
                    <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => setStatus('ARCHIVED')}>
                      <Archive /> {t('archive')}
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="outline" className="text-red-600" disabled={!!busy} onClick={() => setConfirmDelete(true)}>
                    <Trash2 /> {t('delete')}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">{t('archiveHint')}</p>
              </CardContent>
            </Card>
          )}

          {sideTab === 'background' && (
            <Card className="shadow-none">
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor={areaFieldId('bg', 'color')} className="text-xs">
                      {t('bgColor')}
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label={t('bgColor')}
                        className="h-8 w-10 cursor-pointer rounded border bg-white p-0.5"
                        value={/^#[0-9a-f]{6}$/i.test(bg.color) ? bg.color : '#ffffff'}
                        onChange={(e) =>
                          updateSpec((s) => {
                            s.surfaces[0].background.color = e.target.value;
                            return s;
                          })
                        }
                      />
                      <Input
                        id={areaFieldId('bg', 'color')}
                        dir="ltr"
                        className="h-8 font-mono text-xs"
                        value={bg.color}
                        onChange={(e) =>
                          updateSpec((s) => {
                            s.surfaces[0].background.color = e.target.value;
                            return s;
                          })
                        }
                      />
                    </div>
                    <FieldError text={bgIssues.color} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs">{t('bgFit')}</span>
                    <div className="inline-flex rounded-md border bg-zinc-50 p-0.5" role="radiogroup" aria-label={t('bgFit')}>
                      {(['stretch', 'cover'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          role="radio"
                          aria-checked={bg.fit === f}
                          onClick={() =>
                            updateSpec((s) => {
                              s.surfaces[0].background.fit = f;
                              return s;
                            })
                          }
                          className={`rounded px-2.5 py-1 text-xs ${bg.fit === f ? 'bg-white font-medium shadow-sm' : 'text-muted-foreground'}`}
                        >
                          {t(`fit.${f}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {bgAssetBlock('web')}
                {bgAssetBlock('print')}
                <p className="text-[11px] text-muted-foreground">{t('bgHint')}</p>
              </CardContent>
            </Card>
          )}

          {sideTab === 'elements' && (
            <div className="space-y-3">
              <Card className="shadow-none">
                <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-semibold">{t('elementsTitle', { count: elements.length })}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => addElement('text')}>
                      <Plus className="size-3" /> {t('addText')}
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => addElement('slot')}>
                      <Plus className="size-3" /> {t('addSlot')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setPicker({ kind: 'TEMPLATE_DECO', target: 'new-deco' })}
                    >
                      <Plus className="size-3" /> {t('addDecoration')}
                    </Button>
                  </div>
                  {elements.length === 0 ? (
                    <p className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">{t('elementsEmpty')}</p>
                  ) : (
                    <>
                      <p className="text-[11px] text-muted-foreground">{t('stackHint')}</p>
                      <ul className="divide-y rounded-md border">
                        {order.map((index, pos) => {
                          const el = elements[index];
                          const Icon = el.type === 'text' ? Type : el.type === 'image_slot' ? UserSquare : ImageIcon;
                          const hasIssue = issues.some((i) => i.loc.elementIndex === index);
                          return (
                            <li key={`${el.id}-${index}`} className={`flex items-center gap-2 px-2 py-1.5 ${sel === index ? 'bg-sky-50' : ''}`}>
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 items-center gap-2 text-start"
                                onClick={() => setSelected(sel === index ? null : index)}
                              >
                                <Icon className={`size-4 shrink-0 ${hasIssue ? 'text-red-600' : 'text-muted-foreground'}`} />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-medium">{elementName(el)}</span>
                                  <span className="block font-mono text-[10px] text-muted-foreground" dir="ltr">
                                    {el.id} · z {el.z}
                                    {el.locked ? ` · ${t('lockedShort')}` : ''}
                                  </span>
                                </span>
                                {hasIssue && <AlertCircle className="size-3.5 text-red-600" />}
                              </button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                aria-label={t('moveUp')}
                                disabled={pos === 0}
                                onClick={() => setElements((els) => moveInStack(els, index, 'up'))}
                              >
                                <ArrowUp className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                aria-label={t('moveDown')}
                                disabled={pos === order.length - 1}
                                onClick={() => setElements((els) => moveInStack(els, index, 'down'))}
                              >
                                <ArrowDown className="size-3.5" />
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </CardContent>
              </Card>

              {sel !== null && elements[sel] && (
                <Card className="shadow-none">
                  <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-sm font-semibold">{elementName(elements[sel])}</CardTitle>
                      <p className="text-[11px] text-muted-foreground">
                        {t(`types.${elements[sel].type}`)} ·{' '}
                        <span className="font-mono" dir="ltr" id={elementFieldId(sel, 'id')}>
                          {elements[sel].id}
                        </span>
                      </p>
                      <FieldError text={elementIssues(sel).id || elementIssues(sel).type} />
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={t('duplicate')} onClick={() => duplicateElement(sel)}>
                        <Copy className="size-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="size-7 text-red-600" aria-label={t('removeElement')} onClick={() => removeElement(sel)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <TemplateElementForm
                      key={`${sel}-${elements[sel].id}`}
                      element={elements[sel]}
                      index={sel}
                      onChange={(next) => updateElement(sel, next)}
                      errors={elementIssues(sel)}
                      fontOptions={fontOptions}
                      locales={locales}
                      imageUrl={(() => {
                        const el = elements[sel];
                        return el.type === 'image' ? assetUrls[el.asset?.asset_id] : null;
                      })()}
                      onPickImage={() => setPicker({ kind: 'TEMPLATE_DECO', target: sel })}
                    />
                  </CardContent>
                </Card>
              )}
              {fontOptions.length === 0 && (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                  {t('noFontsHint')}{' '}
                  <Link href="/creator/designer?tab=assets" className="font-medium underline">
                    {t('openFonts')}
                  </Link>
                </p>
              )}
            </div>
          )}

          {sideTab === 'versions' && (
            <Card className="shadow-none">
              <CardContent className="space-y-2 pt-4">
                <p className="text-[11px] text-muted-foreground">{t('versionsHint')}</p>
                <ul className="divide-y rounded-md border">
                  {detail.versions.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
                      <span className="font-medium">{t('versionLabel', { version: v.version })}</span>
                      {v.current && <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">{t('live')}</Badge>}
                      <span className="text-muted-foreground">{formatDate(v.created_at)}</span>
                      <span className="text-muted-foreground">{t('designCount', { count: v.design_count })}</span>
                      <span className="ms-auto flex gap-1">
                        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" disabled={loadingVersion === v.id} onClick={() => loadVersion(v.id)}>
                          {loadingVersion === v.id ? <Loader2 className="animate-spin" /> : null}
                          {t('loadVersion')}
                        </Button>
                        {!v.current && (
                          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={!!busy} onClick={() => publish(v.id)}>
                            {t('makeLive')}
                          </Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {picker && (
        <AssetPickerDialog
          open={!!picker}
          onOpenChange={(o) => {
            if (!o) setPicker(null);
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

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteBody', { name: detail.name })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
              {tc('cancel')}
            </Button>
            <Button type="button" variant="destructive" disabled={busy === 'delete'} onClick={remove}>
              {busy === 'delete' ? <Loader2 className="animate-spin" /> : <Trash2 />} {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
