'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, Download, FileSpreadsheet, Loader2, Undo2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/common/DataTable';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { useApiError } from '@/lib/useApiError';
import { useInvoicePdfDownload } from '@/lib/useInvoices';
import { formatInvoiceAmount, formatInvoiceDate, invoiceCsvFilename } from '@/lib/invoices';
import {
  downloadInvoicesCsv,
  listInvoices,
  type InvoiceKind,
  type InvoiceListQuery,
  type InvoiceListResponse,
  type InvoiceSummary,
} from '@/lib/invoices.api';
import { InvoiceKindBadge, InvoicePaidBadge } from '@/components/invoices/InvoiceBits';
import { InvoiceDetailDialog } from '@/components/invoices/InvoiceDetailDialog';
import { CreditNoteDialog } from '@/components/invoices/CreditNoteDialog';

const PAGE_SIZE = 25;

type KindFilter = 'all' | InvoiceKind;
type PaidFilter = 'all' | 'yes' | 'no';

interface InvoicesListTabProps {
  token: string;
  // Writes (credit notes) need the app enabled; reads stay available (L1).
  canWrite: boolean;
}

/** Invoices tab: filters, paginated table, CSV export, detail + credit note. */
export function InvoicesListTab({ token, canWrite }: InvoicesListTabProps) {
  const t = useTranslations('creator.invoices');
  const locale = useLocale();
  const describeError = useApiError();
  const { download, downloadingId, downloadError } = useInvoicePdfDownload(token);

  const [kind, setKind] = useState<KindFilter>('all');
  const [paid, setPaid] = useState<PaidFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<InvoiceListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [selected, setSelected] = useState<InvoiceSummary | null>(null);
  const [crediting, setCrediting] = useState<InvoiceSummary | null>(null);

  // Debounce the free-text search so typing doesn't fire a request per key.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const buildQuery = useCallback(
    (): InvoiceListQuery => ({
      kind: kind === 'all' ? undefined : kind,
      paid: paid === 'all' ? undefined : paid === 'yes',
      from: from || undefined,
      to: to || undefined,
      q: q || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    [kind, paid, from, to, q, page],
  );

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listInvoices(token, buildQuery())
      .then((res) => setData(res))
      .catch((err: unknown) => setError(describeError(err)))
      .finally(() => setLoading(false));
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, buildQuery]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      await downloadInvoicesCsv(token, buildQuery(), invoiceCsvFilename());
    } catch (err) {
      setExportError(describeError(err) || t('exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setKind('all');
    setPaid('all');
    setFrom('');
    setTo('');
    setSearch('');
    setQ('');
    setPage(1);
  };
  const hasFilters = kind !== 'all' || paid !== 'all' || !!from || !!to || !!search;

  const kindOptions = [
    { value: 'all', label: t('filters.allKinds') },
    { value: 'INVOICE', label: t('kind.INVOICE') },
    { value: 'CREDIT_NOTE', label: t('kind.CREDIT_NOTE') },
  ];
  const paidOptions = [
    { value: 'all', label: t('filters.paidAll') },
    { value: 'yes', label: t('paidBadge') },
    { value: 'no', label: t('unpaidBadge') },
  ];

  const canCredit = (inv: InvoiceSummary) => canWrite && inv.kind === 'INVOICE' && Number(inv.remaining_creditable ?? 0) > 0;

  const columns = [
    {
      key: 'number',
      label: t('columns.number'),
      render: (inv: InvoiceSummary) => (
        <button
          type="button"
          onClick={() => setSelected(inv)}
          className="font-mono text-sm font-medium text-primary hover:underline"
          dir="ltr"
        >
          {inv.number}
        </button>
      ),
    },
    {
      key: 'kind',
      label: t('columns.kind'),
      render: (inv: InvoiceSummary) => (
        <div className="space-y-0.5">
          <InvoiceKindBadge kind={inv.kind} />
          {inv.credited_invoice && (
            <p className="text-[10px] text-muted-foreground">
              {t('creditFor')} <span className="font-mono" dir="ltr">{inv.credited_invoice.number}</span>
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'issue_date',
      label: t('columns.date'),
      render: (inv: InvoiceSummary) => <span className="whitespace-nowrap">{formatInvoiceDate(inv.issue_date, locale)}</span>,
    },
    {
      key: 'order_number',
      label: t('columns.order'),
      render: (inv: InvoiceSummary) => (
        <Link href={`/creator/orders/${inv.order_id}`} className="font-mono text-xs hover:underline" dir="ltr">
          {inv.order_number}
        </Link>
      ),
    },
    {
      key: 'buyer_name',
      label: t('columns.buyer'),
      render: (inv: InvoiceSummary) => <span className="block max-w-48 truncate" title={inv.buyer_name}>{inv.buyer_name}</span>,
    },
    {
      key: 'gross_total',
      label: t('columns.total'),
      className: 'text-end',
      render: (inv: InvoiceSummary) => (
        <bdi dir="ltr" className={`whitespace-nowrap ${inv.gross_total < 0 ? 'text-rose-700' : ''}`}>
          {formatInvoiceAmount(inv.gross_total, inv.currency, locale)}
        </bdi>
      ),
    },
    {
      key: 'paid',
      label: t('columns.status'),
      render: (inv: InvoiceSummary) => <InvoicePaidBadge paid={inv.paid} />,
    },
    {
      key: 'actions',
      label: t('columns.actions'),
      render: (inv: InvoiceSummary) => (
        <div className="flex items-center gap-1">
          {/* Span carries the tooltip: disabled buttons get no pointer events. */}
          <span className="inline-flex" title={inv.pdf_available === false ? t('card.pdfUnavailable') : t('download')}>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={!!downloadingId || inv.pdf_available === false}
              onClick={() => download(inv)}
              aria-label={t('download')}
            >
              {downloadingId === inv.id ? <Loader2 className="animate-spin" /> : <Download />}
            </Button>
          </span>
          {canCredit(inv) && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setCrediting(inv)}
              title={t('creditNoteAction')}
              aria-label={t('creditNoteAction')}
            >
              <Undo2 className="rtl:-scale-x-100" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const pagination = data
    ? { total: data.total, page: data.page, limit: data.limit, totalPages: Math.max(1, Math.ceil(data.total / (data.limit || PAGE_SIZE))) }
    : undefined;

  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardContent className="grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5 lg:col-span-1">
            <Label className="text-xs">{t('filters.search')}</Label>
            <Input
              type="search"
              className="h-8 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('filters.searchPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('filters.kind')}</Label>
            <SearchableSelect
              value={kind}
              onChange={(v) => {
                setKind(v as KindFilter);
                setPage(1);
              }}
              options={kindOptions}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('filters.paid')}</Label>
            <SearchableSelect
              value={paid}
              onChange={(v) => {
                setPaid(v as PaidFilter);
                setPage(1);
              }}
              options={paidOptions}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('filters.from')}</Label>
            <Input
              type="date"
              className="h-8 text-sm"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('filters.to')}</Label>
            <Input
              type="date"
              className="h-8 text-sm"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 lg:col-span-5">
            <p className="text-xs text-muted-foreground">{data ? t('resultCount', { count: data.total }) : ' '}</p>
            <div className="flex items-center gap-2">
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  <X /> {t('filters.clear')}
                </Button>
              )}
              <Button variant="outline" size="sm" disabled={exporting} onClick={handleExport}>
                {exporting ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
                {exporting ? t('exporting') : t('exportCsv')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {(error || exportError || (downloadError && !selected)) && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error || exportError || downloadError}</span>
        </div>
      )}

      <div className={loading && data ? 'opacity-60 transition-opacity' : undefined}>
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          pagination={pagination}
          onPageChange={setPage}
          emptyMessage={loading ? t('loading') : t('empty')}
        />
      </div>

      <InvoiceDetailDialog
        invoice={selected}
        token={token}
        canCredit={canWrite}
        downloadingId={downloadingId}
        downloadError={downloadError}
        onDownload={download}
        onCredit={(inv) => {
          setSelected(null);
          setCrediting(inv);
        }}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />

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
    </div>
  );
}
