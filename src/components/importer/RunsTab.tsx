'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { History, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/common/DataTable';
import { useApiError } from '@/lib/useApiError';
import { isActiveRun, listRuns, type ImportRunView, type Paged } from '@/lib/importer.api';
import { ErrorBanner, RunStatusBadge, runLabel, useDateTimeFormat } from '@/components/importer/ImporterBits';

const PAGE_SIZE = 20;

/** Created + updated count of one entity in a list item's `counts` (`{PRODUCT: {CREATE: 10, UPDATE: 2}}`). */
function countValue(counts: NonNullable<ImportRunView['counts']>, entity: string): number | null {
  const v = counts[entity];
  return v ? (v.CREATE ?? 0) + (v.UPDATE ?? 0) : null;
}

/** ERROR items across every entity of a list item's `counts`. */
function errorCount(counts: NonNullable<ImportRunView['counts']>): number {
  return Object.values(counts).reduce((sum, v) => sum + (v?.ERROR ?? 0), 0);
}

/** List refresh while some run on the page is still active. */
const LIST_POLL_MS = 5000;

interface RunsTabProps {
  token: string;
  /** Bumped by the page after a run is started or changed. */
  version: number;
  sourceNames: Record<string, string>;
  onOpen: (run: ImportRunView) => void;
}

/** Import history: every run of the store with status, author, dates and counts (§13 "Runs"). */
export function RunsTab({ token, version, sourceNames, onOpen }: RunsTabProps) {
  const t = useTranslations('creator.importer.runs');
  const locale = useLocale();
  const describeError = useApiError();
  const formatDate = useDateTimeFormat();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<ImportRunView> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (quiet = false) => {
      if (!quiet) setLoading(true);
      listRuns(token, { page, limit: PAGE_SIZE })
        .then((res) => {
          setData(res);
          setError(null);
        })
        .catch((err: unknown) => setError(describeError(err)))
        .finally(() => setLoading(false));
    },
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, page],
  );

  useEffect(() => {
    load();
  }, [load, version]);

  // Keep statuses fresh while a run on this page is working.
  const anyActive = !!data?.items.some((r) => isActiveRun(r.status));
  useEffect(() => {
    if (!anyActive) return;
    const timer = setInterval(() => load(true), LIST_POLL_MS);
    return () => clearInterval(timer);
  }, [anyActive, load]);

  const nf = new Intl.NumberFormat(locale);
  const countsOf = (run: ImportRunView): string => {
    const parts: string[] = [];
    const push = (key: 'countProducts' | 'countCollections' | 'countRedirects' | 'countErrors', value: number | null) => {
      if (value !== null && (value > 0 || key !== 'countErrors')) parts.push(t(key, { count: nf.format(value) }));
    };
    if (run.counts) {
      // List items carry a small `counts` object (the full summary is not sent):
      // what the import wrote (APPLY), or what the dry run plans (PLAN).
      push('countProducts', countValue(run.counts, 'PRODUCT'));
      push('countCollections', countValue(run.counts, 'CATEGORY'));
      push('countRedirects', countValue(run.counts, 'REDIRECT'));
      push('countErrors', errorCount(run.counts));
    } else if (run.summary) {
      const s = run.summary;
      if (s.products) push('countProducts', s.products.imported);
      if (s.categories) push('countCollections', s.categories.total);
      if (s.redirects) push('countRedirects', s.redirects.total);
    }
    const text = parts.join(' · ');
    if (!text) return '—';
    return run.counts && run.counts_phase === 'PLAN' ? t('countsPlanned', { counts: text }) : text;
  };

  const columns = [
    {
      key: 'id',
      label: t('columns.run'),
      render: (run: ImportRunView) => (
        <button type="button" onClick={() => onOpen(run)} className="font-mono text-sm font-medium text-primary hover:underline" dir="ltr">
          {runLabel(run)}
        </button>
      ),
    },
    {
      key: 'source',
      label: t('columns.source'),
      render: (run: ImportRunView) => (
        <span className="block max-w-48 truncate">{run.source?.name ?? sourceNames[run.source_id] ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      label: t('columns.status'),
      render: (run: ImportRunView) => <RunStatusBadge status={run.status} />,
    },
    {
      key: 'created_by',
      label: t('columns.createdBy'),
      render: (run: ImportRunView) => (
        <span className="text-muted-foreground">
          {run.created_by_role === 'ADMIN'
            ? t('platformAdmin')
            : run.created_by_role === 'OWNER'
              ? (run.created_by_name ?? t('storeOwner'))
              : '—'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: t('columns.created'),
      render: (run: ImportRunView) => <span className="whitespace-nowrap">{formatDate(run.created_at)}</span>,
    },
    {
      key: 'finished_at',
      label: t('columns.finished'),
      render: (run: ImportRunView) => <span className="whitespace-nowrap">{formatDate(run.finished_at)}</span>,
    },
    {
      key: 'counts',
      label: t('columns.counts'),
      render: (run: ImportRunView) => <span className="text-xs text-muted-foreground">{countsOf(run)}</span>,
    },
    {
      key: 'open',
      label: '',
      render: (run: ImportRunView) => (
        <Button variant="outline" size="sm" onClick={() => onOpen(run)}>
          {t('open')}
        </Button>
      ),
    },
  ];

  if (loading && !data) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!error && data && data.total === 0) {
    return (
      <Card className="shadow-none">
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <History className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">{t('emptyTitle')}</p>
          <p className="max-w-md text-sm text-muted-foreground">{t('emptyBody')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <ErrorBanner
          message={error}
          action={
            <Button variant="outline" size="sm" onClick={() => load()}>
              <RefreshCw /> {t('retry')}
            </Button>
          }
        />
      )}
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        emptyMessage={t('emptyTitle')}
        actions={
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {t('refresh')}
          </Button>
        }
        pagination={
          data
            ? { total: data.total, page: data.page, limit: data.limit, totalPages: Math.max(1, Math.ceil(data.total / (data.limit || PAGE_SIZE))) }
            : undefined
        }
        onPageChange={setPage}
      />
    </div>
  );
}
