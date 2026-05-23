'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft, ImageIcon, ExternalLink, Globe, Languages,
  FileText, Calendar, BadgeCheck, Package2, Store as StoreIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';
import { useTranslations } from 'next-intl';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '');
function resolveUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

interface StaticPage {
  id: string;
  type: string;
  slug: string;
  status: string;
  translations: { locale: string; title: string }[];
}

interface CustomProductUsing {
  id: string;
  status: string;
  pricing_type: 'SINGLE' | 'MARGIN' | 'PER_VARIANT';
  final_price: string;
  margin_amount: string | null;
  created_at: string;
  translations: { locale: string; title: string }[];
  mockup_images: { url: string }[];
  selected_variants?: {
    custom_price: string | null;
    variant: { price_adjustment: string };
  }[];
  product: {
    id: string;
    base_price: string;
    translations: { locale: string; title: string }[];
    images: { url: string }[];
  };
}

interface StoreDetails {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  favicon_url?: string | null;
  custom_domain?: string | null;
  is_active: boolean;
  created_at: string;
  creator: {
    display_name: string;
    avatar_url?: string | null;
    cover_url?: string | null;
    bio?: string | null;
    verified: boolean;
  };
  language_config?: {
    primary_locale: string;
    secondary_locales: string[];
  } | null;
  static_pages: StaticPage[];
  custom_products_using: CustomProductUsing[];
}

const PAGE_TYPE_LABEL_KEYS: Record<string, string> = {
  ABOUT: 'pageTypeAbout',
  CONTACT: 'pageTypeContact',
  PRIVACY_POLICY: 'pageTypePrivacy',
  TERMS: 'pageTypeTerms',
  SHIPPING_POLICY: 'pageTypeShippingPolicy',
  RETURN_POLICY: 'pageTypeReturnPolicy',
  FAQ: 'pageTypeFaq',
  CUSTOM: 'pageTypeCustom',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT:           'bg-zinc-100 text-zinc-600',
  PENDING_REVIEW:  'bg-amber-50 text-amber-700 border-amber-200',
  REJECTED:        'bg-rose-50 text-rose-700 border-rose-200',
  PUBLISHED:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  ARCHIVED:        'bg-zinc-100 text-zinc-500 border-zinc-200',
};

