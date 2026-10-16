'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { useApiError } from '@/lib/useApiError';
import { listRunLogs, type ImportLogLevel, type ImportRunLogView, type Paged } from '@/lib/importer.api';
import { ErrorBanner, isLabelledWarningCode, useDateTimeFormat, useWarningLabel } from '@/components/importer/ImporterBits';

const PAGE_SIZE = 50;

const LEVEL_TONE: Record<ImportLogLevel, string> = {
  INFO: 'bg-zinc-50 text-zinc-700 border-zinc-200',
  WARN: 'bg-amber-50 text-amber-700 border-amber-200',
  ERROR: 'bg-red-50 text-red-700 border-red-200',
};

/** References a designer warning carries in `data` (NPP element id, asset key). */
function warningRefs(data: unknown): { elementId: string | null; key: string | null } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { elementId: null, key: null };
  const d = data as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);
  return { elementId: str(d.element_id), key: str(d.key) };
}

/** Logs table of a run (`GET runs/:id/logs`), filterable by level. */
export function RunLogs({ token, runId, version }: { token: string; runId: string; version?: string }) {
  const t = useTranslations('creator.importer.logs');
  const describeError = useApiError();
  const formatDate = useDateTimeFormat();
  const warningLabel = useWarningLabel();
  const [level, setLevel] = useState<'all' | ImportLogLevel>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<ImportRunLogView> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listRunLogs(token, runId, { level: level === 'all' ? undefined : level, page, limit: PAGE_SIZE })
      .then(setData)
      .catch((err: unknown) => setError(describeError(err)))
      .finally(() => setLoading(false));
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, runId, level, page]);

  // `version` changes with the run status, so new log lines appear while it works.
  useEffect(() => {
    load();
  }, [load, version]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.limit || PAGE_SIZE))) : 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-44">
          <SearchableSelect
            options={[
              { value: 'all', label: t('allLevels') },
              { value: 'INFO', label: t('levels.INFO') },
              { value: 'WARN', label: t('levels.WARN') },
              { value: 'ERROR', label: t('levels.ERROR') },
            ]}
            value={level}
            onChange={(v) => {
              setLevel((v || 'all') as typeof level);
              setPage(1);
            }}
          />
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {t('refresh')}
        </Button>
        {data && <span className="ms-auto text-xs text-muted-foreground">{t('total', { count: data.total })}</span>}
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="max-h-[50vh] overflow-auto rounded-lg border bg-white">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-start font-semibold">{t('time')}</th>
              <th className="px-3 py-2 text-start font-semibold">{t('level')}</th>
              <th className="px-3 py-2 text-start font-semibold">{t('code')}</th>
              <th className="px-3 py-2 text-start font-semibold">{t('message')}</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  {loading ? <Loader2 className="mx-auto size-4 animate-spin" /> : t('empty')}
                </td>
              </tr>
            ) : (
              data!.items.map((log) => (
                <tr key={log.id} className="border-b last:border-0 align-top">
                  <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{formatDate(log.created_at)}</td>
                  <td className="px-3 py-1.5">
                    <Badge variant="outline" className={LEVEL_TONE[log.level] ?? ''}>
                      {t.has(`levels.${log.level}`) ? t(`levels.${log.level}`) : log.level}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="block font-mono text-[10px]" dir="ltr">
                      {log.code}
                    </span>
                    {isLabelledWarningCode(log.code) && <span className="text-muted-foreground">{warningLabel(log.code)}</span>}
                    {(() => {
                      const refs = warningRefs(log.data);
                      if (!refs.elementId && !refs.key) return null;
                      return (
                        <span className="mt-0.5 flex flex-wrap gap-1">
                          {refs.elementId && (
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {t('dataElement')} <bdi className="font-mono" dir="ltr">{refs.elementId}</bdi>
                            </Badge>
                          )}
                          {refs.key && (
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {t('dataKey')} <bdi className="font-mono" dir="ltr">{refs.key}</bdi>
                            </Badge>
                          )}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-1.5 break-words">
                    {log.message}
                    {log.external_ref && (
                      <span className="ms-2 font-mono text-[10px] text-muted-foreground" dir="ltr">
                        {log.external_ref}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
            {t('prev')}
          </Button>
          <span className="tabular-nums text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
            {t('next')}
          </Button>
        </div>
      )}
    </div>
  );
}
