'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Plus, RefreshCw, Save, SlidersHorizontal, Trash2, X } from 'lucide-react';
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
  type ImportRunOptions,
  type ImportRunView,
  type StockOnUpdate,
  type TargetProductStatus,
} from '@/lib/importer.api';
import { ErrorBanner, RunStatusBadge, SpinnerBlock, runLabel, useDateTimeFormat } from '@/components/importer/ImporterBits';
import { RunProgress } from '@/components/importer/RunProgress';
import { TermCleanupTable } from '@/components/importer/DryRunReport';

/** Sections of the review, also the targets of "jump to the problem". */
type Section = 'category' | 'scopes' | 'products' | 'attributes' | 'faq' | 'shipping' | 'handoff';

/** Option key (first path segment of a validator message) → section. */
const SECTION_OF_OPTION: Record<string, Section> = {
  platform_category_id: 'category',
  scopes: 'scopes',
  include_drafts: 'products',
  status_map: 'products',
  skip_ext_ids: 'products',
  conflict_policy: 'products',
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
};

/** Shipping method ids whose display names can be overridden (D26). */
const METHOD_IDS = ['flat_rate', 'local_pickup', 'free_shipping'];
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
}

/** Mapping review (§13) of a planned run; saving re-plans the run. */
export function MappingReviewTab({ token, runId, focus, onSelectRun, onOpenRun, onChanged }: MappingReviewTabProps) {
  const t = useTranslations('creator.importer.mapping');
  const formatDate = useDateTimeFormat();
  const [candidates, setCandidates] = useState<ImportRunView[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listRuns(token, { page: 1, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        const list = (res.items ?? []).filter((r) => canEditOptions(r.status) || isActiveRun(r.status) || r.id === runId);
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
    // onSelectRun is stable for the page's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, runId]);

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
        <MappingForm key={`${run.id}:${run.plan_fingerprint ?? run.planned_at ?? run.status}`} token={token} run={run} focus={focus} onSaved={(next) => {
            if (next?.id) setRun(next);
            onChanged();
          }} />
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
}: {
  token: string;
  run: ImportRunView;
  focus: string | null;
  onSaved: (run: ImportRunView) => void;
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

  const update = (patch: Partial<ImportRunOptions>) => {
    setOpts((o) => ({ ...o, ...patch }));
    setDirty(true);
  };

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

  // ── Source products for the skip list (plan items) ──
  const [products, setProducts] = useState<{ ref: string; title: string }[]>([]);
  useEffect(() => {
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
  }, [token, run.id]);

  const titleOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of summary?.skipped ?? []) map[s.external_ref] = s.title;
    for (const p of products) map[p.ref] = p.title;
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
    if (emptyKey(opts.label_overrides)) errs.attributes = t('errors.overrideIncomplete');
    if (emptyKey(opts.faq_labels)) errs.faq = t('errors.overrideIncomplete');
    return errs;
  };

  const sectionOfError = (key: string): Section =>
    key === 'platform_category_id' ? 'category' : key === 'days' ? 'shipping' : (key as Section);

  const jumpTo = (section: Section) => {
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

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="space-y-4">
        {run.status === 'PLAN_FAILED' && <ErrorBanner message={t('planFailed')} />}

        {/* Platform category */}
        <Card id="importer-section-category" className={`scroll-mt-4 shadow-none ${errors.platform_category_id ? 'border-red-300' : ''}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {t('sections.category')} {needsPlatformCategory(opts) && <span className="text-red-500">*</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 pt-0">
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
          </CardContent>
        </Card>

        {/* Scopes */}
        <Card id="importer-section-scopes" className="scroll-mt-4 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t('sections.scopes')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {sectionError('scopes')}
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
            </div>
          </CardContent>
        </Card>

        {/* Products */}
        <Card id="importer-section-products" className="scroll-mt-4 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t('sections.products')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {sectionError('products')}
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
                <Label className="text-xs">{t('conflictPolicy')}</Label>
                <SearchableSelect
                  options={[
                    { value: 'SKIP_MODIFIED', label: t('conflict.SKIP_MODIFIED'), description: t('conflict.SKIP_MODIFIED_hint') },
                    { value: 'OVERWRITE', label: t('conflict.OVERWRITE'), description: t('conflict.OVERWRITE_hint') },
                  ]}
                  value={opts.conflict_policy ?? 'SKIP_MODIFIED'}
                  onChange={(v) => update({ conflict_policy: (v || 'SKIP_MODIFIED') as ImportRunOptions['conflict_policy'] })}
                />
              </div>
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
              <div className="flex flex-wrap gap-2">
                <div className="min-w-56 flex-1">
                  <SearchableSelect
                    options={products.filter((p) => !skip.includes(p.ref)).map((p) => ({ value: p.ref, label: p.title, description: p.ref }))}
                    value=""
                    onChange={(v) => v && addSkip(v)}
                    placeholder={t('skipSearch')}
                    searchPlaceholder={t('skipSearchPlaceholder')}
                  />
                </div>
                <Input
                  dir="ltr"
                  className="h-8 w-56 font-mono text-xs"
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
              {skip.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {skip.map((ref) => (
                    <Badge key={ref} variant="outline" className="h-auto gap-1.5 py-1 font-normal">
                      <span>{titleOf[ref] ?? ref}</span>
                      {titleOf[ref] && (
                        <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">
                          {ref}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => update({ skip_ext_ids: skip.filter((r) => r !== ref) })}
                        aria-label={tc('remove')}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">{t('skipEmpty')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Attributes and terms */}
        <Card id="importer-section-attributes" className="scroll-mt-4 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t('sections.attributes')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {sectionError('attributes')}
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
                keyPlaceholder="pa_size"
                valuePlaceholder={t('labelPlaceholder')}
                suggestions={taxonomies}
              />
            </div>
          </CardContent>
        </Card>

        {/* FAQ labels */}
        <Card id="importer-section-faq" className="scroll-mt-4 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t('sections.faq')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {sectionError('faq')}
            <p className="text-[11px] text-muted-foreground">{t('faqHint')}</p>
            <KeyValueEditor
              value={opts.faq_labels ?? {}}
              onChange={(v) => update({ faq_labels: v })}
              keyPlaceholder="product_delivery"
              valuePlaceholder={t('faqPlaceholder')}
            />
          </CardContent>
        </Card>

        {/* Shipping */}
        <Card id="importer-section-shipping" className="scroll-mt-4 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t('sections.shipping')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {sectionError('shipping')}
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
              {METHOD_IDS.concat(Object.keys(opts.shipping?.method_names ?? {}).filter((k) => !METHOD_IDS.includes(k))).map((id) => (
                <div key={id} className="grid items-center gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
                  <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                    {id}
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
              ))}
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
          </CardContent>
        </Card>

        {/* Personalization, templates and other hand-offs */}
        <Card id="importer-section-handoff" className="scroll-mt-4 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t('sections.handoff')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {sectionError('handoff')}
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
                    <Badge key={key} variant="outline" className="font-mono font-normal" dir="ltr">
                      {key} · {count}
                    </Badge>
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
          </CardContent>
        </Card>
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
              {(['category', 'scopes', 'products', 'attributes', 'faq', 'shipping', 'handoff'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => jumpTo(s)}
                  className={`block w-full rounded px-2 py-1 text-start hover:bg-zinc-50 ${
                    errors[s] || (s === 'category' && errors.platform_category_id) || (s === 'shipping' && errors.days)
                      ? 'font-medium text-red-600'
                      : 'text-muted-foreground'
                  }`}
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

// ─── Key/value editor (label overrides, FAQ labels) ─────────────────────────

function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  suggestions = [],
}: {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
  suggestions?: string[];
}) {
  const t = useTranslations('creator.importer.mapping');
  // Rows keep their order and allow a temporarily empty key while typing.
  const [rows, setRows] = useState<{ k: string; v: string }[]>(() => Object.entries(value).map(([k, v]) => ({ k, v })));
  const commit = (next: { k: string; v: string }[]) => {
    setRows(next);
    const rec: Record<string, string> = {};
    for (const r of next) rec[r.k] = r.v;
    onChange(rec);
  };
  const listId = `kv-${useId().replace(/:/g, '')}`;

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            dir="ltr"
            list={suggestions.length ? listId : undefined}
            className="h-8 w-48 font-mono text-xs"
            value={row.k}
            placeholder={keyPlaceholder}
            onChange={(e) => commit(rows.map((r, j) => (j === i ? { ...r, k: e.target.value } : r)))}
          />
          <Input
            className="h-8 flex-1 text-sm"
            value={row.v}
            placeholder={valuePlaceholder}
            onChange={(e) => commit(rows.map((r, j) => (j === i ? { ...r, v: e.target.value } : r)))}
          />
          <Button variant="ghost" size="icon" className="size-8" onClick={() => commit(rows.filter((_, j) => j !== i))} aria-label={t('removeRow')}>
            <Trash2 />
          </Button>
        </div>
      ))}
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      <Button variant="outline" size="sm" onClick={() => setRows([...rows, { k: '', v: '' }])}>
        <Plus />
        {t('addRow')}
      </Button>
    </div>
  );
}
