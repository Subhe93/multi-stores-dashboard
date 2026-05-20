'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Trash2,
  Loader2,
  Languages,
  Check,
  Image as ImageIcon,
  FolderTree,
  Tag,
  Package,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useImageUpload } from '@/lib/useImageUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { TagInput } from '@/components/common/TagInput';
import {
  ProductMultiSelect,
  type ProductOption,
} from '@/components/creator/bundles/ProductMultiSelect';

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
).replace('/api', '');
const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003';

const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
  tr: 'Türkçe',
  de: 'Deutsch',
  fr: 'Français',
};
const RTL_LOCALES = ['ar'];

// ── Types ─────────────────────────────────────────────────────────────────────

type MatchRule = 'MANUAL' | 'TAGS';

interface CategoryTranslation {
  locale: string;
  name: string;
  description?: string;
}

interface CategoryNode {
  id: string;
  slug: string;
  parent_id?: string | null;
  translations?: CategoryTranslation[];
  children?: CategoryNode[];
}

interface CategoryDetail {
  id: string;
  slug: string;
  parent_id?: string | null;
  thumbnail_url?: string | null;
  match_rule: MatchRule;
  match_tags: string[];
  is_active: boolean;
  sort_order: number;
  translations: CategoryTranslation[];
  products?: { product: { id: string } }[];
  custom_products?: { custom_product: { id: string } }[];
}

interface ResolvedProduct {
  id: string;
  translations?: { locale: string; title: string }[];
  images?: { url: string }[];
  base_price?: number | string;
}

interface OverviewResp {
  primary_locale: string;
  secondary_locales: string[];
}

interface MyStore {
  slug?: string;
}

interface OwnProduct {
  id: string;
  base_price?: number | string;
  translations?: { locale: string; title: string }[];
  images?: { url: string; is_featured?: boolean }[];
}

interface CustomProductRow {
  id: string;
  final_price?: number | string;
  pricing_type?: 'SINGLE' | 'PER_VARIANT' | 'MARGIN';
  margin_amount?: number | string | null;
  translations?: { locale: string; title: string }[];
  mockup_images?: { url: string }[];
  selected_variants?: { custom_price?: number | string | null }[];
  product?: {
    base_price?: number | string;
    translations?: { locale: string; title: string }[];
    images?: { url: string }[];
  };
}

