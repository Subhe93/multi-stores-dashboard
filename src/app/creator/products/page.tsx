'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ShoppingBag, Package, ArrowRight, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCurrency } from '@/lib/useCurrency';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CustomProduct {
  id: string;
  final_price: number;
  status: string;
  translations: { locale: string; title: string }[];
  base_product?: { translations: { locale: string; title: string }[] };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadgeClass(status: string): string {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'DRAFT':
      return 'bg-zinc-100 text-zinc-600 border-zinc-200';
    case 'PAUSED':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-zinc-100 text-zinc-600 border-zinc-200';
  }
}

function getEnTitle(translations: { locale: string; title: string }[]): string {
  return translations.find((t) => t.locale === 'en')?.title || translations[0]?.title || '—';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreatorProductsPage() {
  const { fmt } = useCurrency();
  const { token } = useAuth();
  const router = useRouter();
  const t = useTranslations('creator');

  const [products, setProducts] = useState<CustomProduct[]>([]);
  const [meta, setMeta] = useState<{ total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api<{ data: CustomProduct[]; meta: any }>('/custom-products?limit=20', { token })
      .then((res) => {
        setProducts(res?.data ?? []);
        setMeta(res?.meta ?? null);
      })
      .catch((err) => console.error('Failed to load custom products:', err))
      .finally(() => setLoading(false));
  }, [token]);

  const displayProducts = products.slice(0, 5);
  const showViewAll = (meta?.total ?? 0) > 5;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('products.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('products.subtitle')}
        </p>
      </div>

      {/* Top action cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Browse Provider Products */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <ShoppingBag className="size-4" />
              </div>
              {t('products.browseProviderProducts')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {t('products.browseProviderDesc')}
            </p>
            <Button
              size="sm"
              onClick={() => router.push('/creator/products/browse')}
            >
              {t('products.browseCatalog')}
              <ArrowRight className="size-3.5" />
            </Button>
          </CardContent>
        </Card>

        {/* Add Own Product */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <Package className="size-4" />
              </div>
              {t('products.addOwnProduct')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {t('products.addOwnDesc')}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push('/creator/products/own/new')}
            >
              {t('products.addProduct')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* My Store Products */}
      <Card className="shadow-none">
        <CardHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">{t('products.myStoreProducts')}</CardTitle>
            {showViewAll && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => router.push('/creator/custom-products')}
              >
                {t('products.viewAll')}
                <ExternalLink className="size-3" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-4 w-40 animate-pulse rounded bg-zinc-100" />
                  <div className="ml-auto h-4 w-16 animate-pulse rounded bg-zinc-100" />
                </div>
              ))}
            </div>
          ) : displayProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="mb-2 size-8 text-zinc-300" />
              <p className="text-sm text-muted-foreground">{t('products.noProductsYet')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('products.noProductsHint')}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {displayProducts.map((product) => {
                const title = getEnTitle(product.translations);
                const baseName = product.base_product
                  ? getEnTitle(product.base_product.translations)
                  : null;

                return (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{title}</p>
                      {baseName && (
                        <p className="text-[11px] text-muted-foreground">{t('products.base')}: {baseName}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs font-medium tabular-nums">
                        {fmt(product.final_price)}
                      </span>
                      <span
                        className={`inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-medium ${statusBadgeClass(product.status)}`}
                      >
                        {product.status
                          ? product.status.charAt(0) + product.status.slice(1).toLowerCase()
                          : t('products.draft')}
                      </span>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => router.push(`/creator/custom-products/${product.id}`)}
                      >
                        {t('products.edit')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
