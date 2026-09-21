'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { countryLabel } from '@/lib/taxCountries';
import { downloadCsv, formatAmountIn, formatTaxRateLabel, toDateInputValue, type TaxReportRow } from '@/lib/taxRate';

interface StoreOption {
  id: string;
  name: string;
}

interface TaxReportPanelProps {
  // '/taxes/admin/report' or '/taxes/my/report'.
  endpoint: string;
  // Admin only: store filter options (undefined hides the select).
  stores?: StoreOption[];
  storesLoading?: boolean;
}

// Tax report: paid orders in a date range grouped by country / label / rate,
// with a CSV export of the same query.
export function TaxReportPanel({ endpoint, stores, storesLoading }: TaxReportPanelProps) {
  const t = useTranslations('taxes');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { token } = useAuth();

  const [from, setFrom] = useState(() => {
    const now = new Date();
    return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [to, setTo] = useState(() => toDateInputValue(new Date()));
  const [storeId, setStoreId] = useState('');
  const [rows, setRows] = useState<TaxReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const query = useCallback(
    (format: 'json' | 'csv') => {
      const params = new URLSearchParams({ from, to, format });
      if (storeId) params.set('store_id', storeId);
      return `${endpoint}?${params.toString()}`;
    },
    [endpoint, from, to, storeId],
  );

  const runReport = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await api<TaxReportRow[] | { rows: TaxReportRow[] }>(query('json'), { token });
      const list = Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [];
      setRows(list);
    } catch (err) {
      setError((err instanceof Error && err.message) || t('reportFailed'));
    } finally {
      setLoading(false);
    }
  }, [token, query, t]);

  // Initial load for the default range (current month).
  useEffect(() => {
    void runReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleDownload = async () => {
    if (!token || downloading) return;
    setDownloading(true);
    setError('');
    try {
      await downloadCsv(query('csv'), token, `tax-report-${from}-${to}.csv`);
    } catch (err) {
      setError((err instanceof Error && err.message) || t('downloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  // Totals only make sense within one currency; multi-currency reports skip them.
  const totals = useMemo(() => {
    const currencies = new Set(rows.map((r) => r.currency));
    if (rows.length === 0 || currencies.size !== 1) return null;
    return {
      currency: rows[0].currency,
      taxable: rows.reduce((sum, r) => sum + Number(r.taxable_amount || 0), 0),
      tax: rows.reduce((sum, r) => sum + Number(r.tax_amount || 0), 0),
      orders: rows.reduce((sum, r) => sum + Number(r.order_count || 0), 0),
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="tax-report-from">{t('from')}</Label>
          <Input id="tax-report-from" type="date" className="h-8 w-40 text-sm" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="tax-report-to">{t('to')}</Label>
          <Input id="tax-report-to" type="date" className="h-8 w-40 text-sm" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
        {stores && (
          <div className="w-56 space-y-1">
            <Label className="text-xs">{t('store')}</Label>
            <SearchableSelect
              value={storeId}
              onChange={setStoreId}
              options={[{ value: '', label: t('allStores') }, ...stores.map((s) => ({ value: s.id, label: s.name }))]}
              placeholder={storesLoading ? tc('loading') : t('allStores')}
            />
          </div>
        )}
        <div className="ms-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={runReport} disabled={loading || !from || !to}>
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {t('runReport')}
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={downloading || !from || !to}>
            {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {t('downloadCsv')}
          </Button>
        </div>
      </div>

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      <Card className="shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('country')}</TableHead>
                <TableHead>{t('label')}</TableHead>
                <TableHead className="text-end">{t('rate')}</TableHead>
                <TableHead className="text-end">{t('taxable')}</TableHead>
                <TableHead className="text-end">{t('tax')}</TableHead>
                <TableHead className="text-end">{t('orders')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">{tc('loading')}</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">{t('noReportRows')}</TableCell>
                </TableRow>
              ) : (
                <>
                  {rows.map((row, index) => (
                    <TableRow key={`${row.country}-${row.label}-${row.rate_bp}-${row.currency}-${index}`}>
                      <TableCell className="text-xs whitespace-nowrap">{countryLabel(row.country, locale)}</TableCell>
                      <TableCell className="text-xs">{row.label}</TableCell>
                      <TableCell className="text-xs text-end tabular-nums">{formatTaxRateLabel(row.rate_bp)}</TableCell>
                      <TableCell className="text-xs text-end tabular-nums">{formatAmountIn(row.taxable_amount, row.currency)}</TableCell>
                      <TableCell className="text-xs text-end font-medium tabular-nums">{formatAmountIn(row.tax_amount, row.currency)}</TableCell>
                      <TableCell className="text-xs text-end tabular-nums">{row.order_count}</TableCell>
                    </TableRow>
                  ))}
                  {totals && (
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell colSpan={3} className="text-xs">{t('totalRow')}</TableCell>
                      <TableCell className="text-xs text-end tabular-nums">{formatAmountIn(totals.taxable, totals.currency)}</TableCell>
                      <TableCell className="text-xs text-end tabular-nums">{formatAmountIn(totals.tax, totals.currency)}</TableCell>
                      <TableCell className="text-xs text-end tabular-nums">{totals.orders}</TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
