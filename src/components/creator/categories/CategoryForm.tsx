'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Upload,
  Trash2,
  Loader2,
  Languages,
  Image as ImageIcon,
  FolderTree,
  Tag,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { useImageUpload } from '@/lib/useImageUpload';
import { collectionPathFromTree } from '@/lib/collection-url';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { LocaleTabs, filledLocales, useTranslationPlaceholder } from '@/components/common/LocaleTabs';
import {
  ParentCollectionPicker,
  MAX_CATEGORY_DEPTH,
} from '@/components/creator/categories/ParentCollectionPicker';
import { TagInput } from '@/components/common/TagInput';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { Textarea } from '@/components/ui/textarea';
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
  sv: 'Svenska',
};
const RTL_LOCALES = ['ar'];

// ── Types ─────────────────────────────────────────────────────────────────────

type MatchRule = 'MANUAL' | 'TAGS';

// M6.3: PUBLIC has a storefront page; INTERNAL is a flat label for builder
// pages only (no parent, no children, never a product's primary collection).
type Visibility = 'PUBLIC' | 'INTERNAL';
const VISIBILITY_OPTIONS: Visibility[] = ['PUBLIC', 'INTERNAL'];

interface CategoryTranslation {
  locale: string;
  name: string;
  description?: string;
  // Long SEO text shown below the products (M6.2, HTML); absent on older API builds.
  long_description?: string | null;
  // SEO overrides (M4.4); absent on older API builds.
  meta_title?: string | null;
  meta_desc?: string | null;
}

// Per-locale form state. `meta_title`/`meta_desc` stay undefined until loaded
// or edited: the API keeps the stored value of a locale that omits them (X19).
// `long_description` is always sent (empty clears it), like `description`.
interface LocaleFields {
  name: string;
  description: string;
  long_description: string;
  meta_title?: string;
  meta_desc?: string;
}

/** Search-result lengths the counters warn about. */
const META_TITLE_MAX = 60;
const META_DESC_MAX = 160;

interface CategoryNode {
  id: string;
  slug: string;
  parent_id?: string | null;
  // Absent on older API payloads = PUBLIC.
  visibility?: Visibility;
  translations?: CategoryTranslation[];
  children?: CategoryNode[];
}

interface CategoryDetail {
  id: string;
  slug: string;
  parent_id?: string | null;
  visibility?: Visibility;
  children?: { id: string }[];
  thumbnail_url?: string | null;
  match_rule: MatchRule;
  match_tags: string[];
  is_active: boolean;
  noindex_when_empty?: boolean;
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
  /** Create mode: parent pre-selected from the list page's "Add sub-collection". */
  initialParentId?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Keeps underscores and non-ASCII lowercase letters so an imported WordPress
// handle (e.g. `3d_presenter`, `kläder`) survives an edit of the field.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{Ll}\p{N}_-]/gu, '')
    .replace(/-+/g, '-');
}

function findNode(nodes: CategoryNode[], id: string): CategoryNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = n.children?.length ? findNode(n.children, id) : undefined;
    if (hit) return hit;
  }
  return undefined;
}

/** Height of the subtree below a node: 0 for a leaf, 1 with children, 2 with grandchildren. */
function subtreeHeight(node: CategoryNode): number {
  if (!node.children?.length) return 0;
  return 1 + Math.max(...node.children.map(subtreeHeight));
}

