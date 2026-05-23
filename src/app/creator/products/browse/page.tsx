'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Package, Search, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurrency } from '@/lib/useCurrency';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '');

function resolveUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

interface Product {
  id: string;
  base_price: number;
  images?: { url: string; sort_order: number }[];
  category?: { translations: { locale: string; name: string }[] };
  translations: { locale: string; title: string }[];
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type Translator = ReturnType<typeof useTranslations>;

function getTitle(translations: { locale: string; title: string }[], t: Translator) {
  return translations.find((tr) => tr.locale === 'en')?.title || translations[0]?.title || t('browseCatalog.untitled');
}

function getCategoryName(translations?: { locale: string; name: string }[]) {
  if (!translations) return '';
  return translations.find((t) => t.locale === 'en')?.name || translations[0]?.name || '';
}

export default function BrowseProviderCatalogPage() {
  const { fmt } = useCurrency();
  const { token } = useAuth();
  const router = useRouter();
  const t = useTranslations('creator');
  const tc = useTranslations('common');

  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<any[]>('/categories', { token })
      .then((res) => setCategories(Array.isArray(res) ? res : []))
      .catch(() => {});
  }, [token]);

  const fetchProducts = useCallback(
    async (pageNum: number, searchTerm: string, categoryId?: string | null) => {
      if (!token) return;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: '18',
          owner_type: 'provider',
        });
        if (searchTerm) params.set('search', searchTerm);
        if (categoryId) params.set('category_id', categoryId);
        const res = await api<{ data: Product[]; meta: Meta }>(`/products?${params.toString()}`, { token });
        setProducts(res?.data ?? []);
        setMeta(res?.meta ?? null);
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    fetchProducts(page, search, selectedCategoryId);
  }, [page, search, selectedCategoryId, token, fetchProducts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => router.push('/creator/products')}>
            <ArrowLeft className="size-4 rtl:rotate-180" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{t('browseCatalog.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('browseCatalog.subtitle')}</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute inset-s-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('browseCatalog.searchPlaceholder')}
              className="h-8 w-56 ps-8"
            />
          </div>
          <Button type="submit" size="sm" variant="outline">{tc('search')}</Button>
        </form>
      </div>

      <div className="flex gap-6">
        {/* Category Sidebar */}
        <div className="hidden lg:block w-52 shrink-0">
          <div className="sticky top-6 space-y-1">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">{t('browseCatalog.categories')}</p>
            <button
              type="button"
              onClick={() => handleCategorySelect(null)}
              className={`w-full text-start px-3 py-1.5 rounded-md text-sm transition ${
                !selectedCategoryId ? 'bg-zinc-900 text-white font-medium' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {t('browseCatalog.allProducts')}
            </button>
            {categories.map((cat) => {
              const name = cat.translations?.find((t: any) => t.locale === 'en')?.name || cat.translations?.[0]?.name || '—';
              const isActive = selectedCategoryId === cat.id;
              return (
                <div key={cat.id}>
                  <button
                    type="button"
                    onClick={() => handleCategorySelect(cat.id)}
                    className={`w-full text-start px-3 py-1.5 rounded-md text-sm transition ${
                      isActive ? 'bg-zinc-900 text-white font-medium' : 'text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    {name}
                  </button>
                  {cat.children?.map((child: any) => {
                    const childName = child.translations?.find((t: any) => t.locale === 'en')?.name || child.translations?.[0]?.name || '—';
                    const childActive = selectedCategoryId === child.id;
                    return (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => handleCategorySelect(child.id)}
                        className={`w-full text-start ps-6 pe-3 py-1 rounded-md text-xs transition ${
                          childActive ? 'bg-zinc-900 text-white font-medium' : 'text-zinc-500 hover:bg-zinc-100'
                        }`}
                      >
                        {childName}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 min-w-0 space-y-4">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Card key={i} className="shadow-none">
                  <div className="aspect-video w-full animate-pulse rounded-t-xl bg-zinc-100" />
                  <CardContent className="space-y-2 py-3">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-100" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-100" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Package className="mb-3 size-10 text-zinc-300" />
              <p className="text-sm font-medium">{t('browseCatalog.noProducts')}</p>
              {search && <p className="mt-1 text-xs text-muted-foreground">{t('browseCatalog.tryDifferentSearch')}</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => {
                const title = getTitle(product.translations, t);
                const category = getCategoryName(product.category?.translations);
                const image = resolveUrl(product.images?.[0]?.url);
                return (
                  <Card
                    key={product.id}
                    className="shadow-none overflow-hidden cursor-pointer transition hover:ring-2 hover:ring-zinc-200"
                    onClick={() => router.push(`/creator/products/browse/${product.id}`)}
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-zinc-50">
                      {image ? (
                        <img src={image} alt={title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="size-10 text-zinc-300" />
                        </div>
                      )}
                    </div>
                    <CardContent className="space-y-3 py-3">
                      <div className="space-y-0.5">
                        <p className="line-clamp-1 text-sm font-medium">{title}</p>
                        {category && <p className="text-[11px] text-muted-foreground">{category}</p>}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold tabular-nums text-zinc-700">
                          {t('browseCatalog.basePrice', { price: fmt(product.base_price) })}
                        </span>
                        <Button
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/creator/custom-products/new?product_id=${product.id}`);
                          }}
                        >
                          <ShoppingBag className="w-3 h-3 me-1" />
                          {t('browseCatalog.addToStore')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                {t('browseCatalog.pageInfo', { page: meta.page, totalPages: meta.totalPages, total: meta.total })}
              </p>
              <div className="flex items-center gap-1">
                <Button size="icon-sm" variant="outline" onClick={() => setPage((p) => p - 1)} disabled={page <= 1 || loading}>
                  <ChevronLeft className="size-3.5 rtl:rotate-180" />
                </Button>
                <Button size="icon-sm" variant="outline" onClick={() => setPage((p) => p + 1)} disabled={!meta || page >= meta.totalPages || loading}>
                  <ChevronRight className="size-3.5 rtl:rotate-180" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
