'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Download, Plus, Search, Users, X, Ban, CircleCheck, KeyRound } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';
import {
  CUSTOMER_SORT_KEYS,
  bulkDoneCount,
  bulkFailedCount,
  bulkSkipReasons,
  ownerCanChangeStatus,
  customerListQuery,
  customerName,
  isBlockedStatus,
  isCustomerListFiltered,
  parseCustomerListState,
  patchListParams,
  type CustomerRow,
  type CustomerSortKey,
  type ListMeta,
} from '@/lib/customers';
import {
  bulkCustomers,
  exportCustomersCsv,
  listCustomers,
  type CustomerBulkAction,
  type CustomerScope,
} from '@/lib/customers.api';
import { CustomerStatusBadge, RelativeDate, formatMoney, useDateFormatter } from './shared';
import { NewCustomerDialog, type StoreOption } from './NewCustomerDialog';
import { useCustomerError } from './useCustomerError';

interface Notice {
  tone: 'success' | 'warning' | 'error';
  text: string;
}

interface PendingBulk {
  action: CustomerBulkAction;
  rows: CustomerRow[];
  clear: () => void;
}

/** Customers list shared by the creator page (own store) and the admin page (every store). */
export function CustomerListView({ scope }: { scope: CustomerScope }) {
  const t = useTranslations('creator.customers');
  const ta = useTranslations('admin.customersPage');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuth();
  const { fmt } = useCurrency();
  const fmtDate = useDateFormatter();
  const describeError = useCustomerError();
  const isAdmin = scope === 'admin';
  const listPath = isAdmin ? '/admin/customers' : '/creator/customers';
  const detailPath = (id: string) => `${listPath}/${id}`;

  const state = useMemo(() => parseCustomerListState(searchParams), [searchParams]);
  const { apps } = useStoreApps();
  // Company/person filter only matters to stores selling B2B; the admin sees all stores.
  const showTypeFilter = isAdmin || isAppEnabled(apps, 'b2b');

  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [pendingBulk, setPendingBulk] = useState<PendingBulk | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [searchInput, setSearchInput] = useState(state.q);

  const updateParams = useCallback(
    (patch: Record<string, string>) => {
      const qs = patchListParams(searchParams.toString(), patch);
      router.replace(qs ? `${listPath}?${qs}` : listPath, { scroll: false });
    },
    [router, searchParams, listPath],
  );

  // Last search written to the URL; back/forward or a pasted link copies the
  // URL into the box, while the user's own typing is left alone.
  const pushedQuery = useRef(state.q);
  useEffect(() => {
    if (state.q !== pushedQuery.current) {
      pushedQuery.current = state.q;
      setSearchInput(state.q);
    }
  }, [state.q]);

  const pushSearch = useCallback(
    (value: string) => {
      pushedQuery.current = value;
      updateParams({ q: value });
    },
    [updateParams],
  );

  // Debounced search: the URL follows 300 ms after typing.
  useEffect(() => {
    const value = searchInput.trim();
    if (value === pushedQuery.current) return;
    const id = setTimeout(() => pushSearch(value), 300);
    return () => clearTimeout(id);
  }, [searchInput, pushSearch]);

  const listQuery = customerListQuery(state, { withStore: isAdmin });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listCustomers(token, scope, listQuery)
      .then((res) => {
        if (cancelled) return;
        setRows(res?.data ?? []);
        setMeta(res?.meta ?? null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(describeError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // describeError is rebuilt every render; the query string is the real input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, scope, listQuery, reloadKey]);

  // A page past the end (after a narrower filter) snaps back.
  useEffect(() => {
    if (!loading && meta && meta.totalPages > 0 && state.page > meta.totalPages) {
      updateParams({ page: meta.totalPages > 1 ? String(meta.totalPages) : '' });
    }
  }, [loading, meta, state.page, updateParams]);

  // Admin: the store filter and the create dialog's store picker.
  useEffect(() => {
    if (!isAdmin || !token) return;
    api<{ items?: Array<{ store_id: string; store_name: string; store_slug: string }> }>(
      '/stores/admin/apps?limit=100',
      { token },
    )
      .then((res) =>
        setStores(
          (res?.items ?? [])
            .map((s) => ({ id: s.store_id, name: s.store_name, slug: s.store_slug }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        ),
      )
      .catch(() => setStores([]));
  }, [isAdmin, token]);

  const reload = () => setReloadKey((k) => k + 1);
  const filtered = isCustomerListFiltered(state);
  const clearFilters = () => {
    pushedQuery.current = '';
    setSearchInput('');
    updateParams({ q: '', has_orders: '', type: '', from: '', to: '', store: '' });
  };

  const handleExport = async () => {
    if (!token || exporting) return;
    setExporting(true);
    setNotice(null);
    try {
      await exportCustomersCsv(token, customerListQuery(state, { paged: false }));
    } catch (err) {
      setNotice({ tone: 'error', text: describeError(err) });
    } finally {
      setExporting(false);
    }
  };

  const runBulk = async (action: CustomerBulkAction, rowsToRun: CustomerRow[], clear: () => void) => {
    if (!token || bulkBusy || rowsToRun.length === 0) return;
    setBulkBusy(true);
    setNotice(null);
    try {
      const res = await bulkCustomers(token, rowsToRun.map((r) => r.id), action);
      const done = bulkDoneCount(res, rowsToRun.length);
      const failed = bulkFailedCount(res);
      const reasons = bulkSkipReasons(res);
      const doneText =
        action === 'block'
          ? t('bulk.blocked', { count: done })
          : action === 'unblock'
            ? t('bulk.unblocked', { count: done })
            : t('bulk.linksSent', { count: done });
      // Explain the skips the owner can act on: the store's daily email cap
      // and customers banned by the platform; the rest stay a plain count.
      const parts = [doneText];
      if (reasons.daily_limit) parts.push(t('bulk.dailyLimit', { count: reasons.daily_limit }));
      if (reasons.banned) parts.push(t('bulk.banned', { count: reasons.banned }));
      const otherSkipped = failed - (reasons.daily_limit ?? 0) - (reasons.banned ?? 0);
      if (otherSkipped > 0) parts.push(t('bulk.skipped', { count: otherSkipped }));
      setNotice({
        tone: failed > 0 ? 'warning' : 'success',
        text: parts.join(' · '),
      });
      clear();
      reload();
    } catch (err) {
      setNotice({ tone: 'error', text: describeError(err) });
    } finally {
      setBulkBusy(false);
      setPendingBulk(null);
    }
  };

  // The admin list spans stores with different currencies, so the API
  // doesn't sort it by total spent.
  const sortKeys = isAdmin ? CUSTOMER_SORT_KEYS.filter((k) => k !== 'total_spent') : CUSTOMER_SORT_KEYS;
  const sortOptions = sortKeys.flatMap((key) => [
    { value: `${key}:desc`, label: t(`sort.${key}_desc`) },
    { value: `${key}:asc`, label: t(`sort.${key}_asc`) },
  ]);
  const sortValue = state.sort ? `${state.sort}:${state.dir}` : '';
  const setSort = (key: string, dir: string) =>
    updateParams({ sort: key, dir: key && dir === 'asc' ? 'asc' : '' });

  const columns = [
    {
      key: 'name',
      label: t('cols.customer'),
      sortable: true,
      render: (c: CustomerRow) => {
        const name = customerName(c);
        return (
          <div className="min-w-0">
            <Link href={detailPath(c.id)} className="block truncate text-sm font-medium hover:underline">
              {name}
            </Link>
            {name !== c.email && <span className="block truncate text-xs text-muted-foreground">{c.email}</span>}
            {(c.customer_type === 'COMPANY' || isBlockedStatus(c.status)) && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {c.customer_type === 'COMPANY' && (
                  <Badge variant="outline" className="text-[10px] font-medium bg-violet-50 text-violet-700 border-violet-200">
                    {c.company_name || t('companyBadge')}
                  </Badge>
                )}
                {isBlockedStatus(c.status) && <CustomerStatusBadge status={c.status} />}
              </div>
            )}
          </div>
        );
      },
    },
    ...(isAdmin
      ? [{
          key: 'store',
          label: ta('colStore'),
          render: (c: CustomerRow) =>
            c.store ? (
              <span className="text-xs">
                {c.store.name}
                <span className="block text-[11px] text-muted-foreground">{c.store.slug}</span>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            ),
        }]
      : []),
    {
      key: 'phone',
      label: t('cols.phone'),
      render: (c: CustomerRow) => <span className="text-xs text-muted-foreground" dir="ltr">{c.phone || '—'}</span>,
    },
    {
      key: 'orders_count',
      label: t('cols.orders'),
      sortable: true,
      render: (c: CustomerRow) => <span className="text-sm tabular-nums">{c.orders_count ?? 0}</span>,
    },
    {
      key: 'total_spent',
      label: t('cols.totalSpent'),
      sortable: !isAdmin,
      render: (c: CustomerRow) => (
        <span className="text-sm font-medium tabular-nums">{formatMoney(c.total_spent, c.currency, fmt)}</span>
      ),
    },
    {
      key: 'last_order_at',
      label: t('cols.lastOrder'),
      sortable: true,
      render: (c: CustomerRow) => <RelativeDate value={c.last_order_at} />,
    },
    {
      key: 'created_at',
      label: t('cols.created'),
      sortable: true,
      render: (c: CustomerRow) => <span className="text-xs text-muted-foreground">{fmtDate(c.created_at)}</span>,
    },
  ];

  // No customers at all yet (not a filtered-out list): a friendly empty state.
  const isEmptyStore = !loading && !loadError && !filtered && (meta?.total ?? rows.length) === 0;

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{isAdmin ? ta('title') : t('title')}</h1>
        <p className="text-sm text-muted-foreground">{isAdmin ? ta('subtitle') : t('subtitle')}</p>
      </div>
      <div className="flex items-center gap-2">
        {!isAdmin && !isEmptyStore && (
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExport} disabled={exporting}>
            <Download className="size-3.5 me-1.5" />
            {exporting ? t('exporting') : t('exportCsv')}
          </Button>
        )}
        <Button size="sm" className="h-8 text-xs" onClick={() => setShowNew(true)}>
          <Plus className="size-3.5 me-1.5" />
          {t('newCustomer')}
        </Button>
      </div>
    </div>
  );

  const newDialog = token ? (
    <NewCustomerDialog
      open={showNew}
      onOpenChange={setShowNew}
      token={token}
      scope={scope}
      stores={stores}
      defaultStoreId={state.store}
      onCreated={(id) => {
        setNotice({ tone: 'success', text: t('new.created') });
        if (id) router.push(detailPath(id));
        else reload();
      }}
    />
  ) : null;

  if (isEmptyStore) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="shadow-none">
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
              <Users className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">{t('empty.title')}</p>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">{t('empty.body')}</p>
            </div>
            <Button size="sm" className="h-8 text-xs" onClick={() => setShowNew(true)}>
              <Plus className="size-3.5 me-1.5" />
              {t('newCustomer')}
            </Button>
          </div>
        </Card>
        {newDialog}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {/* Search, filters and sort; every value lives in the URL. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute inset-s-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') pushSearch(searchInput.trim());
            }}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="h-8 w-full rounded-md border border-input bg-background ps-8 pe-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {isAdmin && (
          <div className="w-52">
            <SearchableSelect
              value={state.store}
              onChange={(v) => updateParams({ store: v })}
              placeholder={ta('storeFilter')}
              options={[
                { value: '', label: ta('allStores') },
                ...stores.map((s) => ({ value: s.id, label: s.name, description: s.slug })),
              ]}
            />
          </div>
        )}
        <div className="w-40">
          <SearchableSelect
            value={state.hasOrders}
            onChange={(v) => updateParams({ has_orders: v })}
            placeholder={t('filters.hasOrders')}
            options={[
              { value: '', label: t('filters.anyOrders') },
              { value: 'yes', label: t('filters.withOrders') },
              { value: 'no', label: t('filters.withoutOrders') },
            ]}
          />
        </div>
        {showTypeFilter && (
          <div className="w-40">
            <SearchableSelect
              value={state.type}
              onChange={(v) => updateParams({ type: v })}
              placeholder={t('filters.type')}
              options={[
                { value: '', label: t('filters.anyType') },
                { value: 'person', label: t('filters.person') },
                { value: 'company', label: t('filters.company') },
              ]}
            />
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground" htmlFor="customers-from">{t('filters.createdFrom')}</label>
          <input
            id="customers-from"
            type="date"
            value={state.from}
            max={state.to || undefined}
            onChange={(e) => updateParams({ from: e.target.value })}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <label className="text-xs text-muted-foreground" htmlFor="customers-to">{t('filters.createdTo')}</label>
          <input
            id="customers-to"
            type="date"
            value={state.to}
            min={state.from || undefined}
            onChange={(e) => updateParams({ to: e.target.value })}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="w-52">
          <SearchableSelect
            value={sortValue}
            onChange={(v) => {
              const [key, dir] = v.split(':');
              setSort(key ?? '', dir ?? '');
            }}
            placeholder={t('sort.label')}
            options={[{ value: '', label: t('sort.default') }, ...sortOptions]}
          />
        </div>
        {filtered && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
            <X className="me-1 size-3.5" />
            {t('filters.clear')}
          </Button>
        )}
      </div>

      {notice && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-xs ${
            notice.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : notice.tone === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 opacity-70 hover:opacity-100" aria-label={t('dismiss')}>
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {loadError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            {t('retry')}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(c: CustomerRow) => c.id}
          rowHref={(c: CustomerRow) => detailPath(c.id)}
          onSort={(key, dir) => {
            if ((sortKeys as readonly string[]).includes(key)) setSort(key as CustomerSortKey, dir);
          }}
          emptyMessage={loading ? tc('loading') : t('noMatches')}
          pagination={meta ?? undefined}
          onPageChange={(p) => updateParams({ page: p > 1 ? String(p) : '' })}
          selectable={!isAdmin}
          bulkActions={
            isAdmin
              ? undefined
              : (selected, clear) => (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      disabled={bulkBusy}
                      onClick={() => void runBulk('send-login-link', selected, clear)}
                    >
                      <KeyRound className="size-3.5" />
                      {t('actions.sendLoginLink')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      disabled={bulkBusy || !selected.some((c) => isBlockedStatus(c.status) && ownerCanChangeStatus(c.status))}
                      onClick={() =>
                        void runBulk(
                          'unblock',
                          // A platform ban (BANNED) is not the owner's to lift.
                          selected.filter((c) => isBlockedStatus(c.status) && ownerCanChangeStatus(c.status)),
                          clear,
                        )
                      }
                    >
                      <CircleCheck className="size-3.5" />
                      {t('actions.unblock')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs text-red-600 hover:text-red-700"
                      disabled={bulkBusy || !selected.some((c) => !isBlockedStatus(c.status))}
                      onClick={() =>
                        setPendingBulk({ action: 'block', rows: selected.filter((c) => !isBlockedStatus(c.status)), clear })
                      }
                    >
                      <Ban className="size-3.5" />
                      {t('actions.block')}
                    </Button>
                  </>
                )
          }
        />
      )}

      <ConfirmDialog
        open={!!pendingBulk}
        onOpenChange={(o) => { if (!o) setPendingBulk(null); }}
        title={t('confirmBlock.bulkTitle', { count: pendingBulk?.rows.length ?? 0 })}
        description={t('confirmBlock.description')}
        confirmLabel={t('actions.block')}
        destructive
        busy={bulkBusy}
        busyLabel={t('working')}
        onConfirm={() => {
          if (pendingBulk) void runBulk(pendingBulk.action, pendingBulk.rows, pendingBulk.clear);
        }}
      />
      {newDialog}
    </div>
  );
}
