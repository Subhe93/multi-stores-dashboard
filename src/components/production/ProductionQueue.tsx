'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight, Clock, ExternalLink, Inbox, Loader2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import { cn } from '@/lib/utils';
import { ProductionProgressBar } from './ProductionProgressBar';
import { ageOf, productionApi, type ProductionFilter, type ProductionSummaries } from './production.api';

interface QueueOrder {
  id: string;
  order_number: string;
  status: string;
  created_at?: string | null;
  customer?: { first_name?: string | null; last_name?: string | null } | null;
  items?: unknown[] | null;
}

interface OrdersMeta {
  page: number;
  totalPages: number;
  total: number;
}

const QUEUE_FILTERS: { value: ProductionFilter; key: string }[] = [
  { value: 'in_production', key: 'queue.inProduction' },
  { value: 'ready', key: 'queue.ready' },
  { value: 'not_started', key: 'queue.notStarted' },
];

const PAGE_SIZE = 20;

/**
 * "Queue" tab: open orders in production (or ready / not started), as
 * mobile-first cards with the checklist progress; a card opens the
 * full-screen workspace. The order-number search filters the loaded pages
 * (`GET /orders` has no search parameter).
 */
export function ProductionQueue({ token }: { token: string }) {
  const t = useTranslations('creator.production');
  const tc = useTranslations('creator');
  const apiError = useApiError();
  const locale = useLocale();
  const [filter, setFilter] = useState<ProductionFilter>('in_production');
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [meta, setMeta] = useState<OrdersMeta | null>(null);
  const [summaries, setSummaries] = useState<ProductionSummaries>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Id of the latest request; responses of older requests (e.g. a previous
  // filter still in flight) are ignored so they cannot overwrite the list.
  const requestId = useRef(0);

  const load = useCallback(
    async (page: number, append: boolean) => {
      const id = ++requestId.current;
      const isStale = () => id !== requestId.current;
      setLoading(true);
      setError(null);
      try {
        const res = await api<{ data?: QueueOrder[]; meta?: OrdersMeta | null }>(
          `/orders?page=${page}&limit=${PAGE_SIZE}&production=${filter}`,
          { token },
        );
        if (isStale()) return;
        const rows = res?.data ?? [];
        setOrders((prev) => (append ? [...prev, ...rows] : rows));
        setMeta(res?.meta ?? null);
        if (rows.length > 0) {
          const sums = await productionApi.summaries(token, rows.map((o) => o.id)).catch(() => ({}) as ProductionSummaries);
          if (isStale()) return;
          setSummaries((prev) => (append ? { ...prev, ...sums } : sums));
        } else if (!append) {
          setSummaries({});
        }
      } catch (err) {
        if (!isStale()) setError(apiError(err));
      } finally {
        if (!isStale()) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apiError is a fresh closure each render
    [token, filter],
  );

  useEffect(() => {
    void load(1, false);
  }, [load]);

  const hasMore = !!meta && meta.page < meta.totalPages;
  const needle = search.trim().toLowerCase().replace(/^#/, '');
  const visible = needle ? orders.filter((o) => o.order_number.toLowerCase().includes(needle)) : orders;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {QUEUE_FILTERS.map((f) => (
          <Button
            key={f.value}
            type="button"
            size="sm"
            variant={filter === f.value ? 'default' : 'ghost'}
            className="h-11 px-3 text-xs"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {t(f.key)}
          </Button>
        ))}
        <div className="relative ms-auto w-full sm:w-56">
          <Search className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('queue.search')}
            aria-label={t('queue.search')}
            className="h-11 ps-8 text-sm"
          />
        </div>
        {meta && <span className="w-full text-xs text-muted-foreground sm:w-auto">{t('queue.count', { count: meta.total })}</span>}
      </div>

      {error ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => load(1, false)}>
              {t('retry')}
            </Button>
          </CardContent>
        </Card>
      ) : loading && orders.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Inbox className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">{t('queue.emptyTitle')}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t('queue.emptyBody')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {visible.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t('queue.searchEmpty')}</p>}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((o) => {
              const s = summaries[o.id];
              const customer = [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(' ');
              return (
                <Card key={o.id} className="relative shadow-none transition-colors hover:border-zinc-300">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/production/orders/${o.id}`}
                          className="font-mono text-sm font-semibold after:absolute after:inset-0 hover:underline"
                        >
                          {o.order_number}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{customer || '—'}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[11px] font-semibold">
                        {tc.has(`orderStatus.${o.status}`) ? tc(`orderStatus.${o.status}`) : o.status}
                      </Badge>
                    </div>
                    <ProductionProgressBar done={s?.done ?? 0} total={s?.total ?? 0} />
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {ageOf(o.created_at, locale)}
                        <span>·</span>
                        {tc('orders.itemCount', { count: o.items?.length ?? 0 })}
                      </span>
                      <span className="relative z-10 inline-flex items-center gap-2">
                        <Link
                          href={`/creator/orders/${o.id}`}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          title={t('queue.openOrder')}
                        >
                          <ExternalLink className="size-3" />
                          {t('queue.openOrder')}
                        </Link>
                        <ChevronRight className={cn('size-4 rtl:rotate-180')} />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" disabled={loading} onClick={() => load((meta?.page ?? 1) + 1, true)}>
                {loading && <Loader2 className="animate-spin" />}
                {t('queue.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
