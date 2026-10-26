'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, Languages, Check, Info } from 'lucide-react';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { VariantManager, type VariantOption, type GeneratedVariant } from './VariantManager';
import { CustomFieldManager, type CustomField } from './CustomFieldManager';
import FaqManager, { type Faq } from './FaqManager';
import { BundlePicker } from '@/components/creator/bundles/BundlePicker';
import { CollectionTreePicker } from '@/components/creator/categories/CollectionTreePicker';
import { useImageUpload } from '@/lib/useImageUpload';
import { ImageGallery } from './ImageGallery';
import { TagInput } from '@/components/common/TagInput';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';
import { flattenFieldTree, readConfigIssues, readErrorParamList } from '@/lib/personalization';
import { useConfigIssueText } from '@/components/apps/personalization/useConfigIssueText';
import Link from 'next/link';
import { useCurrency } from '@/lib/useCurrency';
import { localizedTaxText, type TaxClass } from '@/lib/taxRate';
import { isValidGtin } from '@/lib/gtin';

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────
const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
  tr: 'Türkçe',
  de: 'Deutsch',
  fr: 'Français',
  sv: 'Svenska',
};
const RTL_LOCALES = ['ar'];

/** Pick a translation row preferring the store primary locale, then English, then the first available */
interface TranslationRow { locale: string; name?: string; label?: string }
const pickTranslation = (translations: TranslationRow[] | undefined, primaryLocale: string): TranslationRow | undefined =>
  translations?.find(tr => tr.locale === primaryLocale) ||
  translations?.find(tr => tr.locale === 'en') ||
  translations?.[0];

// ─────────────────────────────────────────
// Local API shapes (only the fields this form reads)
// ─────────────────────────────────────────
interface SelectOption { value: string; label: string }

interface ShippingProfile { id: string; name: string; is_default: boolean }

interface StoreResponse {
  language_config?: { primary_locale?: string; secondary_locales?: string[] } | null;
}

interface CategoryNode {
  id: string;
  slug: string;
  translations?: TranslationRow[];
  children?: CategoryNode[];
}

interface CategoryAttribute {
  id: string;
  name: string;
  type: string;
  is_required?: boolean;
  unit?: string | null;
  options?: string[] | null;
  translations?: TranslationRow[];
}

/** Attribute value as edited in the form: checkbox → boolean, everything else → string */
type AttrValue = string | boolean | null | undefined;

interface ProductImage {
  id: string;
  url: string;
  alt_text?: string;
  is_featured?: boolean;
  variant_id?: string | null;
}

interface ProductTranslationRow {
  locale: string;
  title?: string | null;
  description?: string | null;
  // M4.4: null for products that never had one; absent on older API builds.
  short_description?: string | null;
  slug?: string | null;
  meta_title?: string | null;
  meta_desc?: string | null;
}

interface ProductVariantRow {
  id: string;
  options: Record<string, string>;
  price_adjustment?: number | string | null;
  compare_at_price?: number | string | null;
  sku?: string | null;
  stock_quantity: number | null;
  is_active: boolean;
  images?: { url: string }[];
}

interface ProductResponse {
  id: string;
  category_id?: string | null;
  product_type?: string | null;
  customization_type?: string | null;
  base_price?: number | string | null;
  compare_at_price?: number | string | null;
  cost_price?: number | string | null;
  sku?: string | null;
  track_inventory?: boolean | null;
  stock_quantity?: number | null;
  weight?: number | string | null;
  weight_unit?: string | null;
  tags?: { tag: string }[];
  status?: string | null;
  images?: ProductImage[];
  custom_fields?: CustomField[];
  faqs?: Faq[];
  bundles?: { bundle_id: string }[];
  creator_categories?: {
    creator_category_id?: string | null;
    creator_category?: { id?: string | null } | null;
  }[];
  /** The linked collection that drives the storefront breadcrumb / URL path. */
  primary_creator_category_id?: string | null;
  shipping_profile_id?: string | null;
  tax_class_id?: string | null;
  tax_exempt?: boolean | null;
  // Feed data (feeds app, M5.6).
  gtin?: string | null;
  mpn?: string | null;
  brand?: string | null;
  google_product_category?: string | null;
  condition?: string | null;
  feed_excluded?: boolean | null;
  translations?: ProductTranslationRow[];
  variants?: ProductVariantRow[];
  variant_option_config?: VariantOption[] | null;
  attributes?: { template_id: string; value: AttrValue }[];
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p data-field-error className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
      <span>⚠</span> {msg}
    </p>
  );
}

interface ProductFormProps {
  mode: 'create' | 'edit';
  productId?: string;
  backUrl: string;
  postCreateUrl?: string;
}

// Translation state per locale. Each locale has its own slug — secondary
// locales can have a custom URL slug, otherwise we derive one (see save logic).
// `short_description` stays undefined until it was loaded or edited: the API
// keeps the stored value of a locale whose payload omits it (M4.4 X19).
type LocaleTranslation = { title: string; description: string; slug: string; short_description?: string };

/** Tiptap leaves `<p></p>` behind when cleared; treat markup without text as empty. */
const isBlankHtml = (html: string) => !html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() && !/<img\b/i.test(html);

