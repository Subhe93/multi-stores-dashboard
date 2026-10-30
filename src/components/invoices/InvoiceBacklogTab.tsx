'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, AlertTriangle, CheckCircle2, FileText, Files, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ApiError } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import { formatInvoiceAmount, missingFieldsFromPayload } from '@/lib/invoices';
import { getBacklog, issueBacklog, issueInvoice, type BacklogIssueResult, type BacklogOrder } from '@/lib/invoices.api';
import { ProfileMissingNotice } from '@/components/invoices/InvoiceBits';
import { runBulk } from '@/lib/bulk';
import { useRowOpen, useTableSelection } from '@/components/common/useTableSelection';
import {
  BulkNotice,
  SelectAllCheckbox,
  SelectRowCheckbox,
  TableSelectionBar,
  useBulkSummary,
  type BulkNoticeValue,
} from '@/components/common/TableSelectionBar';

const BACKLOG_LIMIT = 200;
// The API issues at most this many orders per "Issue all" run.
const BULK_ISSUE_MAX = 500;

interface InvoiceBacklogTabProps {
  token: string;
  // Called after anything was issued so the parent can refresh counters.
  onIssued: () => void;
  onOpenProfile: () => void;
  // Current `missing[]` of the seller profile (shown when a bulk run failed on it).
  profileMissing: string[];
}

/**
 * Paid orders (and delivered COD orders) without an invoice, e.g. orders
 * placed before the app was enabled (L13): issue one by one or all at once.
 */
