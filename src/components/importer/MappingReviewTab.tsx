'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, Save, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import { useImporterRun } from '@/lib/useImporterRun';
import {
  CONTENT_REDIRECT_MODES,
  DEFAULT_RUN_OPTIONS,
  IMPORT_SCOPES,
  SOURCE_PRODUCT_STATUSES,
  TARGET_PRODUCT_STATUSES,
  canEditOptions,
  isActiveRun,
  listRunItems,
  listRuns,
  optionErrorsOf,
  updateRunOptions,
  type ContentRedirectMode,
  type ContentRow,
  type DryRunSummary,
  type ImportRunOptions,
  type ImportRunView,
  type StockOnUpdate,
  type TargetProductStatus,
} from '@/lib/importer.api';
import { ErrorBanner, RunStatusBadge, SpinnerBlock, TechDetail, runLabel, useDateTimeFormat } from '@/components/importer/ImporterBits';
import { RunProgress } from '@/components/importer/RunProgress';
import { TermCleanupTable } from '@/components/importer/DryRunReport';

/** Sections of the review, also the targets of "jump to the problem". */
type Section = 'category' | 'scopes' | 'conflict' | 'products' | 'attributes' | 'faq' | 'shipping' | 'handoff' | 'content';

/** Sections folded under "Advanced settings" (E2). */
const ADVANCED_SECTIONS: readonly Section[] = ['products', 'attributes', 'faq', 'shipping', 'handoff', 'content'];
const isAdvanced = (s: Section) => ADVANCED_SECTIONS.includes(s);

/** Option key (first path segment of a validator message) → section. */
const SECTION_OF_OPTION: Record<string, Section> = {
  platform_category_id: 'category',
  scopes: 'scopes',
  conflict_policy: 'conflict',
  include_drafts: 'products',
  status_map: 'products',
  skip_ext_ids: 'products',
  on_source_removed: 'products',
  match_existing: 'products',
  stock_on_update: 'products',
  customization_type_rules: 'products',
  term_cleanup: 'attributes',
  label_overrides: 'attributes',
  faq_labels: 'faq',
  shipping: 'shipping',
  designer_fallback_fields: 'handoff',
  redirect_skipped: 'handoff',
  verify_media: 'handoff',
  content_redirects: 'content',
};
/** Rows of "Old pages and posts" per page (M5 B17). */
const CONTENT_PAGE_SIZE = 50;

/** Shipping method ids whose display names can be overridden (D26); labelled through `methods.<id>`. */
const METHOD_IDS = ['flat_rate', 'local_pickup', 'free_shipping'] as const;
/** Product items fetched for the skip list (pages of 200). */
const ITEM_PAGE = 200;
const ITEM_PAGES_MAX = 10;

interface CategoryNode {
  id: string;
  slug: string;
  translations?: { locale: string; name: string }[];
  children?: CategoryNode[];
}

/** Merges stored options over the defaults, nested objects included. */
function withDefaults(options: ImportRunOptions | null | undefined): ImportRunOptions {
  const o = options ?? {};
  const d = DEFAULT_RUN_OPTIONS;
  return {
    ...d,
    ...o,
    scopes: { ...d.scopes, ...(o.scopes ?? {}) },
    status_map: { ...d.status_map, ...(o.status_map ?? {}) },
    match_existing: { ...d.match_existing, ...(o.match_existing ?? {}) },
    term_cleanup: { ...d.term_cleanup, ...(o.term_cleanup ?? {}) },
    label_overrides: { ...(o.label_overrides ?? {}) },
    faq_labels: { ...(o.faq_labels ?? {}) },
    skip_ext_ids: [...(o.skip_ext_ids ?? [])],
    shipping: {
      ...d.shipping,
      ...(o.shipping ?? {}),
      method_names: { ...(o.shipping?.method_names ?? {}) },
      default_days: { ...d.shipping?.default_days, ...(o.shipping?.default_days ?? {}) },
    },
    content_redirects: {
      mode: o.content_redirects?.mode ?? d.content_redirects?.mode ?? 'map',
      targets: { ...(o.content_redirects?.targets ?? {}) },
    },
  };
}

/** The platform category is needed only when products are imported (the API blocks the plan otherwise). */
const needsPlatformCategory = (o: ImportRunOptions | null | undefined): boolean => o?.scopes?.products !== false;

interface MappingReviewTabProps {
  token: string;
  /** Run chosen from the run dialog or a jump; null picks the newest reviewable run. */
  runId: string | null;
  /** Field to highlight on arrival (e.g. `platform_category_id`). */
  focus: string | null;
  onSelectRun: (runId: string | null) => void;
  onOpenRun: (run: ImportRunView) => void;
  onChanged: () => void;
  /** E1: tells the page whether the form holds unsaved edits (tab/run switch guard, beforeunload). */
  onDirtyChange?: (dirty: boolean) => void;
}