interface CategoryFormProps {
  mode: 'create' | 'edit';
  initialId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

function getDisplayName(node: CategoryNode | CategoryDetail): string {
  const en = node.translations?.find((t) => t.locale === 'en')?.name;
  if (en) return en;
  const first = node.translations?.[0]?.name;
  return first || node.slug;
}

interface ParentOption {
  value: string;
  label: string;
}

function flattenForParent(
  nodes: CategoryNode[],
  excludeId: string | undefined,
  prefix = '',
): ParentOption[] {
  const out: ParentOption[] = [];
  for (const n of nodes) {
    if (n.id === excludeId) continue; // Skip self and entire subtree below it.
    const name = getDisplayName(n);
    const label = prefix ? `${prefix} / ${name}` : name;
    out.push({ value: n.id, label });
    if (n.children?.length) {
      out.push(...flattenForParent(n.children, excludeId, label));
    }
  }
  return out;
}

function resolveUrl(url: string): string {
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CategoryForm({ mode, initialId }: CategoryFormProps) {
  const router = useRouter();
  const { token, user } = useAuth();
  const { pickAndUpload, uploading: imageUploading } = useImageUpload(token);

  // Locale state
  const [primaryLocale, setPrimaryLocale] = useState('en');
  const [allLocales, setAllLocales] = useState<string[]>(['en']);
  const [activeLocale, setActiveLocale] = useState('en');

  // Store slug (for the URL handle preview)
  const [storeSlug, setStoreSlug] = useState<string | null>(null);

  // Form fields
  const [translations, setTranslations] = useState<
    Record<string, { name: string; description: string }>
  >({ en: { name: '', description: '' } });
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [matchRule, setMatchRule] = useState<MatchRule>('MANUAL');
  const [matchTags, setMatchTags] = useState<string[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  // Reference data
  const [allCategories, setAllCategories] = useState<CategoryNode[]>([]);
  const [products, setProducts] = useState<OwnProduct[]>([]);
  const [customProducts, setCustomProducts] = useState<CustomProductRow[]>([]);

  // For edit mode: resolved product count (works for both MANUAL and TAGS)
  const [resolvedCount, setResolvedCount] = useState<number | null>(null);

  // UI state
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // ── Load locale config + store slug + parent options + own products ────────

  useEffect(() => {
    if (!token) return;
    api<OverviewResp>('/translations/overview', { token })
      .then((res) => {
        const primary = res?.primary_locale || 'en';
        const secondary = res?.secondary_locales || [];
        const all = [primary, ...secondary.filter((l) => l !== primary)];
        setPrimaryLocale(primary);
        setAllLocales(all);
        setActiveLocale((curr) => (all.includes(curr) ? curr : primary));
        setTranslations((prev) => {
          const next: Record<string, { name: string; description: string }> = {};
          all.forEach((l) => {
            next[l] = prev[l] ?? { name: '', description: '' };
          });
          return next;
        });
      })
      .catch(() => {});

    api<MyStore>('/stores/my/store', { token })
      .then((store) => setStoreSlug(store?.slug ?? null))
      .catch(() => setStoreSlug(null));

    api<CategoryNode[]>('/creator-categories', { token })
      .then((tree) => setAllCategories(Array.isArray(tree) ? tree : []))
      .catch(() => setAllCategories([]));
  }, [token]);

  // Fetch every product the creator can manually attach: their own products
  // and any provider products they've imported as custom products. Both lists
  // are merged into a single picker — the bundles form does the same thing.
  useEffect(() => {
    if (!token) return;
    const cid = user?.creator?.id;

    const fetchOwn = cid
      ? api<{ data: OwnProduct[] } | OwnProduct[]>(
          `/products?creator_id=${cid}&limit=200`,
          { token },
        ).catch(() => [] as OwnProduct[])
      : Promise.resolve([] as OwnProduct[]);

    const fetchCustom = api<
      { data: CustomProductRow[] } | CustomProductRow[]
    >('/custom-products?limit=200', { token }).catch(
      () => [] as CustomProductRow[],
    );

    Promise.all([fetchOwn, fetchCustom]).then(([ownRes, customRes]) => {
      const own = Array.isArray(ownRes) ? ownRes : ownRes?.data ?? [];
      const custom = Array.isArray(customRes)
        ? customRes
        : customRes?.data ?? [];
      setProducts(own);
      setCustomProducts(custom);
    });
  }, [token, user?.creator?.id]);

  // ── Edit mode: load the existing record ────────────────────────────────────

  useEffect(() => {
    if (mode !== 'edit' || !token || !initialId) return;
    setLoading(true);
    api<CategoryDetail>(`/creator-categories/${initialId}`, { token })
      .then((detail) => {
        setSlug(detail.slug);
        setSlugTouched(true);
        setParentId(detail.parent_id ?? null);
        setThumbnailUrl(detail.thumbnail_url ?? null);
        setMatchRule(detail.match_rule);
        setMatchTags(detail.match_tags ?? []);
        setIsActive(detail.is_active);
        setProductIds([
          ...(detail.products ?? []).map((p) => `p:${p.product.id}`),
          ...(detail.custom_products ?? []).map(
            (cp) => `cp:${cp.custom_product.id}`,
          ),
        ]);
        setTranslations((prev) => {
          const next: Record<string, { name: string; description: string }> = {
            ...prev,
          };
          for (const t of detail.translations || []) {
            next[t.locale] = {
              name: t.name || '',
              description: t.description || '',
            };
          }
          return next;
        });
      })
      .catch((err) => {
        setSubmitError(err?.message || 'Failed to load collection');
      })
      .finally(() => setLoading(false));

    // Resolved product count for both MANUAL and TAGS in edit mode.
    api<ResolvedProduct[]>(`/creator-categories/${initialId}/products`, { token })
      .then((list) => setResolvedCount(Array.isArray(list) ? list.length : 0))
      .catch(() => setResolvedCount(null));
  }, [mode, initialId, token]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const parentOptions = useMemo(
    () => flattenForParent(allCategories, mode === 'edit' ? initialId : undefined),
    [allCategories, mode, initialId],
  );

  const productOptions: ProductOption[] = useMemo(() => {
    const own: ProductOption[] = products.map((p) => {
      const t =
        p.translations?.find((tr) => tr.locale === primaryLocale) ||
        p.translations?.[0];
      const featured =
        p.images?.find((img) => img.is_featured)?.url ||
        p.images?.[0]?.url ||
        null;
      return {
        id: `p:${p.id}`,
        name: `${t?.title || 'Untitled product'} · own`,
        thumbnail: featured ? resolveUrl(featured) : null,
        unitPrice: Number(p.base_price ?? 0),
        pricingType: 'SINGLE',
      };
    });
    const custom: ProductOption[] = customProducts.map((cp) => {
      const t =
        cp.translations?.find((tr) => tr.locale === primaryLocale) ||
        cp.translations?.[0] ||
        cp.product?.translations?.find((tr) => tr.locale === primaryLocale) ||
        cp.product?.translations?.[0];
      const thumb =
        cp.mockup_images?.[0]?.url || cp.product?.images?.[0]?.url || null;
      return {
        id: `cp:${cp.id}`,
        name: `${t?.title || 'Untitled product'} · custom`,
        thumbnail: thumb ? resolveUrl(thumb) : null,
        unitPrice: Number(cp.final_price ?? cp.product?.base_price ?? 0),
        pricingType: cp.pricing_type ?? 'SINGLE',
      };
    });
    return [...own, ...custom];
  }, [products, customProducts, primaryLocale]);

  const primaryName = translations[primaryLocale]?.name || '';
  const hasMultipleLocales = allLocales.length > 1;
  const isRtl = RTL_LOCALES.includes(activeLocale);

  // Auto-derive slug from the primary-locale name until the user edits it.
  useEffect(() => {
    if (slugTouched) return;
    if (!primaryName) return;
    setSlug(slugify(primaryName));
  }, [primaryName, slugTouched]);

  // ── Validation ─────────────────────────────────────────────────────────────

  const nameError = useMemo(() => {
    const hasAny = Object.values(translations).some((t) => t.name.trim());
    return hasAny ? '' : 'Name is required for at least one language.';
  }, [translations]);

  const slugError = useMemo(() => {
    if (!slug.trim()) return 'URL handle is required.';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return 'Use lowercase letters, numbers and dashes only.';
    }
    return '';
  }, [slug]);

  const canSave = !nameError && !slugError;

  // ── Live summary count ─────────────────────────────────────────────────────

  const summaryCount: { value: number | null; note: string } = useMemo(() => {
    if (matchRule === 'MANUAL') {
      return { value: productIds.length, note: 'manually added' };
    }
    // TAGS: in edit mode show the resolved count, otherwise let the user know
    // it will be computed server-side after saving.
    if (mode === 'edit' && resolvedCount !== null) {
      return { value: resolvedCount, note: 'matched by tags' };
    }
    return {
      value: null,
      note: 'Saving will compute matching products.',
    };
  }, [matchRule, productIds.length, mode, resolvedCount]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const setTransField = (
    locale: string,
    field: 'name' | 'description',
    value: string,
  ) => {
    setTranslations((prev) => ({
      ...prev,
      [locale]: {
        ...(prev[locale] ?? { name: '', description: '' }),
        [field]: value,
      },
    }));
  };

  const handleUploadThumbnail = async () => {
    const imgs = await pickAndUpload('creator-categories');
    if (imgs.length) setThumbnailUrl(imgs[0]!.url);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !token) return;
    // useImageUpload only exposes pickAndUpload+upload — use upload directly.
    // Inline upload for dropped file via the same hook upload function:
    const { url } = await (async () => {
      // Re-use the file picker upload path by creating a hidden form-data POST.
      const formData = new FormData();
      formData.append('file', file);
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const res = await fetch(`${API_URL}/uploads?folder=creator-categories`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json();
      const u = json?.data?.url || '';
      return {
        url: u.startsWith('http')
          ? u
          : `${API_URL.replace('/api', '')}${u}`,
      };
    })();
    if (url) setThumbnailUrl(url);
  };

  const handleSubmit = async () => {
    if (!token || !canSave) return;
    setSaving(true);
    setSubmitError('');
    try {
      const translationsPayload = Object.entries(translations)
        .filter(([, t]) => t.name.trim())
        .map(([locale, t]) => ({
          locale,
          name: t.name.trim(),
          description: t.description?.trim() || undefined,
        }));

      // The picker uses prefixed IDs to distinguish own products (`p:`) from
      // custom products (`cp:`) since they're stored in different tables on
      // the backend.
      const ownIds: string[] = [];
      const customIds: string[] = [];
      if (matchRule === 'MANUAL') {
        for (const id of productIds) {
          if (id.startsWith('cp:')) customIds.push(id.slice(3));
          else if (id.startsWith('p:')) ownIds.push(id.slice(2));
        }
      }

      const basePayload = {
        slug: slug.trim(),
        parent_id: parentId || null,
        thumbnail_url: thumbnailUrl || null,
        match_rule: matchRule,
        match_tags: matchRule === 'TAGS' ? matchTags : [],
        is_active: isActive,
        translations: translationsPayload,
        product_ids: ownIds,
        custom_product_ids: customIds,
      };

      if (mode === 'create') {
        await api('/creator-categories', {
          method: 'POST',
          token,
          body: JSON.stringify(basePayload),
        });
      } else if (initialId) {
        await api(`/creator-categories/${initialId}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(basePayload),
        });
      }

      router.push('/creator/categories');
    } catch (err: any) {
      setSubmitError(
        Array.isArray(err?.errors)
          ? err.errors.join(' • ')
          : err?.message || 'Failed to save collection.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Loading screen for edit mode ───────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const slugPreviewHost = storeSlug
    ? `${storeSlug}.${new URL(WEB_ORIGIN).host}`
    : 'your-store';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header — sticky inside the page */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-zinc-50/95 backdrop-blur border-b">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {mode === 'create' ? 'New Collection' : 'Edit Collection'}
            </h1>
            <p className="text-xs text-muted-foreground">
              Group products into a shoppable collection for your storefront.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/creator/categories')}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={saving || !canSave}
            >
              {saving ? (
                <>
                  <Loader2 className="size-3.5 mr-1 animate-spin" />
                  Saving…
                </>
              ) : mode === 'create' ? (
                'Create Collection'
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Body — responsive 3-column grid: main (2/3) + summary (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main column ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Locale tabs */}
          {hasMultipleLocales && (
            <div className="flex items-center gap-0 border-b">
              {allLocales.map((locale) => {
                const isDone = !!translations[locale]?.name?.trim();
                const isActive = locale === activeLocale;
                return (
                  <button
                    key={locale}
                    type="button"
                    onClick={() => setActiveLocale(locale)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition -mb-px ${
                      isActive
                        ? 'border-zinc-900 text-zinc-900'
                        : 'border-transparent text-zinc-400 hover:text-zinc-600'
                    }`}
                  >
                    {LOCALE_LABELS[locale] || locale.toUpperCase()}
                    {locale !== primaryLocale && isDone && (
                      <Check className="w-3 h-3 text-emerald-500" />
                    )}
                    {locale === primaryLocale && (
                      <span className="text-[9px] text-zinc-400">(primary)</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <Card className="shadow-none">
            <CardContent className="space-y-4 pt-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Name{' '}
                  {activeLocale === primaryLocale && (
                    <span className="text-red-500">*</span>
                  )}
                </Label>
                <Input
                  dir={isRtl ? 'rtl' : 'ltr'}
                  className="h-9 text-sm"
                  placeholder={
                    activeLocale === primaryLocale
                      ? 'e.g. Summer Essentials'
                      : `Name in ${LOCALE_LABELS[activeLocale] || activeLocale}…`
                  }
                  value={translations[activeLocale]?.name || ''}
                  onChange={(e) =>
                    setTransField(activeLocale, 'name', e.target.value)
                  }
                />
                {activeLocale === primaryLocale && nameError && (
                  <p className="text-[11px] text-red-500">{nameError}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Description</Label>
                <RichTextEditor
                  content={translations[activeLocale]?.description || ''}
                  onChange={(val) =>
                    setTransField(activeLocale, 'description', val)
                  }
                  placeholder="Describe this collection…"
                />
              </div>
            </CardContent>
          </Card>

          {/* Thumbnail */}
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Thumbnail</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {thumbnailUrl ? (
                <div className="flex items-start gap-3">
                  <div className="relative h-32 w-32 overflow-hidden rounded-lg border bg-zinc-50">
                    <img
                      src={resolveUrl(thumbnailUrl)}
                      alt="Thumbnail"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleUploadThumbnail}
                      disabled={imageUploading}
                    >
                      {imageUploading ? (
                        <Loader2 className="size-3.5 mr-1 animate-spin" />
                      ) : (
                        <Upload className="size-3.5 mr-1" />
                      )}
                      Replace
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setThumbnailUrl(null)}
                    >
                      <Trash2 className="size-3.5 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={handleUploadThumbnail}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition ${
                    dragOver
                      ? 'border-zinc-900 bg-zinc-50'
                      : 'border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50/60'
                  }`}
                >
                  {imageUploading ? (
                    <Loader2 className="size-6 animate-spin text-zinc-400" />
                  ) : (
                    <ImageIcon className="size-6 text-zinc-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {imageUploading
                        ? 'Uploading…'
                        : 'Drop an image or click to upload'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Used as the collection cover image on your storefront.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* URL handle */}
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">URL handle</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1.5">
              <div className="flex items-stretch overflow-hidden rounded-md border focus-within:ring-2 focus-within:ring-ring">
                <span className="px-2 inline-flex items-center text-[11px] text-muted-foreground bg-zinc-50 border-r whitespace-nowrap">
                  https://{slugPreviewHost}/collections/
                </span>
                <input
                  className="flex-1 min-w-0 px-2 py-1.5 text-sm bg-transparent outline-none font-mono"
                  value={slug}
                  onChange={(e) => {
                    setSlug(slugify(e.target.value));
                    setSlugTouched(true);
                  }}
                  placeholder="summer-essentials"
                />
              </div>
              {slugError && (
                <p className="text-[11px] text-red-500">{slugError}</p>
              )}
            </CardContent>
          </Card>

          {/* Parent collection */}
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Parent collection
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <SearchableSelect
                    options={parentOptions}
                    value={parentId ?? ''}
                    onChange={(v) => setParentId(v || null)}
                    placeholder="None (top-level)"
                    searchPlaceholder="Search collections…"
                  />
                </div>
                {parentId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setParentId(null)}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Optional. Nest this collection inside another.
              </p>
            </CardContent>
          </Card>

          {/* Filter section */}
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Filter</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {/* Radio: TAGS */}
              <label
                className={`flex items-start gap-2 rounded-md border p-3 cursor-pointer transition ${
                  matchRule === 'TAGS'
                    ? 'border-zinc-900 bg-zinc-50/60'
                    : 'border-zinc-200 hover:bg-zinc-50/40'
                }`}
              >
                <input
                  type="radio"
                  name="match_rule"
                  className="mt-0.5"
                  checked={matchRule === 'TAGS'}
                  onChange={() => setMatchRule('TAGS')}
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Tag className="size-3.5 text-zinc-500" />
                    <span className="text-sm font-medium">
                      Include products with specific tags
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Any of your products tagged with one of these tags will
                    automatically appear in this collection.
                  </p>
                  {matchRule === 'TAGS' && (
                    <TagInput
                      tags={matchTags}
                      onChange={setMatchTags}
                      placeholder="Add a tag and press Enter"
                    />
                  )}
                </div>
              </label>

              {/* Radio: MANUAL */}
              <label
                className={`flex items-start gap-2 rounded-md border p-3 cursor-pointer transition ${
                  matchRule === 'MANUAL'
                    ? 'border-zinc-900 bg-zinc-50/60'
                    : 'border-zinc-200 hover:bg-zinc-50/40'
                }`}
              >
                <input
                  type="radio"
                  name="match_rule"
                  className="mt-0.5"
                  checked={matchRule === 'MANUAL'}
                  onChange={() => setMatchRule('MANUAL')}
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Package className="size-3.5 text-zinc-500" />
                    <span className="text-sm font-medium">
                      Manually add products
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Pick exactly which products belong in this collection.
                  </p>
                  {matchRule === 'MANUAL' && (
                    <ProductMultiSelect
                      options={productOptions}
                      value={productIds}
                      onChange={setProductIds}
                      placeholder="Search and pick products…"
                    />
                  )}
                </div>
              </label>
            </CardContent>
          </Card>
        </div>

        {/* ── Summary side panel ───────────────────────────────────────────── */}
        <aside className="lg:col-span-1 space-y-4">
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <FolderTree className="size-3.5" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3 text-xs">
              <div>
                <p className="text-muted-foreground">Match rule</p>
                <Badge
                  variant="outline"
                  className={
                    matchRule === 'MANUAL'
                      ? 'bg-zinc-100 text-zinc-700 border-zinc-200 mt-1'
                      : 'bg-blue-50 text-blue-700 border-blue-200 mt-1'
                  }
                >
                  {matchRule === 'MANUAL' ? 'Manual' : 'By tags'}
                </Badge>
              </div>

              <div>
                <p className="text-muted-foreground">Products in this collection</p>
                {summaryCount.value !== null ? (
                  <p className="text-base font-semibold mt-0.5">
                    {summaryCount.value}{' '}
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {summaryCount.note}
                    </span>
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {summaryCount.note}
                  </p>
                )}
              </div>

              <div>
                <p className="text-muted-foreground">Status</p>
                <label className="mt-1 inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <span className="text-sm">
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Auto-translate hint when on a non-primary locale */}
          {hasMultipleLocales && activeLocale !== primaryLocale && (
            <div className="rounded-lg border border-dashed bg-zinc-50/60 p-3 text-[11px] text-muted-foreground">
              <Languages className="inline size-3 mr-1" />
              Fill in the name in{' '}
              <strong>{LOCALE_LABELS[activeLocale] || activeLocale}</strong>{' '}
              to translate this collection for that audience.
            </div>
          )}
        </aside>
      </div>

      {/* Submission error */}
      {submitError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <p className="font-medium mb-1">We couldn't save the collection:</p>
          {submitError.includes(' • ') ? (
            <ul className="list-disc pl-5 space-y-0.5">
              {submitError.split(' • ').map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          ) : (
            <p>{submitError}</p>
          )}
        </div>
      )}
    </div>
  );
}