export function ProductForm({ mode, productId, backUrl, postCreateUrl }: ProductFormProps) {
  const t = useTranslations();
  const apiError = useApiError();
  const describeIssues = useConfigIssueText();
  const { currency } = useCurrency();
  const { token, user } = useAuth();
  const isCreator = user?.role === 'CREATOR';
  const router = useRouter();
  // Personalization app (M4.1): only for the creator's own products (D2).
  const { apps: storeApps } = useStoreApps();
  const personalizationOn = isCreator && isAppEnabled(storeApps, 'personalization');

  // ── UI state ──────────────────────────────────────────────
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  // Product option issues of a save (config errors, option still used by fields),
  // repeated next to the options card the form scrolls to.
  const [optionsError, setOptionsError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Language config ───────────────────────────────────────
  const [primaryLocale, setPrimaryLocale] = useState('en');
  const [allLocales, setAllLocales] = useState<string[]>(['en']);
  const [activeLocale, setActiveLocale] = useState('en');
  // translations[locale] = { title, description, slug }
  const [translations, setTranslations] = useState<Record<string, LocaleTranslation>>({
    en: { title: '', description: '', slug: '' },
  });
  const [translatingLocale, setTranslatingLocale] = useState('');
  // Locale the primary tab was seeded from when the store's language set no
  // longer covers the product's stored translations (see the seeding effect).
  const [seededFrom, setSeededFrom] = useState('');
  const seededRef = useRef(false);
  const [localeConfigLoaded, setLocaleConfigLoaded] = useState(false);

  // ── Other product fields ───────────────────────────────────
  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [categoryAttrs, setCategoryAttrs] = useState<CategoryAttribute[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [productType, setProductType] = useState('TRADITIONAL');
  const [customizationType, setCustomizationType] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [comparePrice, setComparePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sku, setSku] = useState('');
  const [trackInventory, setTrackInventory] = useState(false);
  const [stockQty, setStockQty] = useState('');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState('DRAFT');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [attrValues, setAttrValues] = useState<Record<string, AttrValue>>({});
  const [images, setImages] = useState<ProductImage[]>([]);
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([]);
  const [variants, setVariants] = useState<GeneratedVariant[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [bundleIds, setBundleIds] = useState<string[]>([]);
  const [creatorCategoryIds, setCreatorCategoryIds] = useState<string[]>([]);
  const [primaryCreatorCategoryId, setPrimaryCreatorCategoryId] = useState<string | null>(null);
  const [shippingProfiles, setShippingProfiles] = useState<ShippingProfile[]>([]);
  const [shippingProfileId, setShippingProfileId] = useState('');
  // Tax: platform + own-store classes; '' = the scope's default class.
  const [taxClasses, setTaxClasses] = useState<TaxClass[]>([]);
  const [taxClassId, setTaxClassId] = useState('');
  const [taxExempt, setTaxExempt] = useState(false);
  // Feed data (Google Merchant / Meta catalog): identifiers live on the
  // product whatever apps are on; the feeds app reads them.
  const [gtin, setGtin] = useState('');
  const [mpn, setMpn] = useState('');
  const [brand, setBrand] = useState('');
  const [googleProductCategory, setGoogleProductCategory] = useState('');
  const [condition, setCondition] = useState('new');
  const [feedExcluded, setFeedExcluded] = useState(false);

  const { pickAndUpload, uploading } = useImageUpload(token);
  const uiLocale = useLocale();

  // ── Helpers ───────────────────────────────────────────────
  const primaryTitle = translations[primaryLocale]?.title || '';

  const setTransField = (locale: string, field: keyof LocaleTranslation, value: string) => {
    setTranslations(prev => ({
      ...prev,
      [locale]: { ...prev[locale], [field]: value },
    }));
  };

  // ── Fetch store language config ────────────────────────────
  useEffect(() => {
    if (!token) return;
    api<StoreResponse>('/stores/my/store', { token })
      .then(store => {
        const primary: string = store.language_config?.primary_locale || 'en';
        const secondary: string[] = store.language_config?.secondary_locales || [];
        const all = [primary, ...secondary.filter((l: string) => l !== primary)];
        setPrimaryLocale(primary);
        setAllLocales(all);
        setActiveLocale(primary);
        // Initialise empty slots for every configured locale, KEEPING rows for
        // locales that are no longer configured (a store that switched its
        // content language). The API replaces all translations on save, so
        // dropping them from state here would silently delete them.
        setTranslations(prev => {
          const next: Record<string, LocaleTranslation> = { ...prev };
          all.forEach(l => { if (!next[l]) next[l] = { title: '', description: '', slug: '' }; });
          return next;
        });
        setLocaleConfigLoaded(true);
      })
      .catch(() => {}); // no store yet — keep defaults
  }, [token]);

  // ── Fetch shipping profiles ────────────────────────────────
  useEffect(() => {
    if (!token) return;
    api<ShippingProfile[]>('/shipping/profiles', { token })
      .then(profiles => setShippingProfiles(Array.isArray(profiles) ? profiles : []))
      .catch(() => {});
  }, [token]);

  // ── Fetch tax classes (platform + caller's store) ──────────
  useEffect(() => {
    if (!token) return;
    api<TaxClass[]>('/taxes/classes', { token })
      .then(classes => setTaxClasses(Array.isArray(classes) ? classes : []))
      .catch(() => {});
  }, [token]);

  // ── Fetch categories ──────────────────────────────────────
  useEffect(() => {
    api<CategoryNode[]>('/categories').then(cats => {
      const flat: SelectOption[] = [];
      const flatten = (items: CategoryNode[], prefix = '') => {
        for (const c of items) {
          const name = pickTranslation(c.translations, primaryLocale)?.name || c.slug;
          flat.push({ value: c.id, label: prefix + name });
          if (c.children) flatten(c.children, prefix + '— ');
        }
      };
      flatten(Array.isArray(cats) ? cats : []);
      setCategories(flat);
    });
  }, [primaryLocale]);

  // ── Fetch product data (edit mode) ────────────────────────
  useEffect(() => {
    if (mode !== 'edit' || !token || !productId) return;
    api<ProductResponse>(`/products/${productId}`, { token }).then(p => {
      const primaryT = p.translations?.find((t) => t.locale === primaryLocale) || p.translations?.[0];

      setCategoryId(p.category_id || '');
      setMetaTitle(primaryT?.meta_title || '');
      setMetaDesc(primaryT?.meta_desc || '');
      setProductType(p.product_type || 'TRADITIONAL');
      setCustomizationType(p.customization_type || '');
      setBasePrice(String(p.base_price || ''));
      setComparePrice(p.compare_at_price ? String(p.compare_at_price) : '');
      setCostPrice(p.cost_price ? String(p.cost_price) : '');
      setSku(p.sku || '');
      setTrackInventory(p.track_inventory || false);
      setStockQty(p.stock_quantity ? String(p.stock_quantity) : '');
      setWeight(p.weight ? String(p.weight) : '');
      setWeightUnit(p.weight_unit || 'kg');
      setTags(p.tags?.map((t) => t.tag) || []);
      setStatus(p.status || 'DRAFT');
      setImages((p.images || []).filter((img) => !img.variant_id));
      // Repeater children may arrive nested or flat; the editor works on a flat list.
      setCustomFields(flattenFieldTree(p.custom_fields));
      setFaqs(p.faqs || []);
      setBundleIds((p.bundles || []).map((b: { bundle_id: string }) => b.bundle_id));
      // Pre-fill creator collections. API returns links of the shape
      // { creator_category_id, creator_category: {...} }; either field works.
      const linkedIds = (p.creator_categories || [])
        .map((link) => link?.creator_category?.id || link?.creator_category_id)
        .filter((id): id is string => typeof id === 'string');
      setCreatorCategoryIds(linkedIds);
      // Older products have no stored primary: the first linked collection is it.
      setPrimaryCreatorCategoryId(
        p.primary_creator_category_id && linkedIds.includes(p.primary_creator_category_id)
          ? p.primary_creator_category_id
          : linkedIds[0] ?? null,
      );
      setShippingProfileId(p.shipping_profile_id || '');
      setTaxClassId(p.tax_class_id || '');
      setTaxExempt(!!p.tax_exempt);
      setGtin(p.gtin || '');
      setMpn(p.mpn || '');
      setBrand(p.brand || '');
      setGoogleProductCategory(p.google_product_category || '');
      setCondition(p.condition || 'new');
      setFeedExcluded(!!p.feed_excluded);

      // Populate translations for all configured locales
      setTranslations(prev => {
        const next = { ...prev };
        (p.translations || []).forEach((t) => {
          next[t.locale] = {
            title: t.title || '',
            description: t.description || '',
            slug: t.slug || '',
            ...('short_description' in t ? { short_description: t.short_description || '' } : {}),
          };
        });
        return next;
      });

      // Variants
      const variantRows = p.variants ?? [];
      if (variantRows.length > 0) {
        // Use persisted config if available (preserves styles, colorMap, etc.)
        if (Array.isArray(p.variant_option_config) && p.variant_option_config.length > 0) {
          setVariantOptions(p.variant_option_config);
        } else {
          // Fallback: reconstruct from variant data (old products without config)
          const optionNames = Object.keys(variantRows[0]!.options || {});
          const opts: VariantOption[] = optionNames.map(name => {
            const vals = variantRows.map((v) => String(v.options[name] || '')).filter(Boolean);
            return { name, style: 'text' as const, values: Array.from(new Set(vals)) };
          });
          setVariantOptions(opts);
        }
        const variantImageMap: Record<string, string> = {};
        (p.images || []).forEach((img) => {
          if (img.variant_id) variantImageMap[img.variant_id] = img.url;
        });
        setVariants(variantRows.map((v) => ({
          id: v.id,
          _key: v.id || `v-${Date.now()}-${Math.random()}`,
          options: v.options,
          price: Number(p.base_price) + (Number(v.price_adjustment) || 0),
          compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : 0,
          sku: v.sku || '',
          stock_quantity: v.stock_quantity,
          is_active: v.is_active,
          image_url: variantImageMap[v.id] || v.images?.[0]?.url || undefined,
        })));
      }

      const av: Record<string, AttrValue> = {};
      (p.attributes || []).forEach((a) => { av[a.template_id] = a.value; });
      setAttrValues(av);
    }).catch(console.error).finally(() => setLoading(false));
  }, [mode, token, productId, primaryLocale]);

  // ── Fetch attrs when category changes ─────────────────────
  useEffect(() => {
    if (!categoryId) { setCategoryAttrs([]); return; }
    api<CategoryAttribute[]>(`/categories/${categoryId}/attributes`)
      .then(attrs => setCategoryAttrs(Array.isArray(attrs) ? attrs : []))
      .catch(() => setCategoryAttrs([]));
  }, [categoryId]);

  // ── Seed an empty primary tab from an orphan translation ──
  // A store that switched its primary content language leaves older products
  // translated only under the previous locale; every configured-locale tab
  // then comes up empty and the product looks like it lost its name. Seed the
  // primary tab once from the best available row (en, then any) so the
  // creator sees the content and can store it under the current language —
  // the original row stays in state and is re-sent on save.
  useEffect(() => {
    if (mode !== 'edit' || loading || !localeConfigLoaded || seededRef.current) return;
    if (translations[primaryLocale]?.title?.trim()) return;
    const donor =
      (translations['en']?.title?.trim() ? 'en' : undefined) ||
      Object.keys(translations).find((l) => l !== primaryLocale && translations[l]?.title?.trim());
    if (!donor) return;
    seededRef.current = true;
    setSeededFrom(donor);
    setTranslations((prev) => ({ ...prev, [primaryLocale]: { ...prev[donor]! } }));
  }, [mode, loading, localeConfigLoaded, translations, primaryLocale]);

  // ── Auto-slug from primary locale title ───────────────────
  useEffect(() => {
    if (mode !== 'create') return;
    if (!primaryTitle) return;
    if (translations[primaryLocale]?.slug) return; // user has typed a custom one
    const auto = primaryTitle.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').substring(0, 100);
    if (auto) setTransField(primaryLocale, 'slug', auto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryTitle, mode, primaryLocale]);

  // ── Auto-translate to target locale ───────────────────────
  const handleTranslateTo = async (targetLocale: string) => {
    if (!primaryTitle.trim() || translatingLocale) return;
    setTranslatingLocale(targetLocale);
    try {
      const res = await api<{ translated: string }>('/translations/translate-text', {
        method: 'POST',
        token: token ?? undefined,
        body: JSON.stringify({ text: primaryTitle, source_locale: primaryLocale, target_locale: targetLocale }),
      });
      if (res.translated) setTransField(targetLocale, 'title', res.translated);
    } catch (err) {
      console.error('Translation failed:', err);
    } finally {
      setTranslatingLocale('');
    }
  };

  // ── Validation ────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!primaryTitle.trim()) errs.title = t('product.errTitleRequired');
    if (!categoryId)          errs.categoryId = t('product.errCategoryRequired');
    if (!basePrice || parseFloat(basePrice) <= 0)
                              errs.basePrice = t('product.errPricePositive');
    if (productType === 'CUSTOMIZABLE' && !customizationType)
                              errs.customizationType = t('product.errSelectCustomization');
    if (comparePrice && parseFloat(comparePrice) <= parseFloat(basePrice || '0'))
                              errs.comparePrice = t('product.errComparePrice');
    if (gtin.trim() && !isValidGtin(gtin.trim()))
                              errs.gtin = t('product.errGtinInvalid');
    categoryAttrs.filter(a => a.is_required).forEach(a => {
      const val = attrValues[a.id];
      if (val === '' || val == null || val === false)
        errs[`attr_${a.id}`] = t('product.errFieldRequired', { field: pickTranslation(a.translations, primaryLocale)?.label || a.name });
    });
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError(t('product.fixErrorsBeforeSaving'));
      setTimeout(() => document.querySelector('[data-field-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      return false;
    }
    return true;
  };

  // Scrolls to the product options card (variant options / variation cards).
  const jumpToOptions = () => {
    setTimeout(() => document.getElementById('product-options')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async (publishNow = false) => {
    if (!token) return;
    if (!validate()) return;
    setSaving(true);
    setError('');
    setOptionsError('');
    setFieldErrors({});
    // Path prefix of the create-mode custom field being written, so a config
    // error names that field instead of an anonymous one.
    let failedFieldPrefix = '';

    try {
      const finalStatus = publishNow ? 'PUBLISHED' : status;

      // Compute a URL-safe slug. `\w` is ASCII-only, so non-Latin titles
      // (Arabic, CJK, …) slugify to empty or just "-", which would 404 on the
      // storefront. We strip down to lowercase ASCII alphanumerics and hyphens.
      const asciiSlug = (s: string) =>
        s.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').substring(0, 100);
      const hasAlnum = (s: string) => /[a-z0-9]/.test(s);
      const primaryUserSlug = translations[primaryLocale]?.slug?.trim() || '';
      const primarySlug = hasAlnum(primaryUserSlug)
        ? primaryUserSlug
        : asciiSlug(primaryTitle);

      // Build translations array from all locales that have a title. A locale's
      // own slug (as entered by the user) wins if it's usable; otherwise derive
      // from the localized title; otherwise fall back to the primary slug.
      const translationsPayload = Object.entries(translations)
        .filter(([, t]) => t.title.trim())
        .map(([locale, t]) => {
          const userSlug = t.slug?.trim() || '';
          const derived = asciiSlug(t.title);
          const resolved = hasAlnum(userSlug)
            ? userSlug
            : (hasAlnum(derived) ? derived : primarySlug);
          return {
            locale,
            title: t.title,
            description: t.description || '',
            // Only when loaded or edited, so an untouched locale keeps its stored value.
            ...(t.short_description !== undefined
              ? { short_description: isBlankHtml(t.short_description) ? '' : t.short_description }
              : {}),
            slug: locale === primaryLocale ? primarySlug : resolved,
            ...(locale === primaryLocale
              ? { meta_title: metaTitle || undefined, meta_desc: metaDesc || undefined }
              : {}),
          };
        });

      // Variants and images ride along in the same request — the API syncs
      // them server-side in one transaction. Sending the existing variant id
      // lets the server update in place, keeping ids stable across saves.
      const variantsPayload = variants.map(v => ({
        id: v.id || undefined,
        options: v.options,
        price_adjustment: (v.price || 0) - (parseFloat(basePrice) || 0),
        compare_at_price: v.compare_at_price || undefined,
        sku: v.sku || undefined,
        stock_quantity: v.stock_quantity ?? undefined,
        is_active: v.is_active,
        image_url: v.image_url || undefined,
      }));
      const imagesPayload = images.map(img => ({
        url: img.url,
        alt_text: img.alt_text || undefined,
        is_featured: !!img.is_featured,
      }));

      const body: Record<string, unknown> = {
        category_id: categoryId,
        product_type: productType,
        customization_type: productType === 'CUSTOMIZABLE' ? customizationType : undefined,
        base_price: parseFloat(basePrice),
        compare_at_price: comparePrice ? parseFloat(comparePrice) : undefined,
        cost_price: costPrice ? parseFloat(costPrice) : undefined,
        sku: sku || undefined,
        track_inventory: trackInventory,
        stock_quantity: stockQty ? parseInt(stockQty) : undefined,
        weight: weight ? parseFloat(weight) : undefined,
        weight_unit: weightUnit,
        variant_option_config: variantOptions.length > 0 ? variantOptions : undefined,
        shipping_profile_id: shippingProfileId || undefined,
        // null = default class of the scope (platform or store).
        tax_class_id: taxClassId || null,
        tax_exempt: taxExempt,
        // Feed data: '' clears the stored value (null); "new" is the default.
        gtin: gtin.trim() || null,
        mpn: mpn.trim() || null,
        brand: brand.trim() || null,
        google_product_category: googleProductCategory.trim() || null,
        condition: condition === 'new' ? null : condition,
        feed_excluded: feedExcluded,
        status: finalStatus,
        translations: translationsPayload,
        attributes: Object.entries(attrValues).filter(([, v]) => v !== '' && v != null).map(([tid, value]) => ({ template_id: tid, value })),
        tags: tags.length > 0 ? tags : [],
        variants: variantsPayload,
        images: imagesPayload,
        ...(isCreator ? { bundle_ids: bundleIds, creator_category_ids: creatorCategoryIds, primary_creator_category_id: primaryCreatorCategoryId } : {}),
      };

      let pid = productId;
      if (mode === 'create') {
        const product = await api<{ id: string }>('/products', { method: 'POST', token: token ?? undefined, body: JSON.stringify(body) });
        pid = product.id;
      } else {
        const updated = await api<Pick<ProductResponse, 'variants'>>(`/products/${pid}`, { method: 'PUT', token, body: JSON.stringify(body) });
        // Adopt the server-assigned ids for newly created variants so the next
        // save updates them in place instead of recreating them. Match on a
        // key-sorted options signature — jsonb does not preserve key order.
        const optionsKey = (o: Record<string, string>) =>
          JSON.stringify(Object.entries(o || {}).sort(([a], [b]) => a.localeCompare(b)));
        const serverVariants: ProductVariantRow[] = Array.isArray(updated?.variants) ? updated.variants : [];
        const idByOptions = new Map(serverVariants.map(sv => [optionsKey(sv.options), sv.id]));
        setVariants(prev => prev.map(v => ({
          ...v,
          id: idByOptions.get(optionsKey(v.options)) ?? v.id,
        })));
      }

      // Persist custom fields + FAQs that were accumulated locally during create.
      // In edit mode these write through their own managers immediately, so we
      // skip them here to avoid duplicates.
      if (pid && mode === 'create') {
        // Parents first so repeater children can point at their real id
        // (children carry the parent's temp id until then).
        const realIds = new Map<string, string>();
        // Local-only keys (temp id, order, parent link) and read-only preset keys are not sent.
        const dtoOf = (f: CustomField): Record<string, unknown> => {
          const copy: Record<string, unknown> = { ...f };
          for (const key of ['id', 'sort_order', 'parent_id', 'preset_key', 'preset_ref']) delete copy[key];
          return copy;
        };
        const topLevel = customFields.filter(f => !f.parent_id);
        for (let i = 0; i < topLevel.length; i++) {
          const field = topLevel[i]!;
          failedFieldPrefix = field.name;
          const created = await api<{ id?: string } | null>(`/products/${pid}/custom-fields`, {
            method: 'POST', token,
            body: JSON.stringify({ ...dtoOf(field), sort_order: i }),
          });
          if (field.id && created?.id) realIds.set(field.id, created.id);
        }
        // A sub-field's sort_order is its index within its own parent.
        const childIndex = new Map<string, number>();
        for (const field of customFields.filter(f => f.parent_id)) {
          const parentId = field.parent_id ? realIds.get(field.parent_id) : undefined;
          if (!parentId) continue;
          const index = childIndex.get(parentId) ?? 0;
          childIndex.set(parentId, index + 1);
          const parentName = customFields.find(f => f.id === field.parent_id)?.name;
          failedFieldPrefix = parentName ? `${parentName}.children[${index}]` : field.name;
          await api(`/products/${pid}/custom-fields`, {
            method: 'POST', token,
            body: JSON.stringify({ ...dtoOf(field), parent_id: parentId, sort_order: index }),
          });
        }
        failedFieldPrefix = '';
        for (let i = 0; i < faqs.length; i++) {
          const faq = faqs[i]!;
          if (faq.id) continue;
          await api(`/products/${pid}/faqs`, {
            method: 'POST', token,
            body: JSON.stringify({ sort_order: i, translations: faq.translations }),
          });
        }
      }

      if (mode === 'create') {
        router.push(postCreateUrl ? `${postCreateUrl}/${pid}` : `/provider/products/${pid}`);
      } else {
        setSaved(t('product.productSaved'));
        setTimeout(() => setSaved(''), 3000);
      }
    } catch (err) {
      // Coded API errors (e.g. a custom field rejected while persisting the
      // create-mode fields) are translated; class-validator lists stay as-is.
      if (err instanceof ApiError && err.code === 'PERSONALIZATION_CONFIG_INVALID') {
        const issues = readConfigIssues(err.payload).map(issue => ({
          ...issue,
          path: failedFieldPrefix && issue.path ? `${failedFieldPrefix}.${issue.path}` : issue.path,
        }));
        const { lines, firstArea } = describeIssues(issues, { optionNames: variantOptions.map(o => o.name) });
        const text = [apiError(err), ...lines].join('\n');
        setError(text);
        if (firstArea === 'productOptions') {
          setOptionsError(text);
          jumpToOptions();
        }
      } else if (err instanceof ApiError && err.code === 'PERSONALIZATION_OPTION_IN_USE') {
        const fields = readErrorParamList(err.payload, 'fields');
        const options = readErrorParamList(err.payload, 'options');
        const detail = fields.length > 0
          ? t('product.optionInUseDetail', { options: options.join(', ') || '—', fields: fields.join(', ') })
          : '';
        const text = [apiError(err), detail].filter(Boolean).join('\n');
        setError(text);
        setOptionsError(text);
        jumpToOptions();
      } else if (err instanceof ApiError && err.code === 'PRODUCT_GTIN_INVALID') {
        setFieldErrors(p => ({ ...p, gtin: t('product.errGtinInvalid') }));
        setError(t('product.errGtinInvalid'));
      } else if (err instanceof ApiError && err.code) setError(apiError(err));
      else if (err instanceof ApiError && Array.isArray(err.errors)) setError(err.errors.join(' · '));
      else setError((err instanceof Error && err.message) || t('product.failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  // Re-reads the fields after a write (edit mode); children are flattened.
  const reloadCustomFields = async () => {
    if (!productId || !token) return;
    const p = await api<Pick<ProductResponse, 'custom_fields'>>(`/products/${productId}`, { token });
    setCustomFields(flattenFieldTree(p.custom_fields));
  };

  const handleAddCustomField = async (field: Omit<CustomField, 'sort_order'>) => {
    if (mode === 'edit' && productId && token) {
      await api(`/products/${productId}/custom-fields`, { method: 'POST', token: token ?? undefined, body: JSON.stringify(field) });
      await reloadCustomFields();
    } else {
      setCustomFields(prev => [...prev, { ...field, id: `temp-${Date.now()}`, sort_order: prev.length }]);
    }
  };

  const handleUpdateCustomField = async (fid: string, field: Omit<CustomField, 'sort_order'>) => {
    if (token && !fid.startsWith('temp-')) {
      await api(`/custom-fields/${fid}`, { method: 'PUT', token, body: JSON.stringify(field) });
      if (productId) {
        await reloadCustomFields();
        return;
      }
    }
    setCustomFields(prev => prev.map(f => f.id === fid ? { ...f, ...field, id: fid } : f));
  };

  const handleDeleteCustomField = async (fid: string) => {
    if (!window.confirm(t('customField.confirmDelete'))) return;
    if (token && !fid.startsWith('temp-')) {
      await api(`/custom-fields/${fid}`, { method: 'DELETE', token });
    }
    // Deleting a repeater also removes its children (cascade on the server).
    setCustomFields(prev => prev.filter(f => f.id !== fid && f.parent_id !== fid));
  };

  // New order of one sibling set (top-level fields or one repeater's children).
  // Applied optimistically; a refused order (e.g. PERSONALIZATION_CONFIG_INVALID
  // for a forward reference) restores the previous one and rethrows.
  const handleReorderCustomFields = async (orderedIds: string[]) => {
    const previous = customFields;
    const rank = new Map(orderedIds.map((id, i) => [id, i]));
    // Keep the array order in step too: create mode persists in array order.
    const slots = previous.flatMap((f, i) => (f.id && rank.has(f.id) ? [i] : []));
    const next = [...previous];
    orderedIds.forEach((id, i) => {
      const field = previous.find(f => f.id === id);
      if (field && slots[i] !== undefined) next[slots[i]!] = { ...field, sort_order: i };
    });
    setCustomFields(next);
    if (mode !== 'edit' || !productId || !token || orderedIds.some(id => id.startsWith('temp-'))) return;
    try {
      await api(`/products/${productId}/custom-fields/sort`, {
        method: 'PUT', token, body: JSON.stringify({ field_ids: orderedIds }),
      });
    } catch (err) {
      setCustomFields(previous);
      throw err;
    }
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );

  const isRtl = RTL_LOCALES.includes(activeLocale);
  const hasMultipleLocales = allLocales.length > 1;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href={backUrl} className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === 'create' ? t('product.addProduct') : primaryTitle || t('product.editProduct')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-emerald-600 font-medium">{saved}</span>}
          <Button variant="outline" size="sm" onClick={() => router.push(backUrl)}>{t('product.discard')}</Button>
          <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null} {t('product.saveDraft')}
          </Button>
          <Button size="sm" onClick={() => handleSave(true)} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null} {t('product.publish')}
          </Button>
        </div>
      </div>

      {error && <div role="alert" className="bg-red-50 text-red-600 text-xs p-3 rounded-lg border border-red-200 mb-4 whitespace-pre-line">{error}</div>}

      <div className="grid grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="col-span-2 space-y-5">

          {/* Title & Description — language tabs */}
          <Card className="shadow-none">
            {hasMultipleLocales && (
              <div className="flex items-center gap-0 border-b px-6 pt-4">
                {allLocales.map(locale => {
                  const isDone = !!translations[locale]?.title?.trim();
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

            <CardContent className="pt-5 space-y-4">
              {seededFrom && (
                <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{t('product.seededFromLocale', { locale: LOCALE_LABELS[seededFrom] || seededFrom.toUpperCase() })}</span>
                </div>
              )}
              {/* Translate button for secondary locales */}
              {activeLocale !== primaryLocale && (
                <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-lg border border-dashed">
                  <span className="text-xs text-muted-foreground">
                    {t('product.autoTranslateFrom')}{' '}
                    <strong>{LOCALE_LABELS[primaryLocale] || primaryLocale}</strong>
                    {primaryTitle ? `: "${primaryTitle.substring(0, 40)}${primaryTitle.length > 40 ? '…' : ''}"` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTranslateTo(activeLocale)}
                    disabled={!!translatingLocale || !primaryTitle.trim()}
                    className="flex items-center gap-1 text-xs text-primary font-medium hover:underline disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ml-3"
                  >
                    {translatingLocale === activeLocale
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> {t('product.translating')}</>
                      : <><Languages className="w-3 h-3" /> {t('product.autoTranslate')}</>}
                  </button>
                </div>
              )}

              {/* Title field */}
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {t('product.title')} {activeLocale === primaryLocale && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  dir={isRtl ? 'rtl' : 'ltr'}
                  placeholder={
                    activeLocale === primaryLocale
                      ? t('product.titlePlaceholder')
                      : t('product.titleInLocale', { locale: LOCALE_LABELS[activeLocale] || activeLocale })
                  }
                  value={translations[activeLocale]?.title || ''}
                  onChange={e => {
                    setTransField(activeLocale, 'title', e.target.value);
                    if (activeLocale === primaryLocale && fieldErrors.title)
                      setFieldErrors(p => ({ ...p, title: '' }));
                  }}
                  className={activeLocale === primaryLocale && fieldErrors.title ? 'border-red-400 focus-visible:ring-red-400' : ''}
                />
                {activeLocale === primaryLocale && <FieldError msg={fieldErrors.title} />}
              </div>

              {/* Description field */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t('common.description')}</Label>
                <RichTextEditor
                  dir={isRtl ? 'rtl' : 'ltr'}
                  content={translations[activeLocale]?.description || ''}
                  onChange={val => setTransField(activeLocale, 'description', val)}
                />
              </div>

              {/* Short description per locale (M4.4), shown near add-to-cart on the storefront */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t('product.shortDescription')}</Label>
                <RichTextEditor
                  dir={isRtl ? 'rtl' : 'ltr'}
                  content={translations[activeLocale]?.short_description || ''}
                  onChange={val => setTransField(activeLocale, 'short_description', val)}
                  placeholder={t('product.shortDescriptionPlaceholder')}
                />
              </div>

              {/* URL slug per locale — kept ASCII (the storefront URL segment).
                  Leaving it empty for a secondary locale reuses the primary slug. */}
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {t('product.urlSlug')}
                  {activeLocale === primaryLocale && <span className="text-red-500"> *</span>}
                </Label>
                <Input
                  dir="ltr"
                  className="h-8 text-sm font-mono"
                  value={translations[activeLocale]?.slug || ''}
                  onChange={e =>
                    setTransField(
                      activeLocale,
                      'slug',
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                    )
                  }
                  placeholder={
                    activeLocale === primaryLocale
                      ? ''
                      : translations[primaryLocale]?.slug || ''
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Images */}
          <ImageGallery
            images={images}
            onChange={setImages}
            onPickAndUpload={(multiple) => pickAndUpload('products', multiple)}
            uploading={uploading}
          />

          {/* Variants */}
          <div id="product-options" className="scroll-mt-4">
            {optionsError && <div role="alert" className="bg-red-50 text-red-600 text-xs p-3 rounded-lg border border-red-200 mb-3 whitespace-pre-line">{optionsError}</div>}
            <VariantManager
              options={variantOptions}
              onOptionsChange={setVariantOptions}
              variants={variants}
              onVariantsChange={setVariants}
              basePrice={parseFloat(basePrice) || 0}
              onPickImage={() => pickAndUpload('products', false)}
              uploading={uploading}
              personalization={personalizationOn}
            />
          </div>

          {/* Dynamic Attributes */}
          {categoryAttrs.length > 0 && (
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  {t('product.specifications')}
                  <Badge variant="secondary" className="ml-2 text-[10px]">{t('product.fieldsCount', { count: categoryAttrs.length })}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {categoryAttrs.map((attr) => {
                    const label = pickTranslation(attr.translations, primaryLocale)?.label || attr.name;
                    const errKey = `attr_${attr.id}`;
                    const clearErr = () => { if (fieldErrors[errKey]) setFieldErrors(p => ({ ...p, [errKey]: '' })); };
                    return (
                      <div key={attr.id} className="space-y-1.5">
                        <Label className="text-xs">{label} {attr.is_required && <span className="text-red-500">*</span>}</Label>
                        {attr.type === 'BOOLEAN' ? (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="rounded accent-primary"
                              checked={!!attrValues[attr.id]}
                              onChange={e => { setAttrValues({ ...attrValues, [attr.id]: e.target.checked }); clearErr(); }} />
                            <span className="text-xs">{t('common.yes')}</span>
                          </label>
                        ) : attr.type === 'SELECT' && Array.isArray(attr.options) ? (
                          <SearchableSelect
                            value={(attrValues[attr.id] || '') as string}
                            onChange={v => { setAttrValues({ ...attrValues, [attr.id]: v }); clearErr(); }}
                            placeholder={t('product.selectField', { field: label })}
                            options={attr.options.map((o: string) => ({ value: o, label: o }))}
                          />
                        ) : (
                          <Input
                            className={`h-8 text-sm ${fieldErrors[errKey] ? 'border-red-400' : ''}`}
                            placeholder={attr.unit ? `(${attr.unit})` : ''}
                            value={(attrValues[attr.id] || '') as string}
                            onChange={e => { setAttrValues({ ...attrValues, [attr.id]: e.target.value }); clearErr(); }}
                          />
                        )}
                        <FieldError msg={fieldErrors[errKey]} />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer Input Fields */}
          <CustomFieldManager
            fields={customFields}
            onAdd={handleAddCustomField}
            onUpdate={handleUpdateCustomField}
            onDelete={handleDeleteCustomField}
            onReorder={handleReorderCustomFields}
            locales={allLocales}
            primaryLocale={primaryLocale}
            personalization={personalizationOn}
            variantOptions={variantOptions}
            productId={mode === 'edit' ? productId : undefined}
            onFieldsChanged={reloadCustomFields}
          />

          {/* FAQ */}
          <Card className="shadow-none">
            <CardContent className="pt-5">
              <FaqManager
                productId={mode === 'edit' ? productId : undefined}
                faqs={faqs}
                onChange={setFaqs}
                locales={allLocales}
                primaryLocale={primaryLocale}
              />
            </CardContent>
          </Card>

          {/* SEO (primary locale only) */}
          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('product.seo')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5"><Label className="text-xs">{t('product.pageTitle')}</Label><Input className="h-8 text-sm" value={metaTitle} onChange={e => setMetaTitle(e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">{t('product.metaDescription')}</Label>
                <textarea rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs" value={metaDesc} onChange={e => setMetaDesc(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('common.status')}</CardTitle></CardHeader>
            <CardContent>
              <SearchableSelect value={status} onChange={setStatus} options={[
                { value: 'DRAFT', label: t('product.statusDraft'), description: t('product.statusDraftDesc') },
                { value: 'PUBLISHED', label: t('product.statusPublished'), description: t('product.statusPublishedDesc') },
                { value: 'ARCHIVED', label: t('product.statusArchived'), description: t('product.statusArchivedDesc') },
              ]} />
            </CardContent>
          </Card>

          {/* Bundles — creator-only. Creator-owned products have no provider
              cost, so the picker shows no "below cost" warnings here. */}
          {isCreator && (
            <Card className="shadow-none">
              <CardContent className="pt-5">
                <BundlePicker
                  value={bundleIds}
                  onChange={setBundleIds}
                  productPricing={{
                    unitPrice: parseFloat(basePrice) || 0,
                    providerBasePrice: 0,
                  }}
                />
              </CardContent>
            </Card>
          )}

          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('product.productType')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <label className="flex items-center gap-2.5 p-2.5 border rounded-lg cursor-pointer hover:bg-zinc-50 transition has-checked:border-primary has-checked:bg-primary/5">
                <input type="radio" name="pt" value="TRADITIONAL" checked={productType === 'TRADITIONAL'} onChange={() => setProductType('TRADITIONAL')} className="accent-primary" />
                <div><p className="text-xs font-medium">{t('product.traditional')}</p><p className="text-[10px] text-muted-foreground">{t('product.traditionalDesc')}</p></div>
              </label>
              <label className="flex items-center gap-2.5 p-2.5 border rounded-lg cursor-pointer hover:bg-zinc-50 transition has-checked:border-primary has-checked:bg-primary/5">
                <input type="radio" name="pt" value="CUSTOMIZABLE" checked={productType === 'CUSTOMIZABLE'} onChange={() => setProductType('CUSTOMIZABLE')} className="accent-primary" />
                <div><p className="text-xs font-medium">{t('product.customizable')}</p><p className="text-[10px] text-muted-foreground">{t('product.customizableDesc')}</p></div>
              </label>
              {productType === 'CUSTOMIZABLE' && (
                <>
                  <SearchableSelect
                    value={customizationType}
                    onChange={v => { setCustomizationType(v); if (fieldErrors.customizationType) setFieldErrors(p => ({ ...p, customizationType: '' })); }}
                    placeholder={t('product.method')}
                    options={[
                      { value: 'PRINT', label: t('product.custPrint') }, { value: 'ENGRAVE', label: t('product.custEngrave') },
                      { value: 'PRINT_3D', label: t('product.cust3dPrint') }, { value: 'EMBROIDERY', label: t('product.custEmbroidery') },
                      { value: 'HANDMADE', label: t('product.custHandmade') }, { value: 'OTHER', label: t('product.custOther') },
                    ]}
                  />
                  <FieldError msg={fieldErrors.customizationType} />
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('product.category')}</CardTitle></CardHeader>
            <CardContent>
              <SearchableSelect
                value={categoryId}
                onChange={v => { setCategoryId(v); if (fieldErrors.categoryId) setFieldErrors(p => ({ ...p, categoryId: '' })); }}
                placeholder={t('common.select')} searchPlaceholder={t('common.searchEllipsis')}
                options={categories}
              />
              <FieldError msg={fieldErrors.categoryId} />
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('product.pricing')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('product.priceRequired')}</Label>
                <div className={`flex items-stretch rounded-lg border ${fieldErrors.basePrice ? 'border-red-400' : 'border-input'} overflow-hidden focus-within:ring-2 focus-within:ring-ring/40`}>
                  <span className="flex items-center px-2.5 bg-zinc-50 border-r text-[11px] font-semibold text-muted-foreground tracking-wide">{currency}</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 text-sm border-0 rounded-none focus-visible:ring-0 focus-visible:border-0 shadow-none"
                    value={basePrice}
                    onChange={e => { setBasePrice(e.target.value); if (fieldErrors.basePrice) setFieldErrors(p => ({ ...p, basePrice: '' })); }}
                    placeholder="0.00"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  {t('product.priceHelp')}
                </p>
                <FieldError msg={fieldErrors.basePrice} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{t('product.compareAt')}</Label>
                <div className={`flex items-stretch rounded-lg border ${fieldErrors.comparePrice ? 'border-red-400' : 'border-input'} overflow-hidden focus-within:ring-2 focus-within:ring-ring/40`}>
                  <span className="flex items-center px-2.5 bg-zinc-50 border-r text-[11px] font-semibold text-muted-foreground tracking-wide">{currency}</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 text-sm border-0 rounded-none focus-visible:ring-0 focus-visible:border-0 shadow-none"
                    value={comparePrice}
                    onChange={e => { setComparePrice(e.target.value); if (fieldErrors.comparePrice) setFieldErrors(p => ({ ...p, comparePrice: '' })); }}
                    placeholder="0.00"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  {t('product.compareAtHelp')}
                </p>
                <FieldError msg={fieldErrors.comparePrice} />
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label className="text-xs">{t('product.costPerItem')}</Label>
                <div className="flex items-stretch rounded-lg border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring/40">
                  <span className="flex items-center px-2.5 bg-zinc-50 border-r text-[11px] font-semibold text-muted-foreground tracking-wide">{currency}</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 text-sm border-0 rounded-none focus-visible:ring-0 focus-visible:border-0 shadow-none"
                    value={costPrice}
                    onChange={e => setCostPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  {t('product.costPerItemHelp')}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('product.inventory')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded accent-primary" checked={trackInventory} onChange={e => setTrackInventory(e.target.checked)} />
                <span className="text-xs font-medium">{t('product.trackInventory')}</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">{t('product.sku')}</Label><Input className="h-8 text-sm font-mono" value={sku} onChange={e => setSku(e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">{t('product.quantity')}</Label><Input type="number" className="h-8 text-sm" value={stockQty} onChange={e => setStockQty(e.target.value)} /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('product.shipping')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('product.shippingProfile')}</Label>
                <SearchableSelect
                  value={shippingProfileId}
                  onChange={setShippingProfileId}
                  options={[
                    { value: '', label: t('product.useDefaultProfile') },
                    ...shippingProfiles.map(p => ({
                      value: p.id,
                      label: `${p.name}${p.is_default ? ` ${t('product.defaultSuffix')}` : ''}`,
                    })),
                  ]}
                  placeholder={t('product.selectShippingProfile')}
                />
                <p className="text-[10px] text-muted-foreground">
                  {t('product.manageProfilesIn')}{' '}
                  <Link href="/provider/shipping" className="text-primary hover:underline">
                    {t('product.shippingSettings')}
                  </Link>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">{t('product.weight')}</Label><Input type="number" step="0.01" className="h-8 text-sm" value={weight} onChange={e => setWeight(e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">{t('product.unit')}</Label>
                  <SearchableSelect value={weightUnit} onChange={setWeightUnit} options={[{ value: 'kg', label: 'kg' }, { value: 'g', label: 'g' }, { value: 'lb', label: 'lb' }]} /></div>
              </div>
            </CardContent>
          </Card>

          {/* Tax — class picks which rate applies per country; exempt products
              are always taxed at 0 %. Empty selection = the scope default class. */}
          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('product.tax')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('product.taxClass')}</Label>
                {(() => {
                  // Store-scoped default wins over the platform default.
                  const scopeDefault = taxClasses.find(c => c.is_default && c.store_id) || taxClasses.find(c => c.is_default);
                  const defaultLabel = scopeDefault
                    ? t('product.taxClassDefaultNamed', { name: localizedTaxText(scopeDefault.name, uiLocale, scopeDefault.key) })
                    : t('product.taxClassDefault');
                  return (
                    <SearchableSelect
                      value={taxClassId}
                      onChange={setTaxClassId}
                      options={[
                        { value: '', label: defaultLabel },
                        ...taxClasses.map(c => ({
                          value: c.id,
                          label: localizedTaxText(c.name, uiLocale, c.key),
                          description: c.key,
                        })),
                      ]}
                      placeholder={defaultLabel}
                    />
                  );
                })()}
                <p className="text-[10px] text-muted-foreground">{t('product.taxClassHint')}</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded accent-primary" checked={taxExempt} onChange={e => setTaxExempt(e.target.checked)} />
                <span className="text-xs font-medium">{t('product.taxExempt')}</span>
              </label>
              <p className="text-[10px] text-muted-foreground">{t('product.taxExemptHint')}</p>
            </CardContent>
          </Card>

          {/* Feed data — identifiers the Google Merchant / Meta catalog feeds
              need (feeds app). Stored on the product; empty = not set. */}
          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('product.feedData')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[10px] text-muted-foreground">{t('product.feedDataHint')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('product.feedGtin')}</Label>
                  <Input className="h-8 text-sm font-mono" inputMode="numeric" maxLength={14} value={gtin} onChange={e => { setGtin(e.target.value); if (fieldErrors.gtin) setFieldErrors(p => ({ ...p, gtin: '' })); }} placeholder="7310865004703" />
                  <FieldError msg={fieldErrors.gtin} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('product.feedMpn')}</Label>
                  <Input className="h-8 text-sm font-mono" maxLength={70} value={mpn} onChange={e => setMpn(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('product.feedBrand')}</Label>
                <Input className="h-8 text-sm" maxLength={70} value={brand} onChange={e => setBrand(e.target.value)} />
                <p className="text-[10px] text-muted-foreground">{t('product.feedBrandHint')}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('product.feedGoogleCategory')}</Label>
                <Input className="h-8 text-sm" maxLength={191} value={googleProductCategory} onChange={e => setGoogleProductCategory(e.target.value)} placeholder="1604" />
                <p className="text-[10px] text-muted-foreground">{t('product.feedGoogleCategoryHint')}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('product.feedCondition')}</Label>
                <SearchableSelect
                  value={condition}
                  onChange={setCondition}
                  options={[
                    { value: 'new', label: t('product.feedConditionNew') },
                    { value: 'refurbished', label: t('product.feedConditionRefurbished') },
                    { value: 'used', label: t('product.feedConditionUsed') },
                  ]}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded accent-primary" checked={feedExcluded} onChange={e => setFeedExcluded(e.target.checked)} />
                <span className="text-xs font-medium">{t('product.feedExcluded')}</span>
              </label>
              <p className="text-[10px] text-muted-foreground">{t('product.feedExcludedHint')}</p>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('product.tags')}</CardTitle></CardHeader>
            <CardContent>
              <TagInput tags={tags} onChange={setTags} placeholder={t('product.tagsPlaceholder')} />
            </CardContent>
          </Card>

          {/* Collections — creator-only; groups this product into the creator's
              own store collections (Shopify-style). */}
          {isCreator && (
            <Card className="shadow-none">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('product.collections')}</CardTitle></CardHeader>
              <CardContent>
                <div>
                  <Label className="text-xs">{t('product.collections')}</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    {t('product.collectionsHelp')}
                  </p>
                  <CollectionTreePicker
                    value={creatorCategoryIds}
                    onChange={setCreatorCategoryIds}
                    primaryId={primaryCreatorCategoryId}
                    primaryLocale={primaryLocale}
                    onPrimaryChange={setPrimaryCreatorCategoryId}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