function resolveUrl(url: string): string {
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

// Tiptap returns `<p></p>` for a cleared editor; send '' so the API clears the
// stored text (undefined would keep it), and the storefront renders nothing.
function htmlOrEmpty(html: string | undefined): string {
  const trimmed = html?.trim() || '';
  const plain = trimmed.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return plain ? trimmed : '';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CategoryForm({ mode, initialId, initialParentId = null }: CategoryFormProps) {
  const t = useTranslations();
  const translationPlaceholder = useTranslationPlaceholder();
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
  const [translations, setTranslations] = useState<Record<string, LocaleFields>>({
    en: { name: '', description: '', long_description: '' },
  });
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [parentId, setParentId] = useState<string | null>(mode === 'create' ? initialParentId : null);
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC');
  // Children from the detail payload (null until loaded / on older API builds);
  // the tree the parent picker loads is the fallback.
  const [detailHasChildren, setDetailHasChildren] = useState<boolean | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [matchRule, setMatchRule] = useState<MatchRule>('MANUAL');
  const [matchTags, setMatchTags] = useState<string[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  // undefined = not loaded (older API): the field is then left out of the save.
  const [noindexWhenEmpty, setNoindexWhenEmpty] = useState<boolean | undefined>(
    mode === 'create' ? false : undefined,
  );

  // Reference data
  const [allCategories, setAllCategories] = useState<CategoryNode[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
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
          const next: Record<string, LocaleFields> = {};
          all.forEach((l) => {
            next[l] = prev[l] ?? { name: '', description: '', long_description: '' };
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
      .catch(() => setAllCategories([]))
      .finally(() => setCategoriesLoaded(true));
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
        setVisibility(detail.visibility === 'INTERNAL' ? 'INTERNAL' : 'PUBLIC');
        setDetailHasChildren(Array.isArray(detail.children) ? detail.children.length > 0 : null);
        setThumbnailUrl(detail.thumbnail_url ?? null);
        setMatchRule(detail.match_rule);
        setMatchTags(detail.match_tags ?? []);
        setIsActive(detail.is_active);
        if (typeof detail.noindex_when_empty === 'boolean') setNoindexWhenEmpty(detail.noindex_when_empty);
        setProductIds([
          ...(detail.products ?? []).map((p) => `p:${p.product.id}`),
          ...(detail.custom_products ?? []).map(
            (cp) => `cp:${cp.custom_product.id}`,
          ),
        ]);
        setTranslations((prev) => {
          const next: Record<string, LocaleFields> = {
            ...prev,
          };
          for (const t of detail.translations || []) {
            next[t.locale] = {
              name: t.name || '',
              description: t.description || '',
              long_description: t.long_description || '',
              ...('meta_title' in t ? { meta_title: t.meta_title || '' } : {}),
              ...('meta_desc' in t ? { meta_desc: t.meta_desc || '' } : {}),
            };
          }
          return next;
        });
      })
      .catch((err) => {
        setSubmitError(err?.message || t('category.failedToLoad'));
      })
      .finally(() => setLoading(false));

    // Resolved product count for both MANUAL and TAGS in edit mode.
    api<ResolvedProduct[]>(`/creator-categories/${initialId}/products`, { token })
      .then((list) => setResolvedCount(Array.isArray(list) ? list.length : 0))
      .catch(() => setResolvedCount(null));
  }, [mode, initialId, token]);

  // ── Derived ────────────────────────────────────────────────────────────────

  // When the edited collection already has sub-collections, its subtree must
  // still fit under the new parent, so the allowed parent depth shrinks.
  const editedHeight = useMemo(() => {
    if (mode !== 'edit' || !initialId) return 0;
    const node = findNode(allCategories, initialId);
    return node ? subtreeHeight(node) : 0;
  }, [allCategories, mode, initialId]);
  const maxParentDepth = MAX_CATEGORY_DEPTH - 1 - editedHeight;

  const isInternal = visibility === 'INTERNAL';
  // INTERNAL is flat: a collection that already has sub-collections cannot
  // become one (the API answers CREATOR_CATEGORY_INTERNAL_HAS_CHILDREN).
  const hasChildren = detailHasChildren === true || editedHeight > 0;
  const internalDisabledReason =
    mode === 'edit' && !isInternal && hasChildren ? t('category.internalHasChildren') : undefined;

  // A `?parent=` id that is not in the tree (deleted, or from another store)
  // is dropped once the tree is known, so the form does not submit it blindly.
  // A parent that exists but breaks the depth rule stays selected: the picker
  // shows why, and the user can move the collection.
  useEffect(() => {
    if (mode !== 'create' || !categoriesLoaded || !parentId) return;
    if (!findNode(allCategories, parentId)) setParentId(null);
  }, [mode, categoriesLoaded, allCategories, parentId]);

  // M6.7: the canonical storefront URL carries the ancestor slugs. The parent's
  // path comes from the tree the picker loads; the own slug is the live input.
  const storefrontPath = useMemo(() => {
    const ancestors = parentId ? collectionPathFromTree(allCategories, parentId) : [];
    return `/collections/${[...ancestors, slug.trim() || '…'].join('/')}`;
  }, [allCategories, parentId, slug]);

  const productOptions: ProductOption[] = useMemo(() => {
    const own: ProductOption[] = products.map((p) => {
      const trans =
        p.translations?.find((tr) => tr.locale === primaryLocale) ||
        p.translations?.[0];
      const featured =
        p.images?.find((img) => img.is_featured)?.url ||
        p.images?.[0]?.url ||
        null;
      return {
        id: `p:${p.id}`,
        name: `${trans?.title || t('bundle.untitledProduct')} · ${t('bundle.ownSuffix')}`,
        thumbnail: featured ? resolveUrl(featured) : null,
        unitPrice: Number(p.base_price ?? 0),
        pricingType: 'SINGLE',
      };
    });
    const custom: ProductOption[] = customProducts.map((cp) => {
      const trans =
        cp.translations?.find((tr) => tr.locale === primaryLocale) ||
        cp.translations?.[0] ||
        cp.product?.translations?.find((tr) => tr.locale === primaryLocale) ||
        cp.product?.translations?.[0];
      const thumb =
        cp.mockup_images?.[0]?.url || cp.product?.images?.[0]?.url || null;
      return {
        id: `cp:${cp.id}`,
        name: `${trans?.title || t('bundle.untitledProduct')} · ${t('bundle.customSuffix')}`,
        thumbnail: thumb ? resolveUrl(thumb) : null,
        unitPrice: Number(cp.final_price ?? cp.product?.base_price ?? 0),
        pricingType: cp.pricing_type ?? 'SINGLE',
      };
    });
    return [...own, ...custom];
  }, [products, customProducts, primaryLocale, t]);

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
    const hasAny = Object.values(translations).some((tr) => tr.name.trim());
    return hasAny ? '' : t('category.errNameRequired');
  }, [translations, t]);

  const slugError = useMemo(() => {
    if (!slug.trim()) return t('category.errHandleRequired');
    // Imported collections keep their WordPress handles (underscores, non-ASCII
    // letters such as å/ä/ö), which the API and the storefront route accept;
    // the form must not block saving them. Lowercase letters or digits in any
    // script, separated by single hyphens or underscores.
    if (!/^[\p{Ll}\p{N}]+(?:[-_][\p{Ll}\p{N}]+)*$/u.test(slug)) {
      return t('category.errHandleFormat');
    }
    return '';
  }, [slug, t]);

  const canSave = !nameError && !slugError;

  // ── Live summary count ─────────────────────────────────────────────────────

  const summaryCount: { value: number | null; note: string } = useMemo(() => {
    if (matchRule === 'MANUAL') {
      return { value: productIds.length, note: t('category.noteManuallyAdded') };
    }
    // TAGS: in edit mode show the resolved count, otherwise let the user know
    // it will be computed server-side after saving.
    if (mode === 'edit' && resolvedCount !== null) {
      return { value: resolvedCount, note: t('category.noteMatchedByTags') };
    }
    return {
      value: null,
      note: t('category.noteWillCompute'),
    };
  }, [matchRule, productIds.length, mode, resolvedCount, t]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const setTransField = (
    locale: string,
    field: keyof LocaleFields,
    value: string,
  ) => {
    setTranslations((prev) => ({
      ...prev,
      [locale]: {
        ...(prev[locale] ?? { name: '', description: '', long_description: '' }),
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
          description: htmlOrEmpty(t.description),
          long_description: htmlOrEmpty(t.long_description),
          // Only when loaded or edited, so an untouched locale keeps its stored SEO.
          // An internal label has no page, so its hidden SEO fields are left as stored.
          ...(!isInternal && t.meta_title !== undefined ? { meta_title: t.meta_title.trim() } : {}),
          ...(!isInternal && t.meta_desc !== undefined ? { meta_desc: t.meta_desc.trim() } : {}),
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
        visibility,
        // An internal label is always top level (CREATOR_CATEGORY_INTERNAL_NO_PARENT otherwise).
        parent_id: isInternal ? null : parentId || null,
        thumbnail_url: thumbnailUrl || null,
        match_rule: matchRule,
        match_tags: matchRule === 'TAGS' ? matchTags : [],
        is_active: isActive,
        ...(!isInternal && noindexWhenEmpty !== undefined ? { noindex_when_empty: noindexWhenEmpty } : {}),
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
    } catch (err) {
      // Coded API errors (e.g. CREATOR_CATEGORY_MAX_DEPTH) get a friendly
      // translated message; validation lists and raw messages are the fallback.
      const code = err instanceof ApiError ? err.code : undefined;
      setSubmitError(
        code && t.has(`errors.${code}`)
          ? t(`errors.${code}`)
          : err instanceof ApiError && Array.isArray(err.errors)
            ? err.errors.join(' • ')
            : (err instanceof Error && err.message) || t('category.failedToSave'),
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
      <div className="sticky top-14 z-10 -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 bg-zinc-50/95 backdrop-blur border-b">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {mode === 'create' ? t('category.newCollection') : t('category.editCollection')}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t('category.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/creator/categories')}
              disabled={saving}
            >
              {t('common.cancel')}
            </Button>
            {!canSave && !saving && (
              <span className="text-[11px] text-red-600" role="status">
                {nameError || slugError}
              </span>
            )}
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={saving || !canSave}
            >
              {saving ? (
                <>
                  <Loader2 className="size-3.5 mr-1 animate-spin" />
                  {t('category.saving')}
                </>
              ) : mode === 'create' ? (
                t('category.createCollection')
              ) : (
                t('category.saveChanges')
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
            <LocaleTabs
              value={activeLocale}
              onChange={setActiveLocale}
              locales={allLocales}
              primaryLocale={primaryLocale}
              filled={filledLocales(allLocales, translations, (tr) => !!tr?.name?.trim())}
            />
          )}

          <Card className="shadow-none">
            <CardContent className="space-y-4 pt-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {t('common.name')}{' '}
                  {activeLocale === primaryLocale && (
                    <span className="text-red-500">*</span>
                  )}
                </Label>
                <Input
                  dir={isRtl ? 'rtl' : 'ltr'}
                  className="h-9 text-sm"
                  placeholder={translationPlaceholder({
                    locale: activeLocale,
                    primaryLocale,
                    baseValue: translations[primaryLocale]?.name,
                    primaryPlaceholder: t('category.namePlaceholder'),
                  })}
                  value={translations[activeLocale]?.name || ''}
                  onChange={(e) =>
                    setTransField(activeLocale, 'name', e.target.value)
                  }
                />
                {activeLocale === primaryLocale && nameError && (
                  <p className="text-[11px] text-red-500">{nameError}</p>
                )}
              </div>

              {/* Short description — hero text under the title (M6.2) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('category.shortDescription')}</Label>
                <RichTextEditor
                  content={translations[activeLocale]?.description || ''}
                  onChange={(val) =>
                    setTransField(activeLocale, 'description', val)
                  }
                  placeholder={translationPlaceholder({
                    locale: activeLocale,
                    primaryLocale,
                    baseValue: translations[primaryLocale]?.description,
                    primaryPlaceholder: t('category.describePlaceholder'),
                  })}
                />
                <p className="text-[11px] text-muted-foreground">
                  {t('category.shortDescriptionHint')}
                </p>
              </div>

              {/* Long description — SEO prose rendered below the products (M6.2) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('category.longDescription')}</Label>
                <RichTextEditor
                  content={translations[activeLocale]?.long_description || ''}
                  onChange={(val) =>
                    setTransField(activeLocale, 'long_description', val)
                  }
                  dir={isRtl ? 'rtl' : 'ltr'}
                  placeholder={translationPlaceholder({
                    locale: activeLocale,
                    primaryLocale,
                    baseValue: translations[primaryLocale]?.long_description,
                    primaryPlaceholder: t('category.longDescribePlaceholder'),
                  })}
                />
                <p className="text-[11px] text-muted-foreground">
                  {t('category.longDescriptionHint')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Type (M6.3): storefront collection vs internal label */}
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t('category.type')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {VISIBILITY_OPTIONS.map((option) => {
                const selected = visibility === option;
                const reason = option === 'INTERNAL' ? internalDisabledReason : undefined;
                const disabled = !!reason;
                return (
                  <label
                    key={option}
                    title={reason}
                    className={`flex items-start gap-2 rounded-md border p-3 transition ${
                      disabled
                        ? 'cursor-not-allowed border-zinc-200 bg-zinc-50/40 opacity-60'
                        : selected
                          ? 'cursor-pointer border-zinc-900 bg-zinc-50/60'
                          : 'cursor-pointer border-zinc-200 hover:bg-zinc-50/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="collection-visibility"
                      className="mt-0.5"
                      checked={selected}
                      disabled={disabled}
                      onChange={() => setVisibility(option)}
                    />
                    <div className="space-y-0.5">
                      <span className="block text-xs font-medium">{t(`category.visibility.${option}`)}</span>
                      <p className="text-[10px] text-muted-foreground">{t(`category.visibilityHint.${option}`)}</p>
                      {reason && <p className="text-[10px] text-amber-700">{reason}</p>}
                    </div>
                  </label>
                );
              })}
              {isInternal && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{t('category.internalNote')}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Thumbnail */}
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t('category.thumbnail')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {thumbnailUrl ? (
                <div className="flex items-start gap-3">
                  <div className="relative h-32 w-32 overflow-hidden rounded-lg border bg-zinc-50">
                    <img
                      src={resolveUrl(thumbnailUrl)}
                      alt={t('category.thumbnail')}
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
                      {t('category.replace')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setThumbnailUrl(null)}
                    >
                      <Trash2 className="size-3.5 mr-1" />
                      {t('common.remove')}
                    </Button>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {t('category.thumbnailHint')}
                    </p>
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
                        ? t('category.uploading')
                        : t('category.dropOrClick')}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {t('category.thumbnailHint')}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* URL handle */}
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t('category.urlHandle')}</CardTitle>
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
              {/* M6.7: full storefront URL (ancestors from the selected parent). */}
              {isInternal ? (
                <p className="text-[11px] text-muted-foreground">{t('category.internalNote')}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground flex flex-wrap items-baseline gap-x-1.5">
                  <span>{t('category.storefrontUrl')}:</span>
                  <span className="font-mono text-foreground break-all" dir="ltr">{storefrontPath}</span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Search engine listing (M4.4): per-locale SEO overrides + noindex.
              Hidden for an internal label: it has no page to index. */}
          {!isInternal && (
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {t('creator.collections.form.seo')}
                {hasMultipleLocales && (
                  <span className="ms-1.5 text-[11px] font-normal text-muted-foreground">
                    ({LOCALE_LABELS[activeLocale] || activeLocale.toUpperCase()})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {/* Preview of the search result, falling back like the storefront does */}
              <div className="rounded-md border bg-zinc-50/60 px-3 py-2" dir={isRtl ? 'rtl' : 'ltr'}>
                <p className="truncate text-sm text-blue-700">
                  {translations[activeLocale]?.meta_title?.trim() ||
                    translations[activeLocale]?.name?.trim() ||
                    t('creator.collections.form.seoPreviewEmpty')}
                </p>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {translations[activeLocale]?.meta_desc?.trim() || t('creator.collections.form.seoDescFallback')}
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="collection-meta-title" className="text-xs font-medium">
                    {t('creator.collections.form.metaTitle')}
                  </Label>
                  <span
                    className={`text-[11px] tabular-nums ${
                      (translations[activeLocale]?.meta_title?.length ?? 0) > META_TITLE_MAX ? 'text-amber-600' : 'text-muted-foreground'
                    }`}
                  >
                    {translations[activeLocale]?.meta_title?.length ?? 0}/{META_TITLE_MAX}
                  </span>
                </div>
                <Input
                  id="collection-meta-title"
                  dir={isRtl ? 'rtl' : 'ltr'}
                  className="h-9 text-sm"
                  value={translations[activeLocale]?.meta_title ?? ''}
                  onChange={(e) => setTransField(activeLocale, 'meta_title', e.target.value)}
                  placeholder={translationPlaceholder({
                    locale: activeLocale,
                    primaryLocale,
                    baseValue: translations[primaryLocale]?.meta_title || translations[primaryLocale]?.name,
                    primaryPlaceholder: translations[activeLocale]?.name || '',
                  })}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="collection-meta-desc" className="text-xs font-medium">
                    {t('creator.collections.form.metaDesc')}
                  </Label>
                  <span
                    className={`text-[11px] tabular-nums ${
                      (translations[activeLocale]?.meta_desc?.length ?? 0) > META_DESC_MAX ? 'text-amber-600' : 'text-muted-foreground'
                    }`}
                  >
                    {translations[activeLocale]?.meta_desc?.length ?? 0}/{META_DESC_MAX}
                  </span>
                </div>
                <Textarea
                  id="collection-meta-desc"
                  dir={isRtl ? 'rtl' : 'ltr'}
                  rows={3}
                  className="text-sm"
                  value={translations[activeLocale]?.meta_desc ?? ''}
                  onChange={(e) => setTransField(activeLocale, 'meta_desc', e.target.value)}
                  placeholder={translationPlaceholder({
                    locale: activeLocale,
                    primaryLocale,
                    baseValue: translations[primaryLocale]?.meta_desc,
                  })}
                />
                <p className="text-[11px] text-muted-foreground">{t('creator.collections.form.metaHint')}</p>
              </div>
              <div className="flex items-start justify-between gap-3 border-t pt-3">
                <div>
                  <Label htmlFor="collection-noindex-empty" className="text-sm font-normal">
                    {t('creator.collections.form.noindexWhenEmpty')}
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    {t('creator.collections.form.noindexWhenEmptyHint')}
                  </p>
                </div>
                <ToggleSwitch
                  id="collection-noindex-empty"
                  checked={!!noindexWhenEmpty}
                  onChange={setNoindexWhenEmpty}
                  label={t('creator.collections.form.noindexWhenEmpty')}
                />
              </div>
            </CardContent>
          </Card>
          )}

          {/* Parent collection. Hidden for an internal label: it is always top level. */}
          {!isInternal && (
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {t('category.parentCollection')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <p className="text-[11px] text-muted-foreground">
                {t('category.parentHint')}
              </p>
              <ParentCollectionPicker
                tree={allCategories}
                loading={!categoriesLoaded}
                value={parentId}
                onChange={setParentId}
                excludeId={mode === 'edit' ? initialId : undefined}
                maxParentDepth={maxParentDepth}
                primaryLocale={primaryLocale}
                previewName={primaryName}
              />
              {editedHeight > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {t('category.parentDepthLimited')}
                </p>
              )}
            </CardContent>
          </Card>
          )}

          {/* Filter section */}
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t('category.filter')}</CardTitle>
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
                      {t('category.includeByTags')}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {t('category.includeByTagsHint')}
                  </p>
                  {matchRule === 'TAGS' && (
                    <TagInput
                      tags={matchTags}
                      onChange={setMatchTags}
                      placeholder={t('category.addTagPlaceholder')}
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
                      {t('category.manuallyAdd')}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {t('category.manuallyAddHint')}
                  </p>
                  {matchRule === 'MANUAL' && (
                    <ProductMultiSelect
                      options={productOptions}
                      value={productIds}
                      onChange={setProductIds}
                      placeholder={t('category.searchAndPickProducts')}
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
                {t('category.summary')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3 text-xs">
              <div>
                <p className="text-muted-foreground">{t('category.matchRule')}</p>
                <Badge
                  variant="outline"
                  className={
                    matchRule === 'MANUAL'
                      ? 'bg-zinc-100 text-zinc-700 border-zinc-200 mt-1'
                      : 'bg-blue-50 text-blue-700 border-blue-200 mt-1'
                  }
                >
                  {matchRule === 'MANUAL' ? t('category.manual') : t('category.byTags')}
                </Badge>
              </div>

              <div>
                <p className="text-muted-foreground">{t('category.type')}</p>
                <Badge
                  variant="outline"
                  className={
                    isInternal
                      ? 'bg-amber-50 text-amber-700 border-amber-200 mt-1'
                      : 'bg-zinc-100 text-zinc-700 border-zinc-200 mt-1'
                  }
                >
                  {t(`category.visibility.${visibility}`)}
                </Badge>
              </div>

              <div>
                <p className="text-muted-foreground">{t('category.productsInCollection')}</p>
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
                <p className="text-muted-foreground">{t('common.status')}</p>
                <label className="mt-1 inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <span className="text-sm">
                    {isActive ? t('category.active') : t('category.inactive')}
                  </span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Auto-translate hint when on a non-primary locale */}
          {hasMultipleLocales && activeLocale !== primaryLocale && (
            <div className="rounded-lg border border-dashed bg-zinc-50/60 p-3 text-[11px] text-muted-foreground">
              <Languages className="inline size-3 mr-1" />
              {t('category.fillNameIn')}{' '}
              <strong>{LOCALE_LABELS[activeLocale] || activeLocale}</strong>{' '}
              {t('category.toTranslate')}
            </div>
          )}
        </aside>
      </div>

      {/* Submission error */}
      {submitError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <p className="font-medium mb-1">{t('category.couldNotSave')}</p>
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
