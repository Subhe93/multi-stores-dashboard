'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, Download, Loader2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApiError } from '@/lib/useApiError';
import { formatInvoiceAmount, formatInvoiceDate } from '@/lib/invoices';
import { getInvoice, type InvoiceDetail, type InvoiceSummary } from '@/lib/invoices.api';
import { InvoiceKindBadge, InvoicePaidBadge } from '@/components/invoices/InvoiceBits';

interface InvoiceDetailDialogProps {
  // Row the dialog was opened from; shown at once while the detail loads.
  invoice: InvoiceSummary | null;
  token: string;
  canCredit: boolean;
  downloadingId: string | null;
  downloadError: string | null;
  onDownload: (invoice: InvoiceSummary) => void;
  onCredit: (invoice: InvoiceSummary) => void;
  onOpenChange: (open: boolean) => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end font-medium">{children}</span>
    </div>
  );
}

/** Read-only detail of one issued document (GET /invoices/my/:id). */
export function InvoiceDetailDialog({
  invoice,
  token,
  canCredit,
  downloadingId,
  downloadError,
  onDownload,
  onCredit,
  onOpenChange,
}: InvoiceDetailDialogProps) {
  const t = useTranslations('creator.invoices.detail');
  const tc = useTranslations('common');
  const locale = useLocale();
  const describeError = useApiError();
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const id = invoice?.id;
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    getInvoice(token, id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeError(err));
      });
    return () => {
      cancelled = true;
    };
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const doc: InvoiceSummary | null = detail ?? invoice;
  const snapshot = detail?.snapshot ?? null;
  const buyer = snapshot?.buyer ?? null;
  const vatRows = Array.isArray(snapshot?.vat_summary) ? snapshot.vat_summary : [];
  const money = (v: number | string | null | undefined) => (
    <bdi dir="ltr">{formatInvoiceAmount(v, doc?.currency ?? 'SEK', locale)}</bdi>
  );
  const remaining = Number(doc?.remaining_creditable ?? 0);
  const triggerKey = doc?.trigger ? `triggers.${doc.trigger}` : null;

  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {doc && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span className="font-mono" dir="ltr">{doc.number}</span>
                <InvoiceKindBadge kind={doc.kind} />
                <InvoicePaidBadge paid={doc.paid} />
              </DialogTitle>
              <DialogDescription>{t('subtitle', { buyer: doc.buyer_name })}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 text-xs md:grid-cols-2">
              <div className="space-y-1.5">
                <Row label={t('issueDate')}>{formatInvoiceDate(doc.issue_date, locale)}</Row>
                <Row label={t('dueDate')}>{formatInvoiceDate(doc.due_date, locale)}</Row>
                <Row label={t('order')}>
                  <Link href={`/creator/orders/${doc.order_id}`} className="font-mono text-primary hover:underline" dir="ltr">
                    {doc.order_number}
                  </Link>
                </Row>
                {triggerKey && t.has(triggerKey) && <Row label={t('trigger')}>{t(triggerKey)}</Row>}
                {snapshot?.payment?.label && <Row label={t('paymentMethod')}>{snapshot.payment.label}</Row>}
                {doc.credited_invoice && (
                  <Row label={t('creditedInvoice')}>
                    <span className="font-mono" dir="ltr">{doc.credited_invoice.number}</span>
                  </Row>
                )}
                {doc.reason && <Row label={t('reason')}>{doc.reason}</Row>}
              </div>
              <div className="space-y-1.5">
                <Row label={t('buyer')}>{buyer?.name || doc.buyer_name}</Row>
                {buyer?.org_number && <Row label={t('orgNumber')}><bdi dir="ltr">{buyer.org_number}</bdi></Row>}
                {buyer?.vat_number && <Row label={t('vatNumber')}><bdi dir="ltr">{buyer.vat_number}</bdi></Row>}
                {buyer?.reference && <Row label={t('reference')}>{buyer.reference}</Row>}
                {buyer?.email && <Row label={t('email')}><bdi dir="ltr">{buyer.email}</bdi></Row>}
              </div>
            </div>

            {vatRows.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <p className="font-semibold">{t('vatSummary')}</p>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full">
                    <thead className="bg-muted/40 text-[11px] text-muted-foreground">
                      <tr>
                        <th className="px-2.5 py-1.5 text-start font-medium">{t('rate')}</th>
                        <th className="px-2.5 py-1.5 text-end font-medium">{t('net')}</th>
                        <th className="px-2.5 py-1.5 text-end font-medium">{t('vat')}</th>
                        <th className="px-2.5 py-1.5 text-end font-medium">{t('gross')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vatRows.map((row, i) => (
                        <tr key={`${row.rate_bp}-${i}`} className="border-t">
                          <td className="px-2.5 py-1.5">
                            {row.label ? `${row.label} ` : ''}
                            <bdi dir="ltr">{(Number(row.rate_bp) / 100).toLocaleString('en', { maximumFractionDigits: 2 })}%</bdi>
                          </td>
                          <td className="px-2.5 py-1.5 text-end">{money(row.net)}</td>
                          <td className="px-2.5 py-1.5 text-end">{money(row.vat)}</td>
                          <td className="px-2.5 py-1.5 text-end">{money(row.gross)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-1.5 text-xs">
              <Row label={t('net')}>{money(doc.net_total)}</Row>
              <Row label={t('vat')}>{money(doc.vat_total)}</Row>
              <Separator />
              <Row label={t('gross')}>{money(doc.gross_total)}</Row>
              {doc.kind === 'INVOICE' && <Row label={t('remaining')}>{money(remaining)}</Row>}
            </div>

            {(error || downloadError) && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                <span>{downloadError || error}</span>
              </div>
            )}
            {!detail && !error && (
              <div className="flex justify-center">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                {tc('close')}
              </Button>
              {canCredit && doc.kind === 'INVOICE' && remaining > 0 && (
                <Button variant="outline" size="sm" onClick={() => onCredit(doc)}>
                  <Undo2 className="rtl:-scale-x-100" /> {t('creditNote')}
                </Button>
              )}
              <span className="inline-flex" title={doc.pdf_available === false ? t('pdfUnavailable') : undefined}>
                <Button size="sm" disabled={!!downloadingId || doc.pdf_available === false} onClick={() => onDownload(doc)}>
                  {downloadingId === doc.id ? <Loader2 className="animate-spin" /> : <Download />}
                  {t('downloadPdf')}
                </Button>
              </span>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
