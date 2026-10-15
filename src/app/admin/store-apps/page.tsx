'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import { VISIBLE_STORE_APP_KEYS, type AdminStoreAppView, type StoreAppKey } from '@/lib/storeApps.registry';

type StoreType = 'MARKETPLACE' | 'INDEPENDENT';
type TypeFilter = 'ALL' | StoreType;

// One row of GET /stores/admin/apps.
interface StoreAppsRow {
  store_id: string;
  store_name: string;
  store_slug: string;
  store_type: StoreType;
  creator_id: string;
  creator_name: string;
  apps: AdminStoreAppView[];
}

interface StoreAppsPage {
  items: StoreAppsRow[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

/** Key of one (store, app) toggle while its request is in flight. */
const savingKey = (storeId: string, key: StoreAppKey) => `${storeId}:${key}`;

export default function AdminStoreAppsPage() {
  const t = useTranslations('admin.storeAppsPage');
  const tAdmin = useTranslations('admin');
  const tRoot = useTranslations();
  const apiError = useApiError();
  const { token } = useAuth();

  const [rows, setRows] = useState<StoreAppsRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<TypeFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Guards against an older response overwriting a newer one.
  const requestId = useRef(0);

  // Debounce the search box; a new query starts again from page 1.
  useEffect(() => {
    const handle = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    if (!token) return;
    const current = ++requestId.current;
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (query) params.set('q', query);
    if (type !== 'ALL') params.set('type', type);
    setLoading(true);
    api<StoreAppsPage>(`/stores/admin/apps?${params.toString()}`, { token })
      .then((res) => {
        if (current !== requestId.current) return;
        setRows(res?.items ?? []);
        setTotal(res?.total ?? 0);
        setLoadFailed(false);
      })
      .catch(() => {
        if (current !== requestId.current) return;
        setRows([]);
        setTotal(0);
        setLoadFailed(true);
      })
      .finally(() => {
        if (current === requestId.current) setLoading(false);
      });
  }, [token, page, query, type]);

  const patchApp = (storeId: string, key: StoreAppKey, available: boolean) =>
    setRows((prev) =>
      prev.map((row) =>
        row.store_id === storeId
          ? { ...row, apps: row.apps.map((a) => (a.key === key ? { ...a, available } : a)) }
          : row,
      ),
    );

  const handleToggle = async (row: StoreAppsRow, app: AdminStoreAppView, next: boolean) => {
    const sk = savingKey(row.store_id, app.key);
    if (!token || saving.has(sk)) return;
    setErrorMsg(null);
    setSaving((prev) => new Set(prev).add(sk));
    // Optimistic: flip only this app so concurrent toggles on other rows are
    // not clobbered by a revert.
    patchApp(row.store_id, app.key, next);
    try {
      const refreshed = await api<AdminStoreAppView[]>(
        `/stores/by-creator/${row.creator_id}/apps/${app.key}/available`,
        { method: 'PUT', token, body: JSON.stringify({ available: next }) },
      );
      // The response is authoritative (withdrawing also clears the creator's
      // toggle on this app and on the apps depending on it).
      if (Array.isArray(refreshed)) {
        setRows((prev) => prev.map((r) => (r.store_id === row.store_id ? { ...r, apps: refreshed } : r)));
      }
    } catch (err) {
      patchApp(row.store_id, app.key, app.available);
      setErrorMsg(apiError(err));
    } finally {
      setSaving((prev) => {
        const copy = new Set(prev);
        copy.delete(sk);
        return copy;
      });
    }
  };

  const renderApp = (row: StoreAppsRow, key: StoreAppKey) => {
    const app = row.apps.find((a) => a.key === key);
    if (!app) return <span className="text-xs text-muted-foreground">—</span>;
    // Independent-only apps cannot be offered to a marketplace store; an
    // already-available one can still be withdrawn.
    const blocked = app.requires_independent && row.store_type === 'MARKETPLACE' && !app.available;
    const appName = tRoot(`creator.apps.items.${key}.name`);
    const toggle = (
      <ToggleSwitch
        checked={app.available}
        disabled={blocked || saving.has(savingKey(row.store_id, key))}
        onChange={(next) => handleToggle(row, app, next)}
        label={t('availableFor', { app: appName, store: row.store_name })}
      />
    );
    return (
      <div className="flex flex-col items-start gap-1">
        {blocked ? (
          <Tooltip>
            {/* The wrapper keeps the tooltip reachable while the switch is disabled. */}
            <TooltipTrigger render={<span className="inline-flex" />}>{toggle}</TooltipTrigger>
            <TooltipContent>{t('requiresIndependent')}</TooltipContent>
          </Tooltip>
        ) : (
          toggle
        )}
        {app.enabled && (
          <Badge variant="outline" className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
            {t('enabledByCreator')}
          </Badge>
        )}
      </div>
    );
  };

  const typeBadge = (storeType: StoreType) =>
    storeType === 'INDEPENDENT' ? (
      <Badge variant="outline" className="text-[10px] font-semibold bg-sky-50 text-sky-700 border-sky-200">
        {tAdmin('storeTypeIndependent')}
      </Badge>
    ) : (
      <Badge variant="outline" className="text-[10px] font-semibold bg-zinc-50 text-zinc-600 border-zinc-200">
        {tAdmin('storeTypeMarketplace')}
      </Badge>
    );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card className="shadow-none">
        <CardContent className="flex items-start gap-3 py-4">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1 text-sm">
            <p>{t('introAdmin')}</p>
            <p className="text-muted-foreground">{t('introCreator')}</p>
            <p className="text-muted-foreground">{t('introIndependent')}</p>
          </div>
        </CardContent>
      </Card>

      {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
      {loadFailed && <p className="text-sm text-red-600">{t('loadFailed')}</p>}

      <DataTable
        columns={[
          {
            key: 'store',
            label: t('columnStore'),
            render: (row: StoreAppsRow) => (
              <Link href={`/admin/creators/${row.creator_id}`} className="group block min-w-0 space-y-1">
                <p className="text-sm font-medium group-hover:underline">{row.store_name}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground" dir="ltr">{row.store_slug}</span>
                  {typeBadge(row.store_type)}
                </div>
              </Link>
            ),
          },
          {
            key: 'creator',
            label: t('columnCreator'),
            render: (row: StoreAppsRow) => (
              <Link href={`/admin/creators/${row.creator_id}`} className="text-sm hover:underline">
                {row.creator_name}
              </Link>
            ),
          },
          ...VISIBLE_STORE_APP_KEYS.map((key) => ({
            key: `app_${key}`,
            label: tRoot(`creator.apps.items.${key}.name`),
            render: (row: StoreAppsRow) => renderApp(row, key),
          })),
        ]}
        data={rows}
        searchPlaceholder={t('searchPlaceholder')}
        onSearch={setSearch}
        actions={
          <div className="w-48">
            <SearchableSelect
              value={type}
              onChange={(v) => {
                setType(v as TypeFilter);
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: t('typeAll') },
                { value: 'INDEPENDENT', label: tAdmin('storeTypeIndependent') },
                { value: 'MARKETPLACE', label: tAdmin('storeTypeMarketplace') },
              ]}
            />
          </div>
        }
        pagination={{ total, page, limit: PAGE_SIZE, totalPages }}
        onPageChange={setPage}
        emptyMessage={loading ? t('loading') : t('empty')}
      />
    </div>
  );
}