/** Mapping review (§13) of a planned run; saving re-plans the run. */
export function MappingReviewTab({ token, runId, focus, onSelectRun, onOpenRun, onChanged, onDirtyChange }: MappingReviewTabProps) {
  const t = useTranslations('creator.importer.mapping');
  const formatDate = useDateTimeFormat();
  const [candidates, setCandidates] = useState<ImportRunView[] | null>(null);

  // The candidate list is loaded once per mount, not on every run change:
  // the selected run is merged in below when it is not part of the list.
  useEffect(() => {
    let cancelled = false;
    listRuns(token, { page: 1, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        const list = (res.items ?? []).filter((r) => canEditOptions(r.status) || isActiveRun(r.status));
        setCandidates(list);
        if (!runId) {
          const first = list.find((r) => canEditOptions(r.status));
          if (first) onSelectRun(first.id);
        }
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      });
    return () => {
      cancelled = true;
    };
    // Only on mount / token change; `runId` and `onSelectRun` are read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const { run, loading, error, setRun } = useImporterRun(token, runId, onChanged);
  const describeError = useApiError();

  if (!candidates && !runId) return <SpinnerBlock />;

  if (!runId) {
    return (
      <Card className="shadow-none">
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <SlidersHorizontal className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">{t('emptyTitle')}</p>
          <p className="max-w-md text-sm text-muted-foreground">{t('emptyBody')}</p>
        </CardContent>
      </Card>
    );
  }

  const runOptions = (candidates ?? [])
    .filter((r) => r.id !== runId)
    .map((r) => ({ value: r.id, label: `${runLabel(r)} · ${formatDate(r.created_at)}` }));
  if (run) runOptions.unshift({ value: run.id, label: `${runLabel(run)} · ${formatDate(run.created_at)}` });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-72">
          <SearchableSelect options={runOptions} value={runId} onChange={(v) => onSelectRun(v || null)} />
        </div>
        {run && <RunStatusBadge status={run.status} />}
        {run && (
          <Button variant="ghost" size="sm" onClick={() => onOpenRun(run)}>
            {t('openReport')}
          </Button>
        )}
      </div>

      {!run && loading && <SpinnerBlock />}
      {!run && !!error && <ErrorBanner message={describeError(error)} />}

      {run && isActiveRun(run.status) && <RunProgress run={run} />}
      {run && !canEditOptions(run.status) && !isActiveRun(run.status) && (
        <div className="rounded-md border bg-zinc-50 p-3 text-sm text-muted-foreground">{t('notEditable')}</div>
      )}

      {run && canEditOptions(run.status) && (
        // Remount on every new plan so the form starts from the saved options.
        <MappingForm
          key={`${run.id}:${run.plan_fingerprint ?? run.planned_at ?? run.status}`}
          token={token}
          run={run}
          focus={focus}
          onDirtyChange={onDirtyChange}
          onSaved={(next) => {
            if (next?.id) setRun(next);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

// ─── Form ────────────────────────────────────────────────────────────────────

function MappingForm({
  token,
  run,
  focus,
  onSaved,
  onDirtyChange,
}: {
  token: string;
  run: ImportRunView;
  focus: string | null;
  onSaved: (run: ImportRunView) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const t = useTranslations('creator.importer.mapping');
  const tc = useTranslations('common');
  const ts = useTranslations('creator.importer.sourceStatus');
  const tp = useTranslations('creator.importer.targetStatus');
  const locale = useLocale();
  const describeError = useApiError();
  const summary = run.summary ?? null;

  const [opts, setOpts] = useState<ImportRunOptions>(() => withDefaults(run.options));
  const [errors, setErrors] = useState<Partial<Record<Section | 'platform_category_id' | 'days', string>>>(() =>
    focus === 'platform_category_id' && !run.options?.platform_category_id && needsPlatformCategory(withDefaults(run.options))
      ? { platform_category_id: t('errors.categoryRequired') }
      : {},
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Key/value editors report duplicate keys (E12); saving is blocked until fixed.
  const [kvDuplicates, setKvDuplicates] = useState<{ attributes: boolean; faq: boolean }>({ attributes: false, faq: false });

  const update = (patch: Partial<ImportRunOptions>) => {
    setOpts((o) => ({ ...o, ...patch }));
    setDirty(true);
  };

  // E1: report the dirty state to the page; a remount (new plan) resets it.
  const dirtyRef = useRef(onDirtyChange);
  useEffect(() => {
    dirtyRef.current = onDirtyChange;
  }, [onDirtyChange]);
  useEffect(() => {
    dirtyRef.current?.(dirty);
  }, [dirty]);
  useEffect(() => () => dirtyRef.current?.(false), []);

  // Scroll to the field a jump asked for (e.g. from a failed confirm).
  useEffect(() => {
    if (focus !== 'platform_category_id') return;
    const el = document.getElementById('importer-section-category');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focus]);

  // ── Platform categories (D23) ──
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    api<CategoryNode[]>('/categories')
      .then((tree) => {
        const flat: { value: string; label: string }[] = [];
        const walk = (nodes: CategoryNode[], prefix: string) => {
          for (const c of nodes) {
            const name =
              c.translations?.find((tr) => tr.locale === locale)?.name ||
              c.translations?.find((tr) => tr.locale === 'en')?.name ||
              c.translations?.[0]?.name ||
              c.slug;
            flat.push({ value: c.id, label: prefix + name });
            if (c.children?.length) walk(c.children, `${prefix}— `);
          }
        };
        walk(Array.isArray(tree) ? tree : [], '');
        setCategories(flat);
      })
      .catch(() => setCategories([]));
  }, [locale]);

  // ── Source products for the skip list (plan items), loaded lazily when the
  // advanced section opens (the list can be thousands of rows).
  const [products, setProducts] = useState<{ ref: string; title: string }[] | null>(null);
  useEffect(() => {
    if (!advancedOpen || products !== null) return;
    let cancelled = false;
    (async () => {
      const out: { ref: string; title: string }[] = [];
      for (let page = 1; page <= ITEM_PAGES_MAX; page++) {
        const res = await listRunItems(token, run.id, { phase: 'PLAN', entity_type: 'PRODUCT', page, limit: ITEM_PAGE });
        for (const it of res.items ?? []) {
          const diffTitle = typeof it.diff?.title === 'string' ? (it.diff.title as string) : null;
          out.push({ ref: it.external_ref, title: it.title || diffTitle || it.message || it.external_ref });
        }
        if (page * (res.limit || ITEM_PAGE) >= res.total) break;
      }
      if (!cancelled) setProducts(out);
    })().catch(() => {
      if (!cancelled) setProducts([]);
    });
    return () => {
      cancelled = true;
    };
  }, [token, run.id, advancedOpen, products]);

  const titleOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of summary?.skipped ?? []) map[s.external_ref] = s.title;
    for (const p of products ?? []) map[p.ref] = p.title;
    return map;
  }, [products, summary]);

  const skip = opts.skip_ext_ids ?? [];
  const [manualRef, setManualRef] = useState('');
  const addSkip = (ref: string) => {
    const v = ref.trim();
    if (!v || skip.includes(v)) return;
    update({ skip_ext_ids: [...skip, v] });
  };

  // Attribute taxonomies seen in the cleanup preview, offered as override keys.
  const taxonomies = useMemo(
    () => Array.from(new Set((summary?.term_cleanup ?? []).map((r) => r.taxonomy))).sort(),
    [summary],
  );

  // ── Validation and save ──
  const validate = () => {
    const errs: typeof errors = {};
    if (!opts.platform_category_id && needsPlatformCategory(opts)) errs.platform_category_id = t('errors.categoryRequired');
    const min = opts.shipping?.default_days?.min;
    const max = opts.shipping?.default_days?.max;
    if ((min !== undefined && (!Number.isInteger(min) || min < 0)) || (max !== undefined && (!Number.isInteger(max) || max < 0))) {
      errs.days = t('errors.daysInvalid');
    } else if (min !== undefined && max !== undefined && min > max) {
      errs.days = t('errors.daysOrder');
    }
    const emptyKey = (rec: Record<string, string> | undefined) => Object.entries(rec ?? {}).some(([k, v]) => !k.trim() || !String(v).trim());
    if (kvDuplicates.attributes) errs.attributes = t('errors.duplicateKey');
    else if (emptyKey(opts.label_overrides)) errs.attributes = t('errors.overrideIncomplete');
    if (kvDuplicates.faq) errs.faq = t('errors.duplicateKey');
    else if (emptyKey(opts.faq_labels)) errs.faq = t('errors.overrideIncomplete');
    return errs;
  };

  const sectionOfError = (key: string): Section =>
    key === 'platform_category_id' ? 'category' : key === 'days' ? 'shipping' : (key as Section);

  // Sections inside "Advanced" are opened before the scroll (next frame).
  const jumpTo = (section: Section) => {
    if (isAdvanced(section)) setAdvancedOpen(true);
    requestAnimationFrame(() => {
      document.getElementById(`importer-section-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const save = async () => {
    const errs = validate();
    setErrors(errs);
    setFormError(null);
    const first = Object.keys(errs)[0];
    if (first) {
      jumpTo(sectionOfError(first));
      return;
    }
    setSaving(true);
    try {
      const next = await updateRunOptions(token, run.id, opts);
      setDirty(false);
      onSaved(next);
    } catch (err) {
      const e = err as { code?: string };
      const list = optionErrorsOf(err);
      if (e?.code === 'IMPORT_PLATFORM_CATEGORY_REQUIRED') {
        setErrors({ platform_category_id: describeError(err) });
        jumpTo('category');
      } else if (list && list.length > 0) {
        // Raw validator output ("shipping.default_days.min must be …", sent as
        // the top-level `errors[]` of IMPORT_RUN_OPTIONS_INVALID) → the section
        // it belongs to, with a friendly sentence.
        const serverErrs: typeof errors = {};
        for (const msg of list) {
          const key = /^(?:unknown option:\s*)?([a-z_]+)/.exec(msg.trim())?.[1] ?? '';
          const section = SECTION_OF_OPTION[key];
          if (section && !serverErrs[section]) serverErrs[section] = t('errors.sectionInvalid', { section: t(`sections.${section}`) });
        }
        const firstSection = Object.keys(serverErrs)[0] as Section | undefined;
        if (firstSection) {
          setErrors(serverErrs);
          jumpTo(firstSection);
        } else setFormError(describeError(err));
      } else {
        setFormError(describeError(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const sectionError = (s: Section) => errors[s] && <ErrorBanner message={errors[s]!} />;
  const sectionHasError = (s: Section) =>
    !!errors[s] || (s === 'category' && !!errors.platform_category_id) || (s === 'shipping' && !!errors.days);
  const advancedHasError = ADVANCED_SECTIONS.some(sectionHasError);

  const sectionCard = (id: Section, children: React.ReactNode, extraCls = '') => (
    <Card id={`importer-section-${id}`} className={`scroll-mt-4 shadow-none ${extraCls}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          {t(`sections.${id}`)} {id === 'category' && needsPlatformCategory(opts) && <span className="text-red-500">*</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {sectionError(id)}
        {children}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="space-y-4">
        {run.status === 'PLAN_FAILED' && <ErrorBanner message={t('planFailed')} />}

        {/* 1. Platform category (required) */}
        {sectionCard(
          'category',
          <div className="space-y-1.5">
            <SearchableSelect
              id="importer-platform-category"
              options={categories}
              value={opts.platform_category_id ?? ''}
              onChange={(v) => {
                update({ platform_category_id: v || null });
                if (v) setErrors((e) => ({ ...e, platform_category_id: undefined }));
              }}
              placeholder={t('categoryPlaceholder')}
            />
            {errors.platform_category_id ? (
              <p className="text-[11px] text-red-600">{errors.platform_category_id}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {needsPlatformCategory(opts) ? t('categoryHint') : t('categoryOptionalHint')}
              </p>
            )}
          </div>,
          errors.platform_category_id ? 'border-red-300' : '',
        )}

        {/* 2. What to import */}
        {sectionCard(
          'scopes',
          <div className="grid gap-2 sm:grid-cols-2">
            {IMPORT_SCOPES.map((scope) => (
              <label key={scope} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <span>{t(`scopes.${scope}`)}</span>
                <ToggleSwitch
                  checked={opts.scopes?.[scope] !== false}
                  onChange={(v) => update({ scopes: { ...opts.scopes, [scope]: v } })}
                  label={t(`scopes.${scope}`)}
                />
              </label>
            ))}
          </div>,
        )}

        {/* 3. When a product already exists */}
        {sectionCard(
          'conflict',
          <div className="grid gap-2 sm:grid-cols-2">
            {(['SKIP_MODIFIED', 'OVERWRITE'] as const).map((policy) => {
              const selected = (opts.conflict_policy ?? 'SKIP_MODIFIED') === policy;
              return (
                <button
                  key={policy}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => update({ conflict_policy: policy })}
                  className={`rounded-lg border p-3 text-start transition ${selected ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:bg-zinc-50/60'}`}
                >
                  <span className="block text-sm font-medium">{t(`conflict.${policy}`)}</span>
                  <span className="block text-xs text-muted-foreground">{t(`conflict.${policy}_hint`)}</span>
                </button>
              );
            })}
          </div>,
        )}

        {/* Advanced (collapsed by default) */}
        <div id="importer-section-advanced" className="scroll-mt-4 space-y-4">
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            aria-expanded={advancedOpen}
            className={`flex w-full items-center gap-3 rounded-lg border bg-white px-4 py-3 text-start hover:bg-zinc-50 ${advancedHasError ? 'border-red-300' : ''}`}
          >
            <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className={`block text-sm font-semibold ${advancedHasError ? 'text-red-600' : ''}`}>{t('advanced')}</span>
              <span className="block text-xs text-muted-foreground">{t('advancedHint')}</span>
            </span>
            <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          </button>

          {advancedOpen && (
            <>
              {/* Products */}
              {sectionCard(
                'products',
                <>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      <span className="block">{t('includeDrafts')}</span>
                      <span className="block text-xs text-muted-foreground">{t('includeDraftsHint')}</span>
                    </span>
                    <ToggleSwitch checked={opts.include_drafts !== false} onChange={(v) => update({ include_drafts: v })} label={t('includeDrafts')} />
                  </label>

                  <div className="space-y-2">
                    <Label className="text-xs">{t('statusMap')}</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {SOURCE_PRODUCT_STATUSES.map((s) => (
                        <div key={s} className="flex items-center gap-2">
                          <span className="w-24 shrink-0 text-sm text-muted-foreground">{ts(s)}</span>
                          <div className="flex-1">
                            <SearchableSelect
                              options={TARGET_PRODUCT_STATUSES.map((v) => ({ value: v, label: tp(v) }))}
                              value={opts.status_map?.[s] ?? ''}
                              onChange={(v) => update({ status_map: { ...opts.status_map, [s]: (v || 'DRAFT') as TargetProductStatus } })}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('onSourceRemoved')}</Label>
                      <SearchableSelect
                        options={(['keep', 'draft', 'archive'] as const).map((v) => ({ value: v, label: t(`removed.${v}`) }))}
                        value={opts.on_source_removed ?? 'keep'}
                        onChange={(v) => update({ on_source_removed: (v || 'keep') as ImportRunOptions['on_source_removed'] })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('matchCategories')}</Label>
                      <SearchableSelect
                        options={[
                          { value: 'slug', label: t('match.slug') },
                          { value: 'none', label: t('match.none') },
                        ]}
                        value={opts.match_existing?.categories ?? 'slug'}
                        onChange={(v) => update({ match_existing: { ...opts.match_existing, categories: (v || 'slug') as 'slug' | 'none' } })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('stockOnUpdate')}</Label>
                      <SearchableSelect
                        options={(['keep', 'overwrite'] as const).map((v) => ({
                          value: v,
                          label: t(`stock.${v}`),
                          description: t(`stock.${v}_hint`),
                        }))}
                        value={opts.stock_on_update ?? 'keep'}
                        onChange={(v) => update({ stock_on_update: (v || 'keep') as StockOnUpdate })}
                      />
                    </div>
                  </div>

                  {/* Skip list */}
                  <div className="space-y-2">
                    <Label className="text-xs">{t('skipList')}</Label>
                    {products === null ? (
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" />
                        {t('skipLoading')}
                      </p>
                    ) : (
                      <SearchableSelect
                        options={products.filter((p) => !skip.includes(p.ref)).map((p) => ({ value: p.ref, label: p.title, description: p.ref }))}
                        value=""
                        onChange={(v) => v && addSkip(v)}
                        placeholder={t('skipSearch')}
                        searchPlaceholder={t('skipSearchPlaceholder')}
                      />
                    )}
                    {skip.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {skip.map((ref) => (
                          <Badge key={ref} variant="outline" className="h-auto gap-1.5 py-1 font-normal" title={ref}>
                            <span>{titleOf[ref] ?? ref}</span>
                            {titleOf[ref] && <TechDetail value={ref} />}
                            <button
                              type="button"
                              onClick={() => update({ skip_ext_ids: skip.filter((r) => r !== ref) })}
                              aria-label={tc('remove')}
                              className="-m-1 inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">{t('skipEmpty')}</p>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('manualRef')}</Label>
                      <div className="flex flex-wrap gap-2">
                        <Input
                          dir="ltr"
                          className="h-8 w-64 font-mono text-xs"
                          value={manualRef}
                          onChange={(e) => setManualRef(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addSkip(manualRef);
                              setManualRef('');
                            }
                          }}
                          placeholder="woo:example.com:product:123"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            addSkip(manualRef);
                            setManualRef('');
                          }}
                          disabled={!manualRef.trim()}
                        >
                          <Plus />
                          {tc('add')}
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{t('manualRefHint')}</p>
                    </div>
                  </div>
                </>,
              )}

              {/* Attributes and terms */}
              {sectionCard(
                'attributes',
                <>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(['unicode', 'strip_price_suffix', 'strip_trailing_colon'] as const).map((rule) => (
                      <label key={rule} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                        <span>{t(`cleanup.${rule}`)}</span>
                        <ToggleSwitch
                          checked={opts.term_cleanup?.[rule] !== false}
                          onChange={(v) => update({ term_cleanup: { ...opts.term_cleanup, [rule]: v } })}
                          label={t(`cleanup.${rule}`)}
                        />
                      </label>
                    ))}
                  </div>
                  {summary?.term_cleanup && summary.term_cleanup.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">{t('cleanupPreview')}</p>
                      <TermCleanupTable rows={summary.term_cleanup} />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('cleanupNone')}</p>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('labelOverrides')}</Label>
                    <p className="text-[11px] text-muted-foreground">{t('labelOverridesHint')}</p>
                    <KeyValueEditor
                      value={opts.label_overrides ?? {}}
                      onChange={(v) => update({ label_overrides: v })}
                      onDuplicate={(has) => setKvDuplicates((d) => (d.attributes === has ? d : { ...d, attributes: has }))}
                      keyPlaceholder="pa_size"
                      valuePlaceholder={t('labelPlaceholder')}
                      suggestions={taxonomies}
                    />
                  </div>
                </>,
              )}

              {/* FAQ labels */}
              {sectionCard(
                'faq',
                <>
                  <p className="text-[11px] text-muted-foreground">{t('faqHint')}</p>
                  <KeyValueEditor
                    value={opts.faq_labels ?? {}}
                    onChange={(v) => update({ faq_labels: v })}
                    onDuplicate={(has) => setKvDuplicates((d) => (d.faq === has ? d : { ...d, faq: has }))}
                    keyPlaceholder="product_delivery"
                    valuePlaceholder={t('faqPlaceholder')}
                  />
                </>,
              )}

              {/* Shipping */}
              {sectionCard(
                'shipping',
                <>
                  {summary?.shipping && !summary.shipping.zones_available ? (
                    <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">{t('shippingMissing')}</p>
                  ) : (
                    summary?.shipping && (
                      <p className="text-xs text-muted-foreground">
                        {t('shippingSummary', {
                          zones: summary.shipping.zones ?? 0,
                          methods: summary.shipping.methods_enabled ?? 0,
                          classes: (summary.shipping.classes_used ?? []).join(', ') || '—',
                        })}
                      </p>
                    )
                  )}
                  <div className="space-y-2">
                    {(METHOD_IDS as readonly string[])
                      .concat(Object.keys(opts.shipping?.method_names ?? {}).filter((k) => !(METHOD_IDS as readonly string[]).includes(k)))
                      .map((id) => {
                        // "Flat rate (flat_rate)": readable label with the method id.
                        const label = t.has(`methods.${id}`) ? `${t(`methods.${id}`)} (${id})` : id;
                        return (
                          <div key={id} className="grid items-center gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
                            <span className="text-sm text-muted-foreground" title={id}>
                              {label}
                            </span>
                            <Input
                              className="h-8 text-sm"
                              value={opts.shipping?.method_names?.[id] ?? ''}
                              placeholder={t('methodNamePlaceholder')}
                              onChange={(e) => {
                                const names = { ...(opts.shipping?.method_names ?? {}) };
                                if (e.target.value) names[id] = e.target.value;
                                else delete names[id];
                                update({ shipping: { ...opts.shipping, method_names: names } });
                              }}
                            />
                          </div>
                        );
                      })}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(['min', 'max'] as const).map((k) => (
                      <div key={k} className="space-y-1.5">
                        <Label className="text-xs">{t(`days.${k}`)}</Label>
                        <Input
                          type="number"
                          min={0}
                          className={`h-8 text-sm ${errors.days ? 'border-red-400' : ''}`}
                          value={opts.shipping?.default_days?.[k] ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const days = { ...(opts.shipping?.default_days ?? {}) };
                            if (raw === '') delete days[k];
                            else days[k] = Number(raw);
                            update({ shipping: { ...opts.shipping, default_days: days } });
                          }}
                        />
                      </div>
                    ))}
                    <label className="flex items-end justify-between gap-3 pb-1 text-sm">
                      <span>{t('freeThreshold')}</span>
                      <ToggleSwitch
                        checked={opts.shipping?.free_shipping_as_threshold !== false}
                        onChange={(v) => update({ shipping: { ...opts.shipping, free_shipping_as_threshold: v } })}
                        label={t('freeThreshold')}
                      />
                    </label>
                  </div>
                  {errors.days && <p className="text-[11px] text-red-600">{errors.days}</p>}
                  <p className="text-[11px] text-muted-foreground">{t('freeThresholdHint')}</p>
                </>,
              )}

              {/* Old pages and posts (M5 B17) */}
              {sectionCard(
                'content',
                <ContentSection
                  token={token}
                  summary={summary}
                  open={advancedOpen}
                  pagesScope={opts.scopes?.pages === true}
                  mode={opts.content_redirects?.mode ?? 'map'}
                  targets={opts.content_redirects?.targets ?? {}}
                  onMode={(mode) => update({ content_redirects: { ...opts.content_redirects, mode } })}
                  onTarget={(ref, target) => {
                    const targets = { ...(opts.content_redirects?.targets ?? {}) };
                    if (target) targets[ref] = target;
                    else delete targets[ref];
                    update({ content_redirects: { ...opts.content_redirects, targets } });
                  }}
                />,
              )}

              {/* Personalization, templates and other hand-offs */}
              {sectionCard(
                'handoff',
                <>
                  {summary?.personalization && (
                    <div className="space-y-2">
                      <p className="text-sm">
                        {t('presetsLine', { presets: summary.personalization.presets, products: summary.personalization.products })}
                        {summary.personalization.staged && (
                          <Badge variant="outline" className="ms-2 border-indigo-200 bg-indigo-50 text-indigo-700">
                            {t('staged')}
                          </Badge>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(summary.personalization.by_key ?? {}).map(([key, count]) => (
                          <TechDetail key={key} value={`${key} · ${count}`} className="rounded border px-1.5 py-0.5" />
                        ))}
                        {(summary.personalization.broken ?? 0) > 0 && (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                            {t('broken', { count: summary.personalization.broken ?? 0 })}
                          </Badge>
                        )}
                      </div>
                      {summary.personalization.staged && <p className="text-[11px] text-muted-foreground">{t('stagedHint')}</p>}
                    </div>
                  )}
                  {summary?.designer && (summary.designer.templates ?? 0) > 0 && (
                    <p className="text-sm">
                      {t('templatesLine', {
                        templates: summary.designer.templates ?? 0,
                        linked: summary.designer.products_linked ?? 0,
                        fields: summary.designer.fallback_fields ?? 0,
                      })}
                    </p>
                  )}
                  {(
                    [
                      ['designer_fallback_fields', 'fallbackFields'],
                      ['redirect_skipped', 'redirectSkipped'],
                      ['verify_media', 'verifyMedia'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between gap-3 text-sm">
                      <span>
                        <span className="block">{t(label)}</span>
                        <span className="block text-xs text-muted-foreground">{t(`${label}Hint`)}</span>
                      </span>
                      <ToggleSwitch checked={opts[key] !== false} onChange={(v) => update({ [key]: v })} label={t(label)} />
                    </label>
                  ))}
                </>,
              )}
            </>
          )}
        </div>
      </div>

      {/* Side panel: save */}
      <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <Card className="shadow-none">
          <CardContent className="space-y-3 py-4">
            <p className="text-sm font-medium">{t('saveTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('saveHint')}</p>
            {formError && <ErrorBanner message={formError} />}
            {Object.values(errors).some(Boolean) && <p className="text-xs text-red-600">{t('errors.fixBeforeSave')}</p>}
            <Button className="w-full" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : dirty ? <Save /> : <RefreshCw />}
              {dirty ? t('saveReplan') : t('replan')}
            </Button>
            <nav className="space-y-0.5 border-t pt-3 text-xs">
              {(['category', 'scopes', 'conflict'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => jumpTo(s)}
                  className={`block w-full rounded px-2 py-1 text-start hover:bg-zinc-50 ${sectionHasError(s) ? 'font-medium text-red-600' : 'text-muted-foreground'}`}
                >
                  {t(`sections.${s}`)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setAdvancedOpen(true);
                  requestAnimationFrame(() => document.getElementById('importer-section-advanced')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                }}
                className={`block w-full rounded px-2 py-1 text-start hover:bg-zinc-50 ${advancedHasError ? 'font-medium text-red-600' : 'text-muted-foreground'}`}
              >
                {t('advanced')}
              </button>
              {advancedOpen &&
                ADVANCED_SECTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => jumpTo(s)}
                    className={`block w-full rounded px-2 py-1 ps-5 text-start hover:bg-zinc-50 ${sectionHasError(s) ? 'font-medium text-red-600' : 'text-muted-foreground'}`}
                  >
                    {t(`sections.${s}`)}
                  </button>
                ))}
            </nav>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

// ─── Old pages and posts (M5 B17) ───────────────────────────────────────────

const CUSTOM_TARGET = '__custom__';

interface ContentSectionProps {
  token: string;
  summary: DryRunSummary | null;
  /** The advanced block is open: load the store's collections and pages. */
  open: boolean;
  pagesScope: boolean;
  mode: ContentRedirectMode;
  targets: Record<string, string>;
  onMode: (mode: ContentRedirectMode) => void;
  /** `null` clears the target (back to the mode fallback). */
  onTarget: (ref: string, target: string | null) => void;
}

interface CreatorCategoryNode {
  id: string;
  slug: string;
  translations?: { locale: string; name: string }[];
  children?: CreatorCategoryNode[];
}

interface StorePageRow {
  id: string;
  type: string;
  slug: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  translations?: { locale: string; title?: string | null }[];
}

/**
 * Every old page / post URL with a target picker (home / import / skip /
 * a collection / a store page / another path), paginated at 50 rows. The
 * rows come from the dry-run summary (`content.items`, every page and
 * post with its current target; older summaries only carry
 * `content_unmapped`). Writes `content_redirects.targets`.
 */
function ContentSection({ token, summary, open, pagesScope, mode, targets, onMode, onTarget }: ContentSectionProps) {
  const t = useTranslations('creator.importer.mapping.content');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unmapped'>('all');
  const [customRow, setCustomRow] = useState<string | null>(null);
  const [customPath, setCustomPath] = useState('');
  const [collections, setCollections] = useState<{ slug: string; name: string }[] | null>(null);
  const [pages, setPages] = useState<{ slug: string; title: string }[] | null>(null);

  const rows: ContentRow[] = useMemo(() => {
    if (summary?.content?.items?.length) return summary.content.items;
    return (summary?.content_unmapped ?? []).map((r) => ({ ...r, target: null }));
  }, [summary]);

  // Store collections and pages for the picker, once the section is visible.
  useEffect(() => {
    if (!open || rows.length === 0 || collections !== null) return;
    let cancelled = false;
    api<CreatorCategoryNode[]>('/creator-categories', { token })
      .then((tree) => {
        if (cancelled) return;
        const flat: { slug: string; name: string }[] = [];
        const walk = (nodes: CreatorCategoryNode[], prefix: string) => {
          for (const c of nodes) {
            const name =
              c.translations?.find((tr) => tr.locale === locale)?.name ||
              c.translations?.find((tr) => tr.locale === 'en')?.name ||
              c.translations?.[0]?.name ||
              c.slug;
            flat.push({ slug: c.slug, name: prefix + name });
            if (c.children?.length) walk(c.children, `${prefix}— `);
          }
        };
        walk(Array.isArray(tree) ? tree : [], '');
        setCollections(flat);
      })
      .catch(() => {
        if (!cancelled) setCollections([]);
      });
    api<StorePageRow[]>('/v2/pages/mine', { token })
      .then((list) => {
        if (cancelled) return;
        setPages(
          (Array.isArray(list) ? list : [])
            .filter((p) => p.slug)
            .map((p) => ({
              slug: p.slug as string,
              title:
                p.translations?.find((tr) => tr.locale === locale)?.title ||
                p.translations?.find((tr) => tr.locale === 'en')?.title ||
                p.translations?.[0]?.title ||
                (p.slug as string),
            })),
        );
      })
      .catch(() => {
        if (!cancelled) setPages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, rows.length, collections, token, locale]);

  if (rows.length === 0) return <p className="text-xs text-muted-foreground">{t('none')}</p>;

  const isUnmapped = (r: ContentRow) => targets[r.ref] === undefined && mode === 'map';
  const visible = filter === 'unmapped' ? rows.filter(isUnmapped) : rows;
  const pageCount = Math.max(1, Math.ceil(visible.length / CONTENT_PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const slice = visible.slice((current - 1) * CONTENT_PAGE_SIZE, current * CONTENT_PAGE_SIZE);
  const unmappedCount = rows.filter(isUnmapped).length;

  /** Picker options: keywords first, then the store's collections and pages, then "other path". */
  const optionsFor = (row: ContentRow) => {
    const out: { value: string; label: string; description?: string }[] = [
      { value: 'home', label: t('targets.home'), description: '/' },
      ...(row.kind === 'page' ? [{ value: 'import', label: t('targets.import') }] : []),
      { value: 'skip', label: t('targets.skip') },
    ];
    for (const c of collections ?? []) out.push({ value: `/collections/${c.slug}`, label: t('targets.collection', { name: c.name }), description: `/collections/${c.slug}` });
    for (const p of pages ?? []) out.push({ value: `/${p.slug}`, label: t('targets.page', { title: p.title }), description: `/${p.slug}` });
    const value = targets[row.ref];
    if (value && !out.some((o) => o.value === value)) out.push({ value, label: value });
    out.push({ value: CUSTOM_TARGET, label: t('targets.custom') });
    return out;
  };

  const commitCustom = (ref: string) => {
    const v = customPath.trim();
    if (v.startsWith('/') && !v.startsWith('//')) onTarget(ref, v);
    setCustomRow(null);
    setCustomPath('');
  };

  return (
    <>
      <p className="text-[11px] text-muted-foreground">{t('intro')}</p>
      <p className="text-xs">
        {t('summary', { pages: summary?.content?.pages ?? rows.filter((r) => r.kind === 'page').length, posts: summary?.content?.posts ?? rows.filter((r) => r.kind === 'post').length, unmapped: unmappedCount })}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('mode')}</Label>
          <SearchableSelect
            options={CONTENT_REDIRECT_MODES.map((m) => ({ value: m, label: t(`modes.${m}`) }))}
            value={mode}
            onChange={(v) => onMode((v || 'map') as ContentRedirectMode)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('filter.label')}</Label>
          <SearchableSelect
            options={[
              { value: 'all', label: t('filter.all') },
              { value: 'unmapped', label: t('filter.unmapped') },
            ]}
            value={filter}
            onChange={(v) => {
              setFilter((v || 'all') as 'all' | 'unmapped');
              setPage(1);
            }}
          />
        </div>
      </div>
      {!pagesScope && <p className="text-[11px] text-muted-foreground">{t('importHint')}</p>}
      {collections === null && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {t('loading')}
        </p>
      )}
      <div className="space-y-2">
        {slice.map((row) => {
          const value = targets[row.ref];
          const custom = customRow === row.ref;
          return (
            <div key={row.ref} className={`grid items-center gap-2 rounded-md border px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] ${isUnmapped(row) ? 'border-amber-200 bg-amber-50/40' : ''}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="shrink-0 font-normal">
                    {t(`kind.${row.kind}`)}
                  </Badge>
                  <span className="truncate text-sm" title={row.title}>
                    {row.title || row.path}
                  </span>
                </div>
                <TechDetail value={row.path} className="block truncate" />
              </div>
              <div className="space-y-1.5">
                <SearchableSelect
                  options={optionsFor(row)}
                  value={custom ? CUSTOM_TARGET : (value ?? '')}
                  onChange={(v) => {
                    if (v === CUSTOM_TARGET) {
                      setCustomRow(row.ref);
                      setCustomPath(value && !['home', 'skip', 'import'].includes(value) ? value : '');
                    } else {
                      setCustomRow(null);
                      onTarget(row.ref, v || null);
                    }
                  }}
                  placeholder={!value && row.target === '/' ? t('targets.home') : !value && row.target === 'skip' ? t('targets.skip') : t('targetPlaceholder')}
                />
                {custom && (
                  <Input
                    dir="ltr"
                    autoFocus
                    className="h-8 font-mono text-xs"
                    value={customPath}
                    placeholder="/collections/..."
                    onChange={(e) => setCustomPath(e.target.value)}
                    onBlur={() => commitCustom(row.ref)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitCustom(row.ref);
                      }
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('pageOf', { page: current, pages: pageCount })}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label={tc('previous')}>
              <ChevronLeft className="rtl:rotate-180" />
            </Button>
            <Button variant="outline" size="sm" disabled={current >= pageCount} onClick={() => setPage(current + 1)} aria-label={tc('next')}>
              <ChevronRight className="rtl:rotate-180" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Key/value editor (label overrides, FAQ labels) ─────────────────────────

interface KvRow {
  id: number;
  k: string;
  v: string;
}

/** Stable row ids across every editor on the page (React keys, not persisted). */
let kvRowSeq = 0;
const nextKvRowId = () => ++kvRowSeq;

function KeyValueEditor({
  value,
  onChange,
  onDuplicate,
  keyPlaceholder,
  valuePlaceholder,
  suggestions = [],
}: {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  /** Reports whether two rows share a key (E12); the parent blocks saving. */
  onDuplicate?: (has: boolean) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
  suggestions?: string[];
}) {
  const t = useTranslations('creator.importer.mapping');
  // Rows keep a stable id (React key) and their order, and allow a
  // temporarily empty key while typing.
  const [rows, setRows] = useState<KvRow[]>(() => Object.entries(value).map(([k, v]) => ({ id: nextKvRowId(), k, v })));
  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows) {
      const k = r.k.trim();
      if (k) seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    return new Set(Array.from(seen.entries()).filter(([, n]) => n > 1).map(([k]) => k));
  }, [rows]);
  const dupRef = useRef(onDuplicate);
  useEffect(() => {
    dupRef.current = onDuplicate;
  }, [onDuplicate]);
  useEffect(() => {
    dupRef.current?.(duplicates.size > 0);
  }, [duplicates]);

  const commit = (next: KvRow[]) => {
    setRows(next);
    const rec: Record<string, string> = {};
    for (const r of next) rec[r.k] = r.v;
    onChange(rec);
  };
  const listId = `kv-${useId().replace(/:/g, '')}`;

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const dup = !!row.k.trim() && duplicates.has(row.k.trim());
        return (
          <div key={row.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <Input
                dir="ltr"
                list={suggestions.length ? listId : undefined}
                className={`h-8 w-48 font-mono text-xs ${dup ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                value={row.k}
                placeholder={keyPlaceholder}
                aria-invalid={dup || undefined}
                onChange={(e) => commit(rows.map((r) => (r.id === row.id ? { ...r, k: e.target.value } : r)))}
              />
              <Input
                className="h-8 flex-1 text-sm"
                value={row.v}
                placeholder={valuePlaceholder}
                onChange={(e) => commit(rows.map((r) => (r.id === row.id ? { ...r, v: e.target.value } : r)))}
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-9 max-sm:size-11"
                onClick={() => commit(rows.filter((r) => r.id !== row.id))}
                aria-label={t('removeRow')}
                title={t('removeRow')}
              >
                <Trash2 />
              </Button>
            </div>
            {dup && <p className="text-[11px] text-red-600">{t('errors.duplicateKey')}</p>}
          </div>
        );
      })}
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      <Button variant="outline" size="sm" onClick={() => setRows([...rows, { id: nextKvRowId(), k: '', v: '' }])}>
        <Plus />
        {t('addRow')}
      </Button>
    </div>
  );
}
