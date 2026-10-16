'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Download, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { useApiError } from '@/lib/useApiError';
import {
  downloadPrintFile,
  listPrintQueue,
  regeneratePrint,
  retryFailedPrints,
  PRINT_STATUSES,
  type Paged,
  type PrintQueueRow,
  type PrintStatus,
} from '@/lib/designer/designer.api';
import { useDateTimeFormat } from '@/components/importer/ImporterBits';
import { PrintStatusBadge, usePrintErrorText } from '@/components/designer/DesignerBits';

const ALL = '__all__';
const PAGE_SIZE = 25;

/** "Print queue" tab: status filter, retry all failed, per-row download / regenerate. */
export function PrintQueueTab({ token }: { token: string }) {
  const t = useTranslations('creator.designer.queue');
  const ts = useTranslations('creator.designer.printStatus');
  const tc = useTranslations('creator.designer.common');
  const describeError = useApiError();
  const formatDate = useDateTimeFormat();
  const printError = usePrintErrorText();
  const [status, setStatus] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<PrintQueueRow> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; text: string } | null>(null);

  const load = useCallback(() => {
    setError(null);
    listPrintQueue(token, { status: status === ALL ? undefined : (status as PrintStatus), page, limit: PAGE_SIZE })
      .then(setData)
      .catch((err) => {
        setData({ items: [], total: 0, page: 1, limit: PAGE_SIZE });
        setError(describeError(err));
      });
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const retryAll = async () => {
    setBusy('retry-all');
    setNotice(null);
    setError(null);
    try {
      const res = await retryFailedPrints(token);
      setNotice(t('retried', { count: res.count }));
      load();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  const regenerate = async (row: PrintQueueRow) => {
    setBusy(`regen-${row.id}`);
    setRowError(null);
    try {
      const res = await regeneratePrint(token, row.order_id, row.order_item_id);
      if (!res.queued) setRowError({ id: row.id, text: t('alreadyRendering') });
      load();
    } catch (err) {
      setRowError({ id: row.id, text: describeError(err) });
    } finally {
      setBusy(null);
    }
  };

  const download = async (row: PrintQueueRow) => {
    setBusy(`dl-${row.id}`);
    setRowError(null);
    try {
      await downloadPrintFile(token, row.order_id, row.order_item_id);
    } catch (err) {
      setRowError({ id: row.id, text: describeError(err) });
    } finally {
      setBusy(null);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-56">
          <SearchableSelect
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[{ value: ALL, label: t('allStatuses') }, ...PRINT_STATUSES.map((s) => ({ value: s, label: ts(s) }))]}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={load} aria-label={tc('refresh')}>
            <RefreshCw />
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy === 'retry-all'} onClick={retryAll}>
            {busy === 'retry-all' ? <Loader2 className="animate-spin" /> : <RotateCcw />} {t('retryFailed')}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t('intro')}</p>

      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}

      <Card className="shadow-none">
        <CardContent className="p-0">
          {!data ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : data.items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-zinc-50 text-muted-foreground">
                    <th className="px-3 py-2 text-start font-medium">{t('colOrder')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('colStatus')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('colAttempts')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('colRequested')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('colRendered')}</th>
                    <th className="px-3 py-2 text-end font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => {
                    const file = row.print_files.find((f) => f.surface === 'front') ?? row.print_files[0];
                    const purged = !!row.files_purged_at || row.print_status === 'PURGED';
                    return (
                      <tr key={row.id} className="border-b align-top last:border-0">
                        <td className="px-3 py-2">
                          <Link href={`/creator/orders/${row.order_id}`} className="font-medium hover:underline">
                            {row.order_number ? `#${row.order_number}` : row.order_id.slice(0, 8)}
                          </Link>
                          {row.product_title && (
                            <span className="block max-w-[14rem] truncate" dir="auto" title={row.product_title}>
                              {row.product_title}
                            </span>
                          )}
                          <span className="block text-muted-foreground">{t('quantity', { count: row.quantity ?? 1 })}</span>
                          {row.low_res && (
                            <span className="mt-0.5 inline-flex items-center gap-1 text-amber-700">
                              <AlertTriangle className="size-3" /> {t('lowRes')}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <PrintStatusBadge status={row.print_status} waiting={!row.print_requested_at} />
                          {row.print_error && (
                            <span className="mt-1 block max-w-xs break-words text-red-600" title={row.print_error}>
                              {printError(row.print_error)}
                            </span>
                          )}
                          {file && (
                            <span className="mt-1 block text-muted-foreground" dir="ltr">
                              {file.width_px}×{file.height_px} · {Math.round(file.dpi)} DPI
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {row.print_attempts}/{row.max_attempts}
                          {row.print_status === 'FAILED' && row.print_next_attempt_at && row.print_attempts < row.max_attempts && (
                            <span className="block text-muted-foreground">{t('nextAttempt', { date: formatDate(row.print_next_attempt_at) })}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{row.print_requested_at ? formatDate(row.print_requested_at) : t('notPaid')}</td>
                        <td className="px-3 py-2 text-muted-foreground">{formatDate(row.print_rendered_at)}</td>
                        <td className="px-3 py-2 text-end">
                          <div className="inline-flex flex-wrap justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={row.print_status !== 'READY' || purged || busy === `dl-${row.id}`}
                              onClick={() => download(row)}
                            >
                              {busy === `dl-${row.id}` ? <Loader2 className="animate-spin" /> : <Download className="size-3.5" />} {t('download')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              disabled={purged || row.print_status === 'RENDERING' || busy === `regen-${row.id}`}
                              onClick={() => regenerate(row)}
                            >
                              {busy === `regen-${row.id}` ? <Loader2 className="animate-spin" /> : <RotateCcw className="size-3.5" />} {t('regenerate')}
                            </Button>
                          </div>
                          {rowError?.id === row.id && <p className="mt-1 text-red-600">{rowError.text}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {tc('prev')}
          </Button>
          <span className="text-muted-foreground">{tc('pageOf', { page, pages })}</span>
          <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            {tc('next')}
          </Button>
        </div>
      )}
    </div>
  );
}