export default function ProviderStoreDetails() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { fmt } = useCurrency();
  const router = useRouter();
  const t = useTranslations('provider');
  const tc = useTranslations('common');
  const [store, setStore] = useState<StoreDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    api<StoreDetails>(`/providers/me/stores/${id}`, { token })
      .then(setStore)
      .catch((e) => setError(e.message || t('failedToLoadStore')))
      .finally(() => setLoading(false));
  }, [token, id]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">{tc('loading')}</p>;
  }

  if (error || !store) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => router.push('/provider/stores')}>
          <ArrowLeft className="w-3 h-3 mr-1" /> {tc('back')}
        </Button>
        <Card className="shadow-none">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">{error || t('storeNotFound')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryTitle = (translations: { locale: string; title: string }[], primaryLocale = 'en') =>
    translations.find(tr => tr.locale === primaryLocale)?.title || translations[0]?.title || t('untitled');

  // Compute the displayed price per pricing strategy. Falls back to base_price
  // when the strategy-specific value is unset, so we never show a stale "0" or "—".
  const displayPrice = (cp: CustomProductUsing): string => {
    const base = Number(cp.product.base_price) || 0;

    if (cp.pricing_type === 'MARGIN') {
      const margin = Number(cp.margin_amount) || 0;
      return fmt(base + margin);
    }

    if (cp.pricing_type === 'PER_VARIANT') {
      // Each selected variant uses its custom_price; if null, fall back to
      // base_price + the underlying variant's price_adjustment.
      const prices = (cp.selected_variants || [])
        .map(v => {
          const custom = Number(v.custom_price);
          if (Number.isFinite(custom) && custom > 0) return custom;
          return base + (Number(v.variant?.price_adjustment) || 0);
        })
        .filter(n => Number.isFinite(n) && n > 0);
      if (prices.length === 0) return fmt(base);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
    }

    // SINGLE — if creator hasn't set a price yet, show the base price instead of "$0.00".
    const final = Number(cp.final_price) || 0;
    return fmt(final > 0 ? final : base);
  };

  const primaryLocale = store.language_config?.primary_locale || 'en';
  const storeUrl = store.custom_domain
    ? `https://${store.custom_domain}`
    : `${process.env.NEXT_PUBLIC_WEB_URL || ''}/${store.slug}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => router.push('/provider/stores')}>
          <ArrowLeft className="w-3 h-3 mr-1" /> {t('backToStores')}
        </Button>
        {storeUrl && (
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            {t('visitStore')} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Cover + header */}
      <Card className="shadow-none overflow-hidden">
        {store.creator.cover_url && (
          <div className="h-32 bg-zinc-100 overflow-hidden">
            <img src={resolveUrl(store.creator.cover_url)} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-lg bg-zinc-100 border overflow-hidden flex items-center justify-center shrink-0">
              {store.logo_url
                ? <img src={resolveUrl(store.logo_url)} alt="" className="h-full w-full object-cover" />
                : <StoreIcon className="w-7 h-7 text-zinc-300" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold tracking-tight">{store.name}</h1>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold ${
                    store.is_active
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                  }`}
                >
                  {store.is_active ? t('active') : t('inactive')}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">/{store.slug}</p>
              {store.description && (
                <div
                  className="prose prose-sm max-w-none text-muted-foreground mt-2"
                  dangerouslySetInnerHTML={{ __html: store.description }}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Products from you */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package2 className="w-4 h-4" />
                {t('yourProductsInStore')}
                <Badge variant="secondary" className="text-[10px] ml-1">
                  {store.custom_products_using.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {store.custom_products_using.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">{t('noProductsYet')}</p>
              ) : (
                <div className="space-y-1">
                  {store.custom_products_using.map(cp => {
                    const img = cp.mockup_images?.[0]?.url || cp.product.images?.[0]?.url;
                    const title = primaryTitle(cp.translations, primaryLocale);
                    const baseTitle = primaryTitle(cp.product.translations, primaryLocale);
                    return (
                      <button
                        key={cp.id}
                        onClick={() => router.push(`/provider/products/${cp.product.id}`)}
                        className="w-full flex items-center gap-3 py-2 px-2 rounded hover:bg-zinc-50 transition text-left"
                      >
                        <div className="h-10 w-10 rounded bg-zinc-100 border overflow-hidden flex items-center justify-center shrink-0">
                          {img ? <img src={resolveUrl(img)} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="w-3.5 h-3.5 text-zinc-300" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{title}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {t('basedOn', { title: baseTitle })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-medium tabular-nums">{displayPrice(cp)}</span>
                          <Badge variant="outline" className={`text-[9px] ${STATUS_COLORS[cp.status] || ''}`}>
                            {cp.status}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Static pages */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t('publicPages')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {store.static_pages.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">{t('noPublishedPages')}</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {store.static_pages.map(p => {
                    const title = p.translations.find(tr => tr.locale === primaryLocale)?.title
                      || p.translations[0]?.title
                      || (PAGE_TYPE_LABEL_KEYS[p.type] ? t(PAGE_TYPE_LABEL_KEYS[p.type]) : undefined)
                      || p.type;
                    return (
                      <div key={p.id} className="flex items-center gap-2 py-1.5 px-2 rounded border bg-zinc-50/40">
                        <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{title}</p>
                          <p className="text-[10px] text-muted-foreground">/{p.slug}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Creator card */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t('creator')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-zinc-100 border overflow-hidden flex items-center justify-center shrink-0">
                  {store.creator.avatar_url
                    ? <img src={resolveUrl(store.creator.avatar_url)} alt="" className="h-full w-full object-cover" />
                    : <ImageIcon className="w-4 h-4 text-zinc-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{store.creator.display_name}</p>
                    {store.creator.verified && (
                      <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    )}
                  </div>
                  {store.creator.bio && (
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-3">{store.creator.bio}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info card */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t('storeInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="flex items-start gap-2 text-xs">
                <Globe className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-muted-foreground">{t('domain')}</p>
                  <p className="font-medium truncate">{store.custom_domain || t('slugSubdomain', { slug: store.slug })}</p>
                </div>
              </div>
              {store.language_config && (
                <div className="flex items-start gap-2 text-xs">
                  <Languages className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-muted-foreground">{t('languages')}</p>
                    <p className="font-medium">
                      {store.language_config.primary_locale.toUpperCase()}
                      {store.language_config.secondary_locales.length > 0 &&
                        ` + ${store.language_config.secondary_locales.map(l => l.toUpperCase()).join(', ')}`}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2 text-xs">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-muted-foreground">{t('created')}</p>
                  <p className="font-medium">{new Date(store.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
