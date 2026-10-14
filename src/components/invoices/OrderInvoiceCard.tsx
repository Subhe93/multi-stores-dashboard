'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, Download, FileText, Loader2, Undo2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import { useInvoicePdfDownload } from '@/lib/useInvoices';
import { formatInvoiceAmount, formatInvoiceDate, missingFieldsFromPayload } from '@/lib/invoices';
import { issueInvoice, listOrderInvoices, type InvoiceSummary } from '@/lib/invoices.api';
import { InvoiceKindBadge, ProfileMissingNotice } from '@/components/invoices/InvoiceBits';
import { CreditNoteDialog } from '@/components/invoices/CreditNoteDialog';

interface OrderInvoiceCardProps {
  orderId: string;
  token: string;
  // Admin view: list + download only, and hidden while there is nothing to show.
  readOnly?: boolean;
  // Creator view: writes need the app; with the app off the card still shows
  // existing documents (L1 retention) but hides itself when there are none.
  appEnabled?: boolean;
}

/**
 * "Invoices" card on the order detail pages: lists the invoice and credit
 * notes of one order (GET /invoices/documents/orders/:orderId), downloads
 * PDFs, issues the invoice manually and opens the credit-note dialog.
 */
export function OrderInvoiceCard({ orderId, token, readOnly = false, appEnabled = true }: OrderInvoiceCardProps) {
  const t = useTranslations('creator.invoices.card');
  const locale = useLocale();
  const describeError = useApiError();
  const { download, downloadingId, downloadError } = useInvoicePdfDownload(token);
  const [docs, setDocs] = useState<InvoiceSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<{ text: string; missing?: string[]; detail?: string } | null>(null);
  const [crediting, setCrediting] = useState<InvoiceSummary | null>(null);

  const canWrite = !readOnly && appEnabled;

  const load = useCallback(() => {
    setLoadError(null);
    listOrderInvoices(token, orderId)
      .then((list) => setDocs(Array.isArray(list) ? list : []))
      .catch((err: unknown) => {
        setDocs([]);
        // A foreign / missing order (404) simply means "no documents".
        if (err instanceof ApiError && err.status === 404) return;
        setLoadError(describeError(err));
      });
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const invoice = docs?.find((d) => d.kind === 'INVOICE') ?? null;
  const remaining = Number(invoice?.remaining_creditable ?? 0);

  // Nothing to show and nothing the viewer may do: render no card at all.
  if (docs && docs.length === 0 && !canWrite && !loadError) return null;
  if (!docs && !canWrite) return null;
  // Admin view: a failed load renders nothing rather than an error card.
  if (readOnly && loadError) return null;

  const handleIssue = async () => {
    if (issuing) return;
    setIssuing(true);
    setIssueError(null);
    try {
      await issueInvoice(token, orderId);
      load();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVOICE_ALREADY_ISSUED') {
        // Issued meanwhile (auto trigger or another tab): just refresh.
        load();
      } else if (err instanceof ApiError && err.code === 'INVOICE_PROFILE_INCOMPLETE') {
        setIssueError({ text: describeError(err), missing: missingFieldsFromPayload(err.payload) });
      } else if (err instanceof ApiError && err.code === 'INVOICE_SNAPSHOT_INVALID') {
        // The server message names what does not add up; shown as a muted detail.
        setIssueError({ text: describeError(err), detail: err.message || undefined });
      } else {
        setIssueError({ text: describeError(err) });
      }
    } finally {
      setIssuing(false);
    }
  };

  return (
    <Card className="shadow-none" id="invoices">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {!docs ? (
          <div className="flex justify-center py-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {loadError && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-red-700">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                <span>{loadError}</span>
              </div>
            )}

            {docs.length === 0 && !loadError && <p className="text-muted-foreground">{t('empty')}</p>}

            {docs.length > 0 && (
              <ul className="divide-y rounded-md border">
                {docs.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-2 px-2.5 py-2">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <InvoiceKindBadge kind={doc.kind} />
                        <span className="font-mono font-medium" dir="ltr">{doc.number}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {formatInvoiceDate(doc.issue_date, locale)} ·{' '}
                        <bdi dir="ltr">{formatInvoiceAmount(doc.gross_total, doc.currency, locale)}</bdi>
                      </p>
                      {doc.kind === 'CREDIT_NOTE' && doc.reason && (
                        <p className="text-[11px] text-muted-foreground truncate" title={doc.reason}>{doc.reason}</p>
                      )}
                    </div>
                    {/* Span carries the tooltip: disabled buttons get no pointer events. */}
                    <span className="inline-flex shrink-0" title={doc.pdf_available === false ? t('pdfUnavailable') : t('download')}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        disabled={!!downloadingId || doc.pdf_available === false}
                        onClick={() => download(doc)}
                        aria-label={t('download')}
                      >
                        {downloadingId === doc.id ? <Loader2 className="animate-spin" /> : <Download />}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {downloadError && <p className="text-[11px] text-red-600">{downloadError}</p>}

            {invoice && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{t('remaining')}</span>
                <bdi dir="ltr" className="font-medium">{formatInvoiceAmount(remaining, invoice.currency, locale)}</bdi>
              </div>
            )}

            {canWrite && !invoice && !loadError && (
              <Button size="sm" className="w-full" disabled={issuing} onClick={handleIssue}>
                {issuing ? <Loader2 className="animate-spin" /> : <FileText />}
                {issuing ? t('issuing') : t('issue')}
              </Button>
            )}

            {issueError &&
              (issueError.missing ? (
                <ProfileMissingNotice missing={issueError.missing} compact />
              ) : (
                <div className="space-y-0.5 text-[11px]">
                  <p className="text-red-600">{issueError.text}</p>
                  {issueError.detail && <p className="text-muted-foreground">{issueError.detail}</p>}
                </div>
              ))}

            {canWrite && invoice && remaining > 0 && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setCrediting(invoice)}>
                <Undo2 className="rtl:-scale-x-100" /> {t('creditNote')}
              </Button>
            )}

            {!appEnabled && !readOnly && docs.length > 0 && (
              <p className="text-[11px] text-muted-foreground">{t('disabledHint')}</p>
            )}
          </>
        )}
      </CardContent>

      {canWrite && (
        <CreditNoteDialog
          invoice={crediting}
          token={token}
          onOpenChange={(open) => {
            if (!open) setCrediting(null);
          }}
          onCreated={() => {
            setCrediting(null);
            load();
          }}
        />
      )}
    </Card>
  );
}
