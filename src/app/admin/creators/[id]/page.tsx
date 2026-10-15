'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { AdminStoreDomainsCard } from '@/components/markets/AdminStoreDomainsCard';
import { ArrowLeft, Mail, Phone, CheckCircle2, Clock, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { isHiddenApp, type AdminStoreAppView, type StoreAppKey } from '@/lib/storeApps.registry';
import { countryName } from '@/lib/taxCountries';
import type { TaxPricingMode } from '@/lib/taxRate';
import Link from 'next/link';

type StoreType = 'MARKETPLACE' | 'INDEPENDENT';

interface Store {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  store_type?: StoreType;
  // Tax setup (independent stores); marketplace stores are taxed by the platform.
  tax_pricing_mode?: TaxPricingMode;
  tax_country?: string | null;
}

// Creator profile as returned by GET /creators/:id (only the fields this page reads).
interface CreatorDetail {
  id: string;
  display_name: string;
  phone?: string | null;
  bio?: string | null;
  verified: boolean;
  created_at: string;
  user?: { email: string } | null;
}

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003';

function storeUrl(slug: string): string {
  const u = new URL(WEB_ORIGIN);
  return `${u.protocol}//${slug}.${u.host}`;
}

export default function CreatorDetailPage() {
  const t = useTranslations('admin');
  // Root translator so API error codes can be resolved under `errors.<code>`.
  const tRoot = useTranslations();
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [creator, setCreator] = useState<CreatorDetail | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const [slug, setSlug] = useState('');
  const [savingSlug, setSavingSlug] = useState(false);
  const [slugMsg, setSlugMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [storeType, setStoreType] = useState<StoreType>('MARKETPLACE');
  const [savingType, setSavingType] = useState(false);
  const [typeMsg, setTypeMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Store apps allowlist (admin side): which optional apps this store may
  // enable. Null until the store is known; empty when the request failed.
  const [storeApps, setStoreApps] = useState<AdminStoreAppView[] | null>(null);
  const [savingApp, setSavingApp] = useState<StoreAppKey | null>(null);
  const [appsMsg, setAppsMsg] = useState<string | null>(null);
  // True when the apps GET failed; translated at render time so the effect
  // doesn't depend on the translator.
  const [appsLoadFailed, setAppsLoadFailed] = useState(false);

  const fetchCreator = () => {
    if (!token || !id) return;
    api<CreatorDetail>(`/creators/${id}`, { token })
      .then(setCreator)
      .catch(console.error);
  };

  const fetchStore = () => {
    if (!token || !id) return;
    api<Store>(`/stores/by-creator/${id}`, { token })
      .then((s) => { setStore(s); setSlug(s.slug); })
      .catch(() => setStore(null));
  };

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    Promise.all([
      api<CreatorDetail>(`/creators/${id}`, { token }).then(setCreator).catch(console.error),
      api<Store>(`/stores/by-creator/${id}`, { token })
        .then((s) => { setStore(s); setSlug(s.slug); setStoreType(s.store_type ?? 'MARKETPLACE'); })
        .catch(() => setStore(null)),
      api<AdminStoreAppView[]>(`/stores/by-creator/${id}/apps`, { token })
        .then((list) => setStoreApps(Array.isArray(list) ? list : []))
        .catch(() => { setStoreApps([]); setAppsLoadFailed(true); }),
    ]).finally(() => setLoading(false));
  }, [token, id]);

  const handleToggleAppAvailable = async (app: AdminStoreAppView, next: boolean) => {
    if (!token || !storeApps || savingApp) return;
    setSavingApp(app.key);
    setAppsMsg(null);
    // Optimistic update — revert on failure. `enabled` is the creator's raw
    // toggle and is left untouched; the API response is authoritative.
    const previous = storeApps;
    setStoreApps(previous.map((a) => (a.key === app.key ? { ...a, available: next } : a)));
    try {
      const refreshed = await api<AdminStoreAppView[]>(`/stores/by-creator/${id}/apps/${app.key}/available`, {
        method: 'PUT', token,
        body: JSON.stringify({ available: next }),
      });
      if (Array.isArray(refreshed)) setStoreApps(refreshed);
    } catch (err) {
      setStoreApps(previous);
      const code = err instanceof ApiError ? err.code : undefined;
      setAppsMsg(
        code && tRoot.has(`errors.${code}`)
          ? tRoot(`errors.${code}`)
          : (err instanceof Error && err.message) || t('storeApps.updateFailed'),
      );
    } finally {
      setSavingApp(null);
    }
  };

  const handleVerify = async () => {
    if (!token) return;
    await api(`/creators/${id}/verify`, { method: 'PUT', token });
    fetchCreator();
  };

  const handleSaveSlug = async () => {
    if (!token || !store || savingSlug) return;
    const next = slug.trim().toLowerCase();
    if (!next || next === store.slug) return;
    setSavingSlug(true);
    setSlugMsg(null);
    try {
      const updated = await api<Store>(`/stores/by-creator/${id}`, {
        method: 'PUT', token,
        body: JSON.stringify({ slug: next }),
      });
      setStore(updated);
      setSlug(updated.slug);
      setSlugMsg({ kind: 'ok', text: t('slugUpdated') });
    } catch (err) {
      setSlugMsg({ kind: 'err', text: (err instanceof Error && err.message) || t('failedToUpdateSlug') });
    } finally {
      setSavingSlug(false);
    }
  };

  const handleSaveType = async () => {
    if (!token || !store || savingType) return;
    if (storeType === (store.store_type ?? 'MARKETPLACE')) return;
    setSavingType(true);
    setTypeMsg(null);
    try {
      const updated = await api<Store>(`/stores/by-creator/${id}`, {
        method: 'PUT', token,
        body: JSON.stringify({ store_type: storeType }),
      });
      setStore(updated);
      setStoreType(updated.store_type ?? 'MARKETPLACE');
      setTypeMsg({ kind: 'ok', text: t('storeTypeUpdated') });
    } catch (err) {
      setTypeMsg({ kind: 'err', text: (err instanceof Error && err.message) || t('failedToUpdateStoreType') });
    } finally {
      setSavingType(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!creator) return <p className="text-center py-12 text-muted-foreground">{t('creatorNotFound')}</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/creators" className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{creator.display_name}</h1>
            <p className="text-sm text-muted-foreground">{creator.user?.email}</p>
          </div>
        </div>
        {creator.verified
          ? <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" />{t('verified')}</Badge>
          : <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" />{t('pending')}</Badge>
        }
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="shadow-none">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('creatorInfo')}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" />{creator.user?.email}</div>
            {creator.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" />{creator.phone}</div>}
            {creator.bio && <div><p className="text-xs text-muted-foreground font-medium mb-1">{t('bio')}</p><p className="text-muted-foreground">{creator.bio}</p></div>}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('actions')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!creator.verified && (
              <Button size="sm" className="w-full" onClick={handleVerify}>{t('verifyCreator')}</Button>
            )}
            <p className="text-[10px] text-muted-foreground">{t('joinedDate', { date: new Date(creator.created_at).toLocaleDateString() })}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-semibold">{t('store')}</CardTitle>
          {store && (
            <a href={storeUrl(store.slug)} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="h-7 text-[11px]">
                <ExternalLink className="w-3 h-3 mr-1" /> {t('visit')}
              </Button>
            </a>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!store ? (
            <p className="text-sm text-muted-foreground">{t('creatorNoStoreYet')}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('storeName')}</Label>
                  <Input className="h-8 text-sm" value={store.name} disabled readOnly />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('status')}</Label>
                  <div className="h-8 flex items-center">
                    {store.is_active
                      ? <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">{t('active')}</Badge>
                      : <Badge variant="outline" className="text-[10px] bg-zinc-50 text-zinc-600 border-zinc-200">{t('inactive')}</Badge>}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{t('slug')}</Label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center flex-1">
                    <Input
                      className="h-8 text-sm rounded-r-none border-r-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="store-slug"
                    />
                    <span className="h-8 px-3 flex items-center bg-zinc-50 border border-zinc-200 rounded-r-md text-xs text-muted-foreground whitespace-nowrap">.platform.com</span>
                  </div>
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={handleSaveSlug}
                    disabled={savingSlug || !slug.trim() || slug.trim() === store.slug}
                  >
                    {savingSlug ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> {t('saving')}</> : t('save')}
                  </Button>
                </div>
                {slugMsg && (
                  <p className={`text-[11px] ${slugMsg.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{slugMsg.text}</p>
                )}
                <p className="text-[11px] text-muted-foreground">{t('slugHint')}</p>
              </div>

              {/* Store type — admin-only override; the creator cannot change it */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t('storeType')}</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <SearchableSelect
                      value={storeType}
                      onChange={(v) => setStoreType(v as StoreType)}
                      options={[
                        { value: 'MARKETPLACE', label: t('storeTypeMarketplace'), description: t('storeTypeMarketplaceDesc') },
                        { value: 'INDEPENDENT', label: t('storeTypeIndependent'), description: t('storeTypeIndependentDesc') },
                      ]}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={handleSaveType}
                    disabled={savingType || storeType === (store.store_type ?? 'MARKETPLACE')}
                  >
                    {savingType ? <><Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" /> {t('saving')}</> : t('save')}
                  </Button>
                </div>
                {typeMsg && (
                  <p className={`text-[11px] ${typeMsg.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{typeMsg.text}</p>
                )}
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 space-y-1">
                  <p className="text-[11px] font-medium text-amber-700">{t('storeTypeWarning')}</p>
                  <ul className="list-disc ps-4 space-y-0.5 text-[11px] text-amber-700">
                    <li>{t('storeTypeWarnCatalog')}</li>
                    <li>{t('storeTypeWarnOrders')}</li>
                    <li>{t('storeTypeWarnReconnect')}</li>
                  </ul>
                  <Link
                    href="/admin/guide"
                    className="inline-block text-[11px] font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900"
                  >
                    {t('storeTypeGuideLink')}
                  </Link>
                </div>
              </div>

              {/* Tax setup is managed by the creator; read-only here.
                  Marketplace stores are taxed by the platform settings. */}
              <p className="text-xs text-muted-foreground border-t pt-3">
                {store.store_type === 'INDEPENDENT'
                  ? t('storeTaxSummary', {
                      mode: store.tax_pricing_mode === 'EXCLUSIVE' ? t('taxModeExclusive') : t('taxModeInclusive'),
                      country: store.tax_country ? countryName(store.tax_country, locale) : t('taxCountryPlatformDefault'),
                    })
                  : t('storeTaxPlatformManaged')}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Store apps allowlist — hidden until the creator has a store */}
      {store && storeApps && (
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{t('storeApps.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
              {t('storeApps.overviewHint')}{' '}
              <Link href="/admin/store-apps" className="font-medium text-foreground underline underline-offset-2">
                {t('storeApps.overviewLink')}
              </Link>
            </p>
            {storeApps.filter((app) => !isHiddenApp(app.key)).map((app) => (
              <div key={app.key} className="flex items-center justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium">{tRoot(`creator.apps.items.${app.key}.name`)}</p>
                  <p className="text-[11px] text-muted-foreground">{tRoot(`creator.apps.items.${app.key}.description`)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {app.enabled
                    ? <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">{t('storeApps.creatorEnabled')}</Badge>
                    : <Badge variant="outline" className="text-[10px] bg-zinc-50 text-zinc-600 border-zinc-200">{t('storeApps.creatorDisabled')}</Badge>}
                  <ToggleSwitch
                    checked={app.available}
                    disabled={savingApp !== null}
                    onChange={(next) => handleToggleAppAvailable(app, next)}
                    label={t('storeApps.available')}
                  />
                </div>
              </div>
            ))}
            {appsLoadFailed && <p className="text-[11px] text-red-600">{t('storeApps.loadFailed')}</p>}
            {appsMsg && <p className="text-[11px] text-red-600">{appsMsg}</p>}
          </CardContent>
        </Card>
      )}

      {/* Market domains: admin activates hosts after the Cloudflare step (markets app only). */}
      {store && storeApps?.some((a) => a.key === 'markets' && a.available && a.enabled) && (
        <AdminStoreDomainsCard creatorId={id} />
      )}
    </div>
  );
}
