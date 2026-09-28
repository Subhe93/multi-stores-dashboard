'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

type EmailLogStatus = 'SENT' | 'FAILED' | 'SKIPPED';

interface EmailLogRow {
  id: string;
  created_at: string;
  recipient: string;
  subject: string;
  event: string | null;
  status: EmailLogStatus;
  via: 'store' | 'platform' | null;
  smtp_host: string | null;
  error: string | null;
  order_id: string | null;
  store: { id: string; name: string; slug: string } | null;
}

interface EmailLogResponse {
  items: EmailLogRow[];
  total: number;
  page: number;
  limit: number;
  failed_last_7_days: number;
}

interface EmailLogTableProps {
  // '/mail/admin/logs' (every store) or '/mail/store/logs' (the caller's store).
  endpoint: string;
  // Admin view: show which store each message belongs to.
  showStore?: boolean;
}

const STATUS_CLASSES: Record<EmailLogStatus, string> = {
  SENT: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  FAILED: 'border-red-200 bg-red-50 text-red-700',
  SKIPPED: 'border-amber-200 bg-amber-50 text-amber-700',
};

const KNOWN_EVENTS = new Set([
  'order_confirmation',
  'order_shipped',
  'order_delivered',
  'order_cancelled',
  'order_refunded',
  'new_order_owner',
  'password_reset',
  'welcome',
  'test',
]);

const PAGE_SIZE = 25;

// Delivery log: what was handed to the SMTP server, what failed and why.
export function EmailLogTable({ endpoint, showStore = false }: EmailLogTableProps) {
  const t = useTranslations('emailLog');
  const locale = useLocale();
  const { token } = useAuth();

  const [data, setData] = useState<EmailLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Debounce the search box so typing does not fire a request per key.
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (status) params.set('status', status);
      if (query) params.set('q', query);
      const res = await api<EmailLogResponse>(`${endpoint}?${params.toString()}`, { token });
      setData(res);
    } catch (err) {
      setError((err instanceof Error && err.message) || t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [token, endpoint, page, status, query, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const columns = showStore ? 6 : 5;

  const eventLabel = (event: string | null) =>
    event && KNOWN_EVENTS.has(event) ? t(`events.${event}` as never) : event || '—';

  return (
    <div className="space-y-3">
      {!!data && data.failed_last_7_days > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{t('failedWarning', { count: data.failed_last_7_days })}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="h-8 text-sm max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
        />
        <div className="w-44">
          <SearchableSelect
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { value: '', label: t('allStatuses') },
              { value: 'SENT', label: t('status.SENT') },
              { value: 'FAILED', label: t('status.FAILED') },
              { value: 'SKIPPED', label: t('status.SKIPPED') },
            ]}
          />
        </div>
        <Button size="sm" variant="outline" className="h-8 ms-auto" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          <span className="ms-1.5">{t('refresh')}</span>
        </Button>
      </div>

      <Card className="shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('date')}</TableHead>
                <TableHead>{t('recipient')}</TableHead>
                <TableHead>{t('subject')}</TableHead>
                {showStore && <TableHead>{t('store')}</TableHead>}
                <TableHead>{t('sender')}</TableHead>
                <TableHead>{t('statusLabel')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {error ? (
                <TableRow>
                  <TableCell colSpan={columns} className="py-8 text-center text-sm text-destructive">
                    {error}
                  </TableCell>
                </TableRow>
              ) : loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns} className="py-8 text-center">
                    <Loader2 className="size-4 animate-spin inline text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns} className="py-8 text-center text-sm text-muted-foreground">
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <Fragment key={row.id}>
                    <TableRow>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString(locale)}
                      </TableCell>
                      <TableCell className="text-xs font-mono" dir="ltr">
                        {row.recipient}
                      </TableCell>
                      <TableCell className="text-xs">
                        <p className="max-w-xs truncate">{row.subject}</p>
                        <p className="text-[11px] text-muted-foreground">{eventLabel(row.event)}</p>
                      </TableCell>
                      {showStore && <TableCell className="text-xs">{row.store?.name || t('platform')}</TableCell>}
                      <TableCell className="text-xs">
                        {row.via ? t(`via.${row.via}` as never) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={`text-[10px] ${STATUS_CLASSES[row.status]}`}>
                            {t(`status.${row.status}` as never)}
                          </Badge>
                          {row.error && (
                            <button
                              type="button"
                              onClick={() => toggle(row.id)}
                              className="text-muted-foreground hover:text-foreground"
                              aria-label={t('showError')}
                            >
                              {expanded.has(row.id) ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {row.error && expanded.has(row.id) && (
                      <TableRow>
                        <TableCell colSpan={columns} className="bg-red-50/50 text-[11px] text-red-700 font-mono" dir="ltr">
                          {row.smtp_host ? `${row.smtp_host}: ` : ''}
                          {row.error}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">{t('sentHint')}</p>

      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('pageOf', { page, pages, total })}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              {t('previous')}
            </Button>
            <Button size="sm" variant="outline" className="h-7" disabled={page >= pages || loading} onClick={() => setPage((p) => p + 1)}>
              {t('next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
