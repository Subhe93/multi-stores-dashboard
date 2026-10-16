'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SUMMARY_ACTIONS, SUMMARY_ENTITY_TYPES, type DryRunSummary } from '@/lib/importer.api';
import { SectionTitle, StatTile, useErrorCodeText } from '@/components/importer/ImporterBits';
import { WarningGroups } from '@/components/importer/WarningGroups';

/** Redirect rows shown in the preview (§13: first 50). */
const REDIRECT_PREVIEW_MAX = 50;

const ACTION_TONE: Record<string, string> = {
  CREATE: 'text-emerald-700',
  UPDATE: 'text-sky-700',
  UNCHANGED: 'text-muted-foreground',
  SKIP: 'text-zinc-600',
  CONFLICT: 'text-amber-700',
  STAGE: 'text-indigo-700',
  ERROR: 'text-red-700',
  DELETE: 'text-red-700',
  ARCHIVE: 'text-orange-700',
};

interface DryRunReportProps {
  summary: DryRunSummary;
}

/**
 * Dry-run (or apply) report of a run: summary tiles, counts per entity ×
 * action, warnings, skipped products, media, old slugs, term cleanup and the
 * redirect preview. Every section hides itself when the summary lacks it.
 */
export function DryRunReport({ summary }: DryRunReportProps) {
  const t = useTranslations('creator.importer.report');
  const locale = useLocale();
  const n = (v: number | null | undefined) => new Intl.NumberFormat(locale).format(v ?? 0);

  const sanitizerFallback = summary.plan?.sanitizer === 'plain_text_fallback';

  const p = summary.products;
  const v = summary.variants;
  const c = summary.categories;
  const m = summary.media;
  const r = summary.redirects;
  const warningsTotal = Object.values(summary.warnings ?? {}).reduce((s, g) => s + (g?.count ?? 0), 0);
  const redirectPreview = (r?.preview ?? []).slice(0, REDIRECT_PREVIEW_MAX);
  const unmapped = Object.entries(summary.unmapped_meta_prefixes ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {sanitizerFallback && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <Info className="mt-0.5 size-4 shrink-0" />
          {t('sanitizerFallback')}
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {p && (
          <StatTile
            label={t('tiles.products')}
            value={n(p.imported)}
            hint={t('tiles.productsHint', { inSource: p.in_source, skipped: p.skipped })}
          />
        )}
        {v && (
          <StatTile
            label={t('tiles.variants')}
            value={n(v.imported)}
            hint={t('tiles.variantsHint', { dropped: v.dropped_any ?? 0, inactive: v.inactive ?? 0 })}
          />
        )}
        {c && (
          <StatTile label={t('tiles.collections')} value={n(c.total)} hint={t('tiles.collectionsHint', { empty: c.empty ?? 0 })} />
        )}
        {m && (
          <StatTile
            label={t('tiles.media')}
            value={n(m.public_distinct + m.private_distinct)}
            hint={t('tiles.mediaHint', { missing: m.missing_in_bundle })}
            tone={m.missing_in_bundle > 0 ? 'warn' : undefined}
          />
        )}
        {r && <StatTile label={t('tiles.redirects')} value={n(r.total)} />}
        {summary.personalization && (
          <StatTile
            label={t('tiles.presets')}
            value={n(summary.personalization.presets)}
            hint={t('tiles.presetsHint', { products: summary.personalization.products })}
          />
        )}
        {summary.designer && (summary.designer.templates ?? 0) > 0 && (
          <StatTile
            label={t('tiles.templates')}
            value={n(summary.designer.templates)}
            hint={t('tiles.templatesHint', { fields: summary.designer.fallback_fields ?? 0 })}
          />
        )}
        <StatTile label={t('tiles.warnings')} value={n(warningsTotal)} tone={warningsTotal > 0 ? 'warn' : undefined} />
      </div>

      {/* Apply result (after the import ran) */}
      {summary.apply && <ApplyResult apply={summary.apply} />}

      {/* Rollback result */}
      {summary.rollback && <RollbackResult rollback={summary.rollback} />}

      {/* Counts per entity × action (the plan) */}
      {Object.keys(summary.counts ?? {}).length > 0 && (
        <section className="space-y-2">
          <SectionTitle>{t('countsTitle')}</SectionTitle>
          <CountsTable counts={summary.counts ?? {}} />
        </section>
      )}

      {/* Warnings */}
      {summary.warnings && (
        <section className="space-y-2">
          <SectionTitle>{t('warningsTitle')}</SectionTitle>
          <WarningGroups warnings={summary.warnings} />
        </section>
      )}

      {/* Skipped products */}
      {summary.skipped && summary.skipped.length > 0 && (
        <section className="space-y-2">
          <SectionTitle>{t('skippedTitle', { count: summary.skipped.length })}</SectionTitle>
          <div className="divide-y rounded-lg border bg-white text-sm">
            {summary.skipped.map((s) => (
              <div key={s.external_ref} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <span className="font-medium">{s.title || '—'}</span>
                <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                  {s.external_ref}
                </span>
                <Badge variant="outline" className="ms-auto">
                  {t.has(`skipReasons.${s.reason}`) ? t(`skipReasons.${s.reason}`) : s.reason}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Media check */}
        {m && (
          <section className="space-y-2">
            <SectionTitle>{t('mediaTitle')}</SectionTitle>
            <dl className="space-y-1.5 rounded-lg border bg-white p-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t('mediaPublic')}</dt>
                <dd className="tabular-nums">{n(m.public_distinct)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t('mediaPrivate')}</dt>
                <dd className="tabular-nums">{n(m.private_distinct)}</dd>
              </div>
              {summary.images && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t('mediaImageRows')}</dt>
                  <dd className="tabular-nums">{n(summary.images.rows)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t('mediaMissing')}</dt>
                <dd className={`tabular-nums ${m.missing_in_bundle > 0 ? 'font-medium text-amber-700' : ''}`}>
                  {n(m.missing_in_bundle)}
                </dd>
              </div>
              {m.missing_in_bundle > 0 && <p className="pt-1 text-xs text-amber-700">{t('mediaMissingHint')}</p>}
            </dl>
          </section>
        )}

        {/* Old slugs */}
        {summary.old_slugs && (
          <section className="space-y-2">
            <SectionTitle>{t('oldSlugsTitle')}</SectionTitle>
            <div className="space-y-2 rounded-lg border bg-white p-3 text-sm">
              <p className="text-muted-foreground">
                {t('oldSlugsSummary', { total: summary.old_slugs.total, redirected: summary.old_slugs.redirected })}
              </p>
              {(summary.old_slugs.excluded ?? []).length > 0 && (
                <ul className="space-y-1 text-xs">
                  {summary.old_slugs.excluded!.map((x) => (
                    <li key={`${x.external_ref}:${x.slug}`} className="flex flex-wrap items-center gap-2">
                      <span className="font-mono" dir="ltr">
                        {x.slug}
                      </span>
                      <span className="text-muted-foreground">
                        {t.has(`oldSlugReasons.${x.reason}`) ? t(`oldSlugReasons.${x.reason}`) : x.reason}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Shipping availability */}
      {summary.shipping && !summary.shipping.zones_available && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <Info className="mt-0.5 size-4 shrink-0" />
          {t('shippingMissing')}
        </div>
      )}

      {/* Term cleanup preview */}
      {summary.term_cleanup && summary.term_cleanup.length > 0 && (
        <section className="space-y-2">
          <SectionTitle>{t('termCleanupTitle', { count: summary.term_cleanup.length })}</SectionTitle>
          <TermCleanupTable rows={summary.term_cleanup} />
        </section>
      )}

      {/* Redirect preview */}
      {r && (
        <section className="space-y-2">
          <SectionTitle
            aside={
              r.by_rule && (
                <div className="flex flex-wrap justify-end gap-1">
                  {Object.entries(r.by_rule).map(([rule, count]) => (
                    <Badge key={rule} variant="outline" className="font-normal">
                      {t.has(`redirectRules.${rule}`) ? t(`redirectRules.${rule}`) : rule}: {count}
                    </Badge>
                  ))}
                </div>
              )
            }
          >
            {t('redirectsTitle', { shown: redirectPreview.length, total: r.total })}
          </SectionTitle>
          {redirectPreview.length > 0 ? (
            <div className="max-h-80 overflow-auto rounded-lg border bg-white">
              <table className="w-full text-xs">
                <tbody>
                  {redirectPreview.map((row, i) => (
                    <tr key={`${row.from}:${i}`} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-mono break-all" dir="ltr">
                        {row.from}
                      </td>
                      <td className="px-1 py-1.5 text-muted-foreground">
                        <ArrowRight className="size-3 rtl:-scale-x-100" />
                      </td>
                      <td className="px-3 py-1.5 font-mono break-all" dir="ltr">
                        {row.to}
                      </td>
                      <td className="px-3 py-1.5 text-end text-muted-foreground whitespace-nowrap">
                        {t.has(`redirectRules.${row.rule}`) ? t(`redirectRules.${row.rule}`) : row.rule}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noRedirects')}</p>
          )}
        </section>
      )}

      {/* Unmapped meta prefixes */}
      {unmapped.length > 0 && (
        <section className="space-y-2">
          <SectionTitle>{t('unmappedTitle')}</SectionTitle>
          <p className="text-xs text-muted-foreground">{t('unmappedHint')}</p>
          <div className="flex flex-wrap gap-1.5">
            {unmapped.map(([prefix, count]) => (
              <Badge key={prefix} variant="outline" className="font-mono font-normal" dir="ltr">
                {prefix} · {count}
              </Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Before → after rows of the attribute/term name cleanup (D22). */
export function TermCleanupTable({ rows }: { rows: NonNullable<DryRunSummary['term_cleanup']> }) {
  const t = useTranslations('creator.importer.report');
  return (
    <div className="max-h-80 overflow-auto rounded-lg border bg-white">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2 text-start font-semibold">{t('termTaxonomy')}</th>
            <th className="px-3 py-2 text-start font-semibold">{t('termBefore')}</th>
            <th className="px-3 py-2 text-start font-semibold">{t('termAfter')}</th>
            <th className="px-3 py-2 text-start font-semibold">{t('termRules')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.taxonomy}:${row.slug}`} className="border-b last:border-0 align-top">
              <td className="px-3 py-1.5 font-mono text-muted-foreground" dir="ltr">
                {row.taxonomy}
              </td>
              <td className="px-3 py-1.5 text-muted-foreground line-through decoration-zinc-300">{row.before}</td>
              <td className="px-3 py-1.5 font-medium">{row.after}</td>
              <td className="px-3 py-1.5">
                <div className="flex flex-wrap gap-1">
                  {row.rules.map((rule) => (
                    <Badge key={rule} variant="outline" className="font-normal">
                      {t.has(`cleanupRules.${rule}`) ? t(`cleanupRules.${rule}`) : rule}
                    </Badge>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Counts, apply and rollback results ──────────────────────────────────────

type CountsMap = Partial<Record<string, Partial<Record<string, number>>>>;

/** Entity × action table (plan counts or apply counts). */
export function CountsTable({ counts }: { counts: CountsMap }) {
  const t = useTranslations('creator.importer.report');
  const te = useTranslations('creator.importer.entities');
  const ta = useTranslations('creator.importer.itemActions');
  const locale = useLocale();
  const n = (v: number | null | undefined) => new Intl.NumberFormat(locale).format(v ?? 0);

  const knownTypes = SUMMARY_ENTITY_TYPES.filter((k) => counts[k]);
  const otherTypes = Object.keys(counts).filter((k) => !(SUMMARY_ENTITY_TYPES as readonly string[]).includes(k));
  const entityRows = [...knownTypes, ...otherTypes];
  const usedActions = [
    ...SUMMARY_ACTIONS.filter((a) => entityRows.some((e) => (counts[e]?.[a] ?? 0) > 0)),
    ...Array.from(new Set(entityRows.flatMap((e) => Object.keys(counts[e] ?? {}))).values()).filter(
      (a) => !(SUMMARY_ACTIONS as readonly string[]).includes(a),
    ),
  ];
  if (entityRows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2 text-start font-semibold">{t('entity')}</th>
            {usedActions.map((a) => (
              <th key={a} className="px-3 py-2 text-end font-semibold">
                {ta.has(a) ? ta(a) : a}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entityRows.map((e) => (
            <tr key={e} className="border-b last:border-0">
              <td className="px-3 py-2">{te.has(e) ? te(e) : e}</td>
              {usedActions.map((a) => {
                const value = counts[e]?.[a] ?? 0;
                return (
                  <td key={a} className={`px-3 py-2 text-end tabular-nums ${value ? (ACTION_TONE[a] ?? '') : 'text-zinc-300'}`}>
                    {value ? n(value) : '·'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Numeric entries of a result object (`{created: 3, skipped: 1, …}`), nested objects ignored. */
function numericEntries(obj: Record<string, unknown> | null | undefined): [string, number][] {
  return Object.entries(obj ?? {}).filter((e): e is [string, number] => typeof e[1] === 'number');
}

/** "products_deleted" → "Products deleted" for result keys without a translation. */
function humanizeKey(key: string): string {
  const s = key.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** What the import wrote (`summary.apply`): counts per entity × action, error items, redirects. */
function ApplyResult({ apply }: { apply: NonNullable<DryRunSummary['apply']> }) {
  const t = useTranslations('creator.importer.report');
  const locale = useLocale();
  const n = (v: number) => new Intl.NumberFormat(locale).format(v);
  const codeText = useErrorCodeText();
  const errors = apply.errors ?? 0;
  const redirects = numericEntries(apply.redirects ?? null).filter(([, v]) => v > 0);
  // Reasons are `CODE:detail` (e.g. `IMPORT_PRODUCT_ERRORS:5/40`).
  const reasons = apply.outcome?.failed
    ? (apply.outcome.reasons ?? []).map((r) => {
        const i = r.indexOf(':');
        const code = i > 0 ? r.slice(0, i) : r;
        const detail = i > 0 ? r.slice(i + 1).trim() : '';
        return { key: r, text: codeText(code), detail };
      })
    : [];

  return (
    <section className="space-y-2">
      <SectionTitle
        aside={
          <Badge
            variant="outline"
            className={errors > 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}
          >
            {errors > 0 ? t('applyErrors', { count: errors }) : t('applyNoErrors')}
          </Badge>
        }
      >
        {t('applyTitle')}
      </SectionTitle>
      {reasons.length > 0 && (
        <div className="space-y-1 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">{t('applyOutcomeFailed')}</p>
          <ul className="list-disc space-y-0.5 ps-5">
            {reasons.map((r) => (
              <li key={r.key}>
                {r.text}
                {r.detail && (
                  <span className="ms-1 tabular-nums" dir="ltr">
                    ({r.detail})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <CountsTable counts={apply.counts ?? {}} />
      {redirects.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('applyRedirects')}{' '}
          {redirects.map(([k, v]) => `${t.has(`resultKeys.${k}`) ? t(`resultKeys.${k}`) : humanizeKey(k)}: ${n(v)}`).join(' · ')}
        </p>
      )}
    </section>
  );
}

/** What a rollback did (`summary.rollback`), and the edited entities it left alone. */
function RollbackResult({ rollback }: { rollback: NonNullable<DryRunSummary['rollback']> }) {
  const t = useTranslations('creator.importer.report');
  const locale = useLocale();
  const n = (v: number) => new Intl.NumberFormat(locale).format(v);
  const rows = numericEntries(rollback).filter(([, v]) => v > 0);
  const lists = (
    [
      ['archived_edited', rollback.archived_edited],
      ['skipped_edited', rollback.skipped_edited],
    ] as const
  ).filter(([, list]) => Array.isArray(list) && list.length > 0);

  return (
    <section className="space-y-2">
      <SectionTitle>{t('rollbackTitle')}</SectionTitle>
      {rows.length > 0 ? (
        <dl className="grid gap-x-6 gap-y-1 rounded-lg border bg-white p-3 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t.has(`resultKeys.${k}`) ? t(`resultKeys.${k}`) : humanizeKey(k)}</dt>
              <dd className="tabular-nums">{n(v)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">{t('rollbackNothing')}</p>
      )}
      {lists.map(([key, list]) => (
        <div key={key} className="space-y-1.5">
          <p className="text-xs font-medium">{t(`rollbackLists.${key}`, { count: list!.length })}</p>
          <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border bg-white text-xs">
            {list!.map((ent, i) => (
              <li key={`${ent.external_ref ?? ent.target_id ?? ''}:${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5">
                <span className="font-medium">{ent.title || ent.external_ref || ent.target_id || '—'}</span>
                {ent.entity_type && <Badge variant="outline" className="font-normal">{ent.entity_type}</Badge>}
                {ent.external_ref && ent.title && (
                  <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">
                    {ent.external_ref}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
