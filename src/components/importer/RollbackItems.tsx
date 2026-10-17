'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApiError } from '@/lib/useApiError';
import { listRunItems, type ImportRunItemView, type Paged } from '@/lib/importer.api';
import { ErrorBanner, SectionTitle, useItemMessage } from '@/components/importer/ImporterBits';

const PAGE_SIZE = 50;

interface RollbackItemsProps {
  token: string;
  runId: string;
  /** Changes when the run changes (status), so the list reloads. */
  version: string;
}

/** What a rollback did per entity (ROLLBACK items), with the API notes translated. */
export function RollbackItems({ token, runId, version }: RollbackItemsProps) {
  const t = useTranslations('creator.importer.report');
  const te = useTranslations('creator.importer.entities');
  const ta = useTranslations('creator.importer.itemActions');
  const tc = useTranslations('common');
  const describeError = useApiError();
  const itemMessage = useItemMessage();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<ImportRunItemView> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listRunItems(token, runId, { phase: 'ROLLBACK', page, limit: PAGE_SIZE })
      .then((res) => {
        if (!alive) return;
        setData(res);
        setError(null);
      })
      .catch((err: unknown) => alive && setError(describeError(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, runId, page, version]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.limit || PAGE_SIZE))) : 1;

  return (
    <section className="space-y-2">
      <SectionTitle aside={loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}>
        {t('rollbackItemsTitle')}
      </SectionTitle>
      {error && <ErrorBanner message={error} />}
      {data && data.total === 0 && <p className="text-sm text-muted-foreground">{t('rollbackItemsEmpty')}</p>}
      {data && data.items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-start font-semibold">{t('entity')}</th>
                <th className="px-3 py-2 text-start font-semibold">{t('sampleTitle')}</th>
                <th className="px-3 py-2 text-start font-semibold">{t('rollbackItemsAction')}</th>
                <th className="px-3 py-2 text-start font-semibold">{t('sampleMessage')}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={it.id} className="border-b align-top last:border-0">
                  <td className="px-3 py-1.5 whitespace-nowrap">{te.has(it.entity_type) ? te(it.entity_type) : it.entity_type}</td>
                  <td className="px-3 py-1.5 break-words">
                    {it.title || (
                      <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                        {it.external_ref}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{ta.has(it.action) ? ta(it.action) : it.action}</td>
                  <td className="px-3 py-1.5 break-words text-muted-foreground">{itemMessage(it.message)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={loading || page <= 1}>
            <ChevronLeft className="rtl:-scale-x-100" />
            {tc('previous')}
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={loading || page >= totalPages}
          >
            {tc('next')}
            <ChevronRight className="rtl:-scale-x-100" />
          </Button>
        </div>
      )}
    </section>
  );
}
