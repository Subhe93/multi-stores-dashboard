'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Download, Eye, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ApiError } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import { countryLabel } from '@/lib/taxCountries';
import { downloadCsv, formatAmountIn, toDateInputValue } from '@/lib/taxRate';
import {
  ecSalesQuery,
  getEcSalesReport,
  type EcSalesPeriod,
  type EcSalesReport,
  type EcSalesRow,
} from '@/lib/b2bTax.api';

interface EcSalesReportPanelProps {
  token: string;
  // 'full': controls + table inline (Invoices page tab).
  // 'compact': controls with Preview (dialog) + CSV buttons (Apps page b2b card).
  variant?: 'full' | 'compact';
}

/**
 * EC sales list (periodisk sammanställning) of reverse-charge sales, b2b app
 * M2.5 (D11/L6): rows per period x buyer VAT number with the amount in the
 * order currency and in the store currency, plus a CSV export of the same
 * query. Built from invoices when the Invoices app is on, else from orders
 * (the API reports `source`; partial refunds are then not netted).
 */
export function EcSalesReportPanel({ token, variant = 'full' }: EcSalesReportPanelProps) {
  const t = useTranslations('creator.taxes.ecSales');
  const describeError = useApiError();

  const [from, setFrom] = useState(() => {
    const now = new Date();
    return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [to, setTo] = useState(() => toDateInputValue(new Date()));
  const [period, setPeriod] = useState<EcSalesPeriod>('month');
  const [report, setReport] = useState<EcSalesReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const rangeValid = !!from && !!to && from <= to;

  const runReport = useCallback(async () => {
    if (!rangeValid) return;
    setLoading(true);
    setError('');
    try {
      setReport(await getEcSalesReport(token, from, to, period));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, from, to, period, rangeValid]);

  // The full variant loads the default range on mount; the compact one waits
  // for "Preview" so the Apps page does not run a report on every visit.
  useEffect(() => {
    if (variant === 'full') void runReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, variant]);

  const handleDownload = async () => {
    if (downloading || !rangeValid) return;
    setDownloading(true);
    setError('');
    try {
      await downloadCsv(ecSalesQuery(from, to, period, 'csv'), token, `ec-sales-${from}-${to}.csv`);
    } catch (err) {
      // Coded ApiError -> errors.<code>; uncoded failures get the panel's own text.
      const coded = err instanceof ApiError && !!err.code;
      setError(coded ? describeError(err) : t('downloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  const handlePreview = () => {
    setPreviewOpen(true);
    void runReport();
  };

  const periodOptions = [
    { value: 'month', label: t('periodMonth') },
    { value: 'quarter', label: t('periodQuarter') },
  ];

  const compact = variant === 'compact';

  const controls = (
    <div className={compact ? 'grid gap-2 sm:grid-cols-3' : 'flex flex-wrap items-end gap-3'}>
      <div className="space-y-1">
        <Label className="text-xs" htmlFor={`ec-sales-from-${variant}`}>{t('from')}</Label>
        <Input
          id={`ec-sales-from-${variant}`}
          type="date"
          className={`h-8 text-sm ${compact ? 'w-full' : 'w-40'}`}
          value={from}
          max={to}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs" htmlFor={`ec-sales-to-${variant}`}>{t('to')}</Label>
        <Input
          id={`ec-sales-to-${variant}`}
          type="date"
          className={`h-8 text-sm ${compact ? 'w-full' : 'w-40'}`}
          value={to}
          min={from}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      <div className={`space-y-1 ${compact ? '' : 'w-40'}`}>
        <Label className="text-xs">{t('period')}</Label>
        <SearchableSelect value={period} onChange={(v) => setPeriod(v === 'quarter' ? 'quarter' : 'month')} options={periodOptions} />
      </div>
      {!compact && (
        <div className="ms-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={runReport} disabled={loading || !rangeValid}>
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {t('run')}
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={downloading || !rangeValid}>
            {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {t('downloadCsv')}
          </Button>
        </div>
      )}
    </div>
  );

  const body = (
    <>
      {report?.source === 'orders' && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{t('ordersSourceBanner')}</span>
        </div>
      )}
      <EcSalesTable rows={report?.rows ?? []} loading={loading} />
    </>
  );

  if (compact) {
    return (
      <div className="space-y-2 border-t pt-4">
        <p className="text-xs font-semibold">{t('title')}</p>
        <p className="text-[11px] text-muted-foreground">{t('description')}</p>
        {controls}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button size="sm" variant="outline" onClick={handlePreview} disabled={!rangeValid}>
            <Eye className="size-3.5" /> {t('preview')}
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={downloading || !rangeValid}>
            {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {t('downloadCsv')}
          </Button>
        </div>
        {error && !previewOpen && <p className="text-[11px] text-red-600">{error}</p>}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>{t('title')}</DialogTitle>
              <DialogDescription>{t('previewRange', { from, to })}</DialogDescription>
            </DialogHeader>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto">
              {error && <p className="text-xs text-red-600">{error}</p>}
              {body}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold">{t('title')}</p>
        <p className="text-xs text-muted-foreground">{t('description')}</p>
      </div>
      {controls}
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      {body}
    </div>
  );
}

function EcSalesTable({ rows, loading }: { rows: EcSalesRow[]; loading: boolean }) {
  const t = useTranslations('creator.taxes.ecSales');
  const tc = useTranslations('common');
  const locale = useLocale();

  // Store-currency total; every row shares the store currency.
  const total = useMemo(() => {
    const currencies = new Set(rows.map((r) => r.store_currency));
    if (rows.length === 0 || currencies.size !== 1) return null;
    return {
      currency: rows[0].store_currency,
      amount: rows.reduce((sum, r) => sum + Number(r.goods_amount_store_currency || 0), 0),
      documents: rows.reduce((sum, r) => sum + Number(r.document_count || 0), 0),
    };
  }, [rows]);

  return (
    <Card className="shadow-none">
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('colPeriod')}</TableHead>
              <TableHead>{t('colCountry')}</TableHead>
              <TableHead>{t('colVatNumber')}</TableHead>
              <TableHead>{t('colBuyer')}</TableHead>
              <TableHead className="text-end">{t('colAmount')}</TableHead>
              <TableHead className="text-end">{t('colAmountStore')}</TableHead>
              <TableHead className="text-end">{t('colDocuments')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">{tc('loading')}</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">{t('empty')}</TableCell>
              </TableRow>
            ) : (
              <>
                {rows.map((row, index) => (
                  <TableRow key={`${row.period}-${row.buyer_vat_number}-${row.currency}-${index}`}>
                    <TableCell className="text-xs whitespace-nowrap tabular-nums">{row.period}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {row.buyer_country ? countryLabel(row.buyer_country, locale) : '—'}
                    </TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap" dir="ltr">
                      {row.buyer_vat_number || '—'}
                    </TableCell>
                    <TableCell className="text-xs">{row.buyer_name || '—'}</TableCell>
                    <TableCell className="text-xs text-end tabular-nums whitespace-nowrap">
                      {formatAmountIn(row.goods_amount, row.currency)}
                    </TableCell>
                    <TableCell className="text-xs text-end font-medium tabular-nums whitespace-nowrap">
                      {formatAmountIn(row.goods_amount_store_currency, row.store_currency)}
                    </TableCell>
                    <TableCell className="text-xs text-end tabular-nums">{row.document_count}</TableCell>
                  </TableRow>
                ))}
                {total && (
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell colSpan={5} className="text-xs">{t('totalRow')}</TableCell>
                    <TableCell className="text-xs text-end tabular-nums whitespace-nowrap">
                      {formatAmountIn(total.amount, total.currency)}
                    </TableCell>
                    <TableCell className="text-xs text-end tabular-nums">{total.documents}</TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