export function InvoiceBacklogTab({ token, onIssued, onOpenProfile, profileMissing }: InvoiceBacklogTabProps) {
  const t = useTranslations('creator.invoices.backlog');
  const tInv = useTranslations('creator.invoices');
  const tc = useTranslations('common');
  const locale = useLocale();
  const describeError = useApiError();

  const [count, setCount] = useState(0);
  const [orders, setOrders] = useState<BacklogOrder[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, { text: string; detail?: string } | undefined>>({});
  const [missing, setMissing] = useState<string[] | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [issuingAll, setIssuingAll] = useState(false);
  const [result, setResult] = useState<BacklogIssueResult | null>(null);
  const [allError, setAllError] = useState<string | null>(null);

  const selection = useTableSelection(orders ?? [], (o) => o.id);
  const bulkSummary = useBulkSummary();
  const { linkRow } = useRowOpen();
  const [bulkIssuing, setBulkIssuing] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<BulkNoticeValue | null>(null);

  const load = useCallback(() => {
    setLoadError(null);
    getBacklog(token, BACKLOG_LIMIT)
      .then((res) => {
        setCount(Number(res?.count ?? 0));
        setOrders(Array.isArray(res?.orders) ? res.orders : []);
      })
      .catch((err: unknown) => {
        setOrders([]);
        setLoadError(describeError(err));
      });
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleIssue = async (order: BacklogOrder) => {
    if (issuingId || issuingAll) return;
    setIssuingId(order.id);
    setRowErrors((prev) => ({ ...prev, [order.id]: undefined }));
    try {
      await issueInvoice(token, order.id);
      setOrders((prev) => prev?.filter((o) => o.id !== order.id) ?? prev);
      setCount((c) => Math.max(0, c - 1));
      onIssued();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVOICE_ALREADY_ISSUED') {
        setOrders((prev) => prev?.filter((o) => o.id !== order.id) ?? prev);
        setCount((c) => Math.max(0, c - 1));
      } else if (err instanceof ApiError && err.code === 'INVOICE_PROFILE_INCOMPLETE') {
        setMissing(missingFieldsFromPayload(err.payload));
      } else {
        // INVOICE_SNAPSHOT_INVALID: append the server message as a detail line.
        const detail = err instanceof ApiError && err.code === 'INVOICE_SNAPSHOT_INVALID' ? err.message : undefined;
        setRowErrors((prev) => ({ ...prev, [order.id]: { text: describeError(err), detail } }));
      }
    } finally {
      setIssuingId(null);
    }
  };

  const handleIssueAll = async () => {
    if (issuingAll) return;
    setIssuingAll(true);
    setAllError(null);
    setResult(null);
    try {
      const res = await issueBacklog(token);
      setResult(res);
      setConfirmAll(false);
      if (res.issued > 0) onIssued();
      load();
    } catch (err) {
      setConfirmAll(false);
      if (err instanceof ApiError && err.code === 'INVOICE_PROFILE_INCOMPLETE') {
        setMissing(missingFieldsFromPayload(err.payload));
      } else {
        setAllError(describeError(err));
      }
    } finally {
      setIssuingAll(false);
    }
  };

  // Issues the selected orders one by one with the single-order endpoint.
  const handleIssueSelected = async () => {
    if (bulkIssuing || issuingId || issuingAll) return;
    setBulkIssuing(true);
    setBulkNotice(null);
    const done = new Set<string>();
    const result = await runBulk(selection.selectedRows, async (order) => {
      try {
        await issueInvoice(token, order.id);
        done.add(order.id);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'INVOICE_ALREADY_ISSUED') {
          done.add(order.id);
          return;
        }
        if (err instanceof ApiError && err.code === 'INVOICE_PROFILE_INCOMPLETE') {
          setMissing(missingFieldsFromPayload(err.payload));
        }
        throw new Error(describeError(err));
      }
      // One at a time so invoice numbers follow the selection order.
    }, 1);
    setOrders((prev) => prev?.filter((o) => !done.has(o.id)) ?? prev);
    setCount((c) => Math.max(0, c - done.size));
    setBulkIssuing(false);
    selection.clear();
    setBulkNotice(bulkSummary(result));
    if (done.size > 0) onIssued();
  };

  const resultProfileIncomplete = !!result?.errors.some((e) => e.code === 'INVOICE_PROFILE_INCOMPLETE');
  const bulkCount = Math.min(count, BULK_ISSUE_MAX);

  const paymentLabel = (method: string | null) =>
    method && tInv.has(`paymentMethods.${method}`) ? tInv(`paymentMethods.${method}`) : method || '—';

  return (
    <div className="space-y-4">
      {(missing || resultProfileIncomplete) && (
        <ProfileMissingNotice missing={missing ?? profileMissing} onOpenProfile={onOpenProfile} />
      )}

      {result && (
        <div
          className={`flex items-start gap-2 rounded-md border p-3 text-xs ${
            result.issued === 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {result.issued === 0 ? (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          )}
          <div className="min-w-0 space-y-1">
            <p className="font-medium">{t('result', { issued: result.issued, skipped: result.skipped })}</p>
            {result.errors.length > 0 && (
              <>
                <p className="text-amber-800">{t('resultErrors', { count: result.errors.length })}</p>
                <ul className="list-disc ps-4 text-amber-800">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={e.order_id ?? i}>
                      <span className="font-mono" dir="ltr">{e.order_number ?? e.order_id ?? '—'}</span>
                      {': '}
                      {describeError({ code: e.code, message: e.message })}
                      {e.code === 'INVOICE_SNAPSHOT_INVALID' && e.message && (
                        <span className="block text-muted-foreground">{e.message}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {allError && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{allError}</span>
        </div>
      )}

      <BulkNotice notice={bulkNotice} onDismiss={() => setBulkNotice(null)} />

      <Card className="shadow-none">
        <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('description')}</p>
          </div>
          <Button size="sm" disabled={!orders || count === 0 || issuingAll || !!issuingId} onClick={() => setConfirmAll(true)}>
            <Files /> {t('issueAll')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {!orders ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : loadError ? (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{loadError}</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="size-7 text-emerald-500" />
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{t('count', { count })}</p>
              <div className="overflow-x-auto rounded-md border">
                <TableSelectionBar selection={selection}>
                  <Button size="sm" className="h-7 text-xs" disabled={bulkIssuing || !!issuingId || issuingAll} onClick={handleIssueSelected}>
                    {bulkIssuing ? <Loader2 className="animate-spin" /> : <FileText />}
                    {bulkIssuing ? t('issuing') : t('issue')}
                  </Button>
                </TableSelectionBar>
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="w-10 px-3 py-2">
                        <SelectAllCheckbox selection={selection} />
                      </th>
                      <th className="px-3 py-2 text-start font-semibold">{t('columns.order')}</th>
                      <th className="px-3 py-2 text-start font-semibold">{t('columns.date')}</th>
                      <th className="px-3 py-2 text-start font-semibold">{t('columns.payment')}</th>
                      <th className="px-3 py-2 text-end font-semibold">{t('columns.total')}</th>
                      <th className="px-3 py-2 text-end font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr
                        key={o.id}
                        {...linkRow(`/creator/orders/${o.id}`)}
                        className={`cursor-pointer border-t align-top hover:bg-zinc-50 ${selection.isSelected(o.id) ? 'bg-zinc-50' : ''}`}
                      >
                        <td className="w-10 px-3 py-2" data-row-click-ignore>
                          <SelectRowCheckbox selection={selection} id={o.id} />
                        </td>
                        <td className="px-3 py-2">
                          <Link href={`/creator/orders/${o.id}`} className="font-mono text-xs hover:underline" dir="ltr">
                            {o.order_number}
                          </Link>
                          {rowErrors[o.id] && (
                            <>
                              <p className="mt-1 text-[11px] text-red-600">{rowErrors[o.id]?.text}</p>
                              {rowErrors[o.id]?.detail && (
                                <p className="text-[11px] text-muted-foreground">{rowErrors[o.id]?.detail}</p>
                              )}
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap">
                          {o.created_at ? new Date(o.created_at).toLocaleDateString(`${locale}-u-nu-latn`) : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs">{paymentLabel(o.payment_method)}</td>
                        <td className="px-3 py-2 text-end text-xs whitespace-nowrap">
                          <bdi dir="ltr">{formatInvoiceAmount(o.total, o.currency, locale)}</bdi>
                        </td>
                        <td className="px-3 py-2 text-end">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!!issuingId || issuingAll || bulkIssuing}
                            onClick={() => handleIssue(o)}
                          >
                            {issuingId === o.id ? <Loader2 className="animate-spin" /> : <FileText />}
                            {issuingId === o.id ? t('issuing') : t('issue')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {count > orders.length && (
                <p className="text-[11px] text-muted-foreground">{t('moreHidden', { shown: orders.length, count })}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmAll} onOpenChange={(open) => !issuingAll && setConfirmAll(open)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('confirmTitle')}</DialogTitle>
            <DialogDescription>{t('confirmDescription', { count: bulkCount })}</DialogDescription>
          </DialogHeader>
          {count > BULK_ISSUE_MAX && (
            <p className="rounded-md border border-sky-200 bg-sky-50 p-2.5 text-xs text-sky-800">
              {t('bulkLimitHint', { max: BULK_ISSUE_MAX, count })}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" disabled={issuingAll} onClick={() => setConfirmAll(false)}>
              {tc('cancel')}
            </Button>
            <Button size="sm" disabled={issuingAll} onClick={handleIssueAll}>
              {issuingAll && <Loader2 className="animate-spin" />}
              {issuingAll ? t('issuingAll') : t('issueAll')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
