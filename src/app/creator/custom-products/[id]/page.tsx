'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ArrowLeft, Package, Trash2, Languages, Loader2, Check, Upload, Star, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useImageUpload } from '@/lib/useImageUpload';
import VariantSelector from '@/components/creator/VariantSelector';
import PricingStrategySelector from '@/components/creator/PricingStrategySelector';
import CustomFieldRenderer from '@/components/creator/CustomFieldRenderer';
import FaqManager, { type Faq } from '@/components/product/FaqManager';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { BundlePicker } from '@/components/creator/bundles/BundlePicker';
import { computeProductPricingForBundleCheck } from '@/components/creator/bundles/economics';
import { CollectionsMultiSelect } from '@/components/creator/categories/CollectionsMultiSelect';
import { useCurrency } from '@/lib/useCurrency';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '');

const LOCALE_LABELS: Record<string, string> = {
  en: 'English', ar: 'العربية', tr: 'Türkçe', de: 'Deutsch', fr: 'Français', sv: 'Svenska',
};
const RTL_LOCALES = ['ar'];

function resolveUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

interface ProductVariant {
  id: string;
  sku: string | null;
  price_adjustment: number;
  stock_quantity: number | null;
  options: Record<string, string>;
}

interface ProductCustomField {
  id: string;
  name: string;
  type: string;
  is_required: boolean;
  placeholder?: string;
  options?: any;
  validation_rules?: any;
  translations: any[];
}

interface CustomProduct {
  id: string;
  import_mode: 'AS_IS' | 'CUSTOMIZE';
  pricing_type: 'SINGLE' | 'PER_VARIANT' | 'MARGIN';
  final_price: number;
  margin_amount?: number;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'REJECTED' | 'PUBLISHED' | 'ARCHIVED';
  rejection_reason?: string;
  translations: { locale: string; title: string; description?: string; slug: string }[];
  selected_variants?: { id: string; variant_id: string; custom_price?: number; variant: ProductVariant }[];
  field_values?: { id: string; custom_field_id: string; value?: string; file_url?: string }[];
  bundles?: { bundle_id: string }[];
  creator_categories?: { creator_category_id: string; creator_category?: { id: string } }[];
  product: {
    id: string;
    base_price: number;
    provider_id?: string;
    creator_id?: string;
    translations: { locale: string; title: string; description?: string }[];
    images?: { url: string; sort_order: number }[];
    variants?: ProductVariant[];
    custom_fields?: ProductCustomField[];
  };
}

type Translator = ReturnType<typeof useTranslations>;

// Status options shown in the dropdown — provider-base products require review,
// so PUBLISHED isn't directly selectable; creators use the Submit for Review button.
const buildStatusOptionsFree = (t: Translator) => [
  { value: 'DRAFT', label: t('editCustomProduct.statusDraft'), description: t('editCustomProduct.statusDraftDesc') },
  { value: 'PUBLISHED', label: t('editCustomProduct.statusPublished'), description: t('editCustomProduct.statusPublishedDesc') },
  { value: 'ARCHIVED', label: t('editCustomProduct.statusArchived'), description: t('editCustomProduct.statusArchivedDesc') },
];

const buildStatusOptionsReview = (t: Translator) => [
  { value: 'DRAFT', label: t('editCustomProduct.statusDraft'), description: t('editCustomProduct.statusDraftDesc') },
  { value: 'ARCHIVED', label: t('editCustomProduct.statusArchived'), description: t('editCustomProduct.statusArchivedDesc') },
];

const STATUS_COLORS: Record<string, string> = {
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
  DRAFT: 'bg-zinc-100 text-zinc-700',
  PENDING_REVIEW: 'bg-amber-50 text-amber-700',
  REJECTED: 'bg-red-50 text-red-700',
  ARCHIVED: 'bg-zinc-100 text-zinc-500',
};

type PricingType = 'SINGLE' | 'PER_VARIANT' | 'MARGIN';
type LocaleTranslation = { title: string; description: string; slug: string };

export default function EditCustomProduct() {
  const { fmt } = useCurrency();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const t = useTranslations('creator');
  const tc = useTranslations('common');

  const { pickAndUpload, uploading: imageUploading } = useImageUpload(token);
  const [product, setProduct] = useState<CustomProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null);

  // Language config
  const [primaryLocale, setPrimaryLocale] = useState('en');
  const [allLocales, setAllLocales] = useState<string[]>(['en']);
  const [activeLocale, setActiveLocale] = useState('en');
  const [translations, setTranslations] = useState<Record<string, LocaleTranslation>>({
    en: { title: '', description: '', slug: '' },
  });
  const [translatingLocale, setTranslatingLocale] = useState('');

  // Pricing
  const [pricingType, setPricingType] = useState<PricingType>('SINGLE');
  const [finalPrice, setFinalPrice] = useState('');
  const [marginAmount, setMarginAmount] = useState('');
  const [variantPrices, setVariantPrices] = useState<Record<string, string>>({});

  // Variants & fields
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, { value?: string; file_url?: string }>>({});

  // Images
  const [selectedImageUrls, setSelectedImageUrls] = useState<string[]>([]);

  // FAQs
  const [faqs, setFaqs] = useState<Faq[]>([]);

  // Bundles attached to this custom product
  const [bundleIds, setBundleIds] = useState<string[]>([]);

  // Creator collections attached to this custom product
  const [creatorCategoryIds, setCreatorCategoryIds] = useState<string[]>([]);

  // Slug availability check — debounced, primary-locale only.
  type SlugStatus = 'idle' | 'checking' | 'available' | 'taken';
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');

  // Other
  const [status, setStatus] = useState('DRAFT');

  const setTransField = (locale: string, field: keyof LocaleTranslation, value: string) => {
    setTranslations((prev) => ({ ...prev, [locale]: { ...prev[locale], [field]: value } }));
  };

  const fetchAll = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const [store, productRes] = await Promise.all([
        api<any>('/stores/my/store', { token }),
        api<CustomProduct>(`/custom-products/${id}`, { token }),
      ]);

      const primary: string = store.language_config?.primary_locale || 'en';
      const secondary: string[] = store.language_config?.secondary_locales || [];
      const all = [primary, ...secondary.filter((l: string) => l !== primary)];
      setPrimaryLocale(primary);
      setAllLocales(all);
      setActiveLocale(primary);

      setProduct(productRes);
      setStatus(productRes.status);
      setBundleIds((productRes.bundles ?? []).map((b) => b.bundle_id));
      setCreatorCategoryIds(
        (productRes.creator_categories ?? [])
          .map((link) => link.creator_category?.id || link.creator_category_id)
          .filter((id): id is string => typeof id === 'string'),
      );

      // Pricing
      setPricingType(productRes.pricing_type || 'SINGLE');
      setFinalPrice(String(productRes.final_price || ''));
      setMarginAmount(String(productRes.margin_amount || ''));

      // Selected variants
      const svIds = (productRes.selected_variants || []).map((sv) => sv.variant_id);
      setSelectedVariantIds(svIds);

      // Variant prices
      const vp: Record<string, string> = {};
      (productRes.selected_variants || []).forEach((sv) => {
        if (sv.custom_price !== undefined && sv.custom_price !== null) {
          vp[sv.variant_id] = String(sv.custom_price);
        }
      });
      setVariantPrices(vp);

      // Field values
      const fv: Record<string, { value?: string; file_url?: string }> = {};
      (productRes.field_values || []).forEach((f) => {
        fv[f.custom_field_id] = { value: f.value || undefined, file_url: f.file_url || undefined };
      });
      setFieldValues(fv);

      // Mockup images
      const imgUrls = (productRes as any).mockup_images?.map((img: any) => img.url) || [];
      setSelectedImageUrls(imgUrls);
      setFeaturedImageUrl(imgUrls[0] || null);

      // Translations
      const merged: Record<string, LocaleTranslation> = {};
      all.forEach((l) => { merged[l] = { title: '', description: '', slug: '' }; });
      (productRes.translations || []).forEach((tr) => {
        merged[tr.locale] = { title: tr.title || '', description: tr.description || '', slug: tr.slug || '' };
      });
      setTranslations(merged);

      setFaqs((productRes as any).faqs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Debounced slug availability check. We only check the primary-locale slug —
  // secondary translations don't drive the storefront URL. Exclude this product
  // from the conflict check so its own current slug doesn't show as "taken".
  useEffect(() => {
    if (!token || !id) return;
    const slug = (translations[primaryLocale]?.slug || '').trim();
    if (!slug) {
      setSlugStatus('idle');
      return;
    }
    setSlugStatus('checking');
    const handle = setTimeout(async () => {
      try {
        const res = await api<{ available: boolean }>(
          `/custom-products/check-slug?slug=${encodeURIComponent(slug)}&exclude_id=${encodeURIComponent(id)}`,
          { token },
        );
        setSlugStatus(res?.available ? 'available' : 'taken');
      } catch {
        setSlugStatus('idle');
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [token, id, translations, primaryLocale]);

  const handleTranslateTo = async (targetLocale: string) => {
    const sourceTitle = translations[primaryLocale]?.title || '';
    if (!sourceTitle.trim() || translatingLocale) return;
    setTranslatingLocale(targetLocale);
    try {
      const res = await api<{ translated: string }>('/translations/translate-text', {
        method: 'POST',
        token: token ?? undefined,
        body: JSON.stringify({ text: sourceTitle, source_locale: primaryLocale, target_locale: targetLocale }),
      });
      if (res.translated) setTransField(targetLocale, 'title', res.translated);
    } catch {
      // silent
    } finally {
      setTranslatingLocale('');
    }
  };

  const handleSave = async () => {
    if (!token || !product) return;
    setSaving(true);
    setSaveError('');
    try {
      const translationsPayload = Object.entries(translations)
        .filter(([, tr]) => tr.title.trim())
        .map(([locale, tr]) => ({
          locale,
          title: tr.title,
          description: tr.description || undefined,
          slug: tr.slug || tr.title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').substring(0, 100),
        }));

      const body: any = {
        pricing_type: pricingType,
        translations: translationsPayload,
      };
      // Only send status if the creator explicitly changed it — otherwise let the backend
      // auto-revert PUBLISHED → PENDING_REVIEW when content changes.
      if (status !== product.status) {
        body.status = status;
      }

      if (pricingType === 'SINGLE') body.final_price = parseFloat(finalPrice) || 0;
      if (pricingType === 'MARGIN') body.margin_amount = parseFloat(marginAmount) || 0;

      // Send updated variants if in CUSTOMIZE mode
      if (product.import_mode === 'CUSTOMIZE') {
        body.selected_variants = selectedVariantIds.map((vid) => ({
          variant_id: vid,
          ...(pricingType === 'PER_VARIANT' ? { custom_price: parseFloat(variantPrices[vid] || '0') } : {}),
        }));
      } else if (pricingType === 'PER_VARIANT') {
        // AS_IS but per-variant pricing: send all with prices
        body.selected_variants = selectedVariantIds.map((vid) => ({
          variant_id: vid,
          custom_price: parseFloat(variantPrices[vid] || '0'),
        }));
      }

      // Field values
      const fieldEntries = Object.entries(fieldValues).filter(
        ([, v]) => v.value?.trim() || v.file_url?.trim(),
      );
      if (fieldEntries.length > 0) {
        body.field_values = fieldEntries.map(([custom_field_id, data]) => ({
          custom_field_id,
          value: data.value || undefined,
          file_url: data.file_url || undefined,
        }));
      }

      // Mockup images — featured image first (sort_order=0)
      const sorted = featuredImageUrl
        ? [featuredImageUrl, ...selectedImageUrls.filter((u) => u !== featuredImageUrl)]
        : selectedImageUrls;
      body.mockup_image_urls = sorted;

      body.bundle_ids = bundleIds;
      body.creator_category_ids = creatorCategoryIds;

      await api(`/custom-products/${id}`, { method: 'PUT', token, body: JSON.stringify(body) });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      fetchAll();
      return true;
    } catch (err) {
      const e = err as { message?: string };
      setSaveError(e?.message || t('editCustomProduct.failedSave'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!token) return;
    setSaveError('');
    // Save first to persist any pending edits; bail out if save failed.
    const ok = await handleSave();
    if (!ok) return;
    setSaving(true);
    try {
      await api(`/custom-products/${id}/submit`, { method: 'POST', token });
      fetchAll();
    } catch (err) {
      const e = err as { message?: string };
      setSaveError(e?.message || t('editCustomProduct.failedSubmit'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token) return;
    await api(`/custom-products/${id}`, { method: 'DELETE', token });
    router.push('/creator/custom-products');
  };

  if (loading) return <p className="text-sm text-muted-foreground p-6">{tc('loading')}</p>;
  if (!product) return <p className="text-sm text-muted-foreground p-6">{t('editCustomProduct.notFound')}</p>;

  // Does the base product belong to a provider? If so → review workflow applies.
  const requiresReview = !!product.product.provider_id;
  const canSubmitForReview = requiresReview && (status === 'DRAFT' || status === 'REJECTED' || product.status === 'REJECTED');

  const basePrice = Number(product.product.base_price);
  const providerName = product.product.translations.find((tr) => tr.locale === 'en')?.title || '—';
  const hasMultipleLocales = allLocales.length > 1;
  const isRtl = RTL_LOCALES.includes(activeLocale);
  const primaryTitle = translations[primaryLocale]?.title || '';
  const allVariants = product.product.variants || [];
  const hasCustomFields = (product.product.custom_fields?.length ?? 0) > 0;
  const selectedVariantsForPricing = allVariants.filter((v) => selectedVariantIds.includes(v.id));

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" /> {tc('back')}
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">{t('editCustomProduct.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('editCustomProduct.subtitle')}</p>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] font-semibold ${
            product.import_mode === 'AS_IS'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-purple-50 text-purple-700 border-purple-200'
          }`}
        >
          {product.import_mode === 'AS_IS' ? t('editCustomProduct.importedAsIs') : t('editCustomProduct.customized')}
        </Badge>
        <Badge variant="secondary" className={`text-[10px] font-semibold ${STATUS_COLORS[status] || ''}`}>
          {t(`editCustomProduct.status_${status}`)}
        </Badge>
      </div>

      {/* ── Two-column grid ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

      {/* ═══ LEFT COLUMN ═══ (main content) */}
      <div className="lg:col-span-2 space-y-6">

      {/* Provider product info */}
      <Card className="shadow-none bg-zinc-50 border-dashed">
        <CardContent className="py-3 flex items-center gap-3">
          <Package className="w-4 h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">{t('editCustomProduct.providerProduct')}</p>
            <p className="text-sm font-medium">{providerName}</p>
          </div>
          <Badge variant="secondary" className="ml-auto text-[10px]">{t('editCustomProduct.basePrice', { price: fmt(basePrice) })}</Badge>
        </CardContent>
      </Card>

      {/* Variant Selection (CUSTOMIZE mode only) */}
      {product.import_mode === 'CUSTOMIZE' && allVariants.length > 0 && (
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{t('editCustomProduct.selectedVariants')}</CardTitle>
          </CardHeader>
          <CardContent>
            <VariantSelector
              variants={allVariants}
              selectedIds={selectedVariantIds}
              onChange={setSelectedVariantIds}
              basePrice={basePrice}
            />
          </CardContent>
        </Card>
      )}

      {/* Custom Fields */}
      {hasCustomFields && (
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{t('editCustomProduct.customFields')}</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomFieldRenderer
              fields={product.product.custom_fields!}
              values={fieldValues}
              onChange={(fieldId, data) =>
                setFieldValues((prev) => ({ ...prev, [fieldId]: data }))
              }
              locale={primaryLocale}
              token={token}
            />
          </CardContent>
        </Card>
      )}

      {/* Product Images */}
      {product.product.images && (product.product.images as any[]).length > 0 && (
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                {t('editCustomProduct.images')}
                <span className="text-muted-foreground font-normal ml-1 text-xs">
                  {t('editCustomProduct.selectedCount', { count: selectedImageUrls.length })}
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={imageUploading}
                  onClick={async () => {
                    const imgs = await pickAndUpload('custom-products', true);
                    if (imgs.length) {
                      const newUrls = imgs.map((i) => i.url);
                      setSelectedImageUrls((prev) => [...prev, ...newUrls]);
                      if (!featuredImageUrl) setFeaturedImageUrl(newUrls[0]!);
                    }
                  }}
                >
                  {imageUploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
                  {t('editCustomProduct.upload')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {selectedImageUrls.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                {t('editCustomProduct.noImagesYet')}
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {selectedImageUrls.map((url, i) => {
                  const imgUrl = resolveUrl(url);
                  const isFeatured = url === featuredImageUrl;
                  return (
                    <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border-2 border-zinc-200">
                      {imgUrl && <img src={imgUrl} alt="" className="w-full h-full object-cover" />}
                      {isFeatured && (
                        <div className="absolute top-1 left-1 bg-amber-500 text-white rounded-full p-0.5">
                          <Star className="w-3 h-3 fill-current" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                        {!isFeatured && (
                          <button
                            type="button"
                            onClick={() => setFeaturedImageUrl(url)}
                            className="p-1.5 bg-white rounded-full shadow text-amber-600 hover:text-amber-700"
                            title={t('editCustomProduct.setAsFeatured')}
                          >
                            <Star className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImageUrls((prev) => prev.filter((u) => u !== url));
                            if (featuredImageUrl === url) {
                              const remaining = selectedImageUrls.filter((u) => u !== url);
                              setFeaturedImageUrl(remaining[0] || null);
                            }
                          }}
                          className="p-1.5 bg-white rounded-full shadow text-red-500 hover:text-red-600"
                          title={tc('remove')}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Select from base product */}
            {(product.product.images as any[])?.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('editCustomProduct.selectFromBase')}</p>
                <div className="grid grid-cols-6 gap-1.5">
                  {(product.product.images as any[]).map((img: any, i: number) => {
                    const imgUrl = resolveUrl(img.url);
                    const isSelected = selectedImageUrls.includes(img.url);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedImageUrls((prev) => prev.filter((u) => u !== img.url));
                            if (featuredImageUrl === img.url) {
                              const remaining = selectedImageUrls.filter((u) => u !== img.url);
                              setFeaturedImageUrl(remaining[0] || null);
                            }
                          } else {
                            setSelectedImageUrls((prev) => [...prev, img.url]);
                            if (!featuredImageUrl) setFeaturedImageUrl(img.url);
                          }
                        }}
                        className={`relative aspect-square rounded-md overflow-hidden border-2 transition ${
                          isSelected ? 'border-zinc-900 ring-1 ring-zinc-900' : 'border-zinc-200 hover:border-zinc-400 opacity-60 hover:opacity-100'
                        }`}
                      >
                        {imgUrl && <img src={imgUrl} alt="" className="w-full h-full object-cover" />}
                        {isSelected && (
                          <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-zinc-900 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pricing */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t('editCustomProduct.pricing')}</CardTitle>
        </CardHeader>
        <CardContent>
          <PricingStrategySelector
            pricingType={pricingType}
            onPricingTypeChange={setPricingType}
            finalPrice={finalPrice}
            onFinalPriceChange={setFinalPrice}
            marginAmount={marginAmount}
            onMarginAmountChange={setMarginAmount}
            variantPrices={variantPrices}
            onVariantPriceChange={(vid, price) =>
              setVariantPrices((prev) => ({ ...prev, [vid]: price }))
            }
            selectedVariants={selectedVariantsForPricing}
            basePrice={basePrice}
          />
        </CardContent>
      </Card>

      {/* Details — with language tabs */}
      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{t('editCustomProduct.details')}</CardTitle>
        </CardHeader>

        {hasMultipleLocales && (
          <div className="flex items-center gap-0 border-b px-6">
            {allLocales.map((locale) => {
              const isDone = !!translations[locale]?.title?.trim();
              const isActive = locale === activeLocale;
              return (
                <button
                  key={locale}
                  type="button"
                  onClick={() => setActiveLocale(locale)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition -mb-px ${
                    isActive ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  {LOCALE_LABELS[locale] || locale.toUpperCase()}
                  {locale !== primaryLocale && isDone && <Check className="w-3 h-3 text-emerald-500" />}
                  {locale === primaryLocale && <span className="text-[9px] text-zinc-400">{t('editCustomProduct.primaryParen')}</span>}
                </button>
              );
            })}
          </div>
        )}

        <CardContent className="space-y-4 pt-4">
          {activeLocale !== primaryLocale && (
            <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-lg border border-dashed">
              <span className="text-xs text-muted-foreground">
                {t('editCustomProduct.autoTranslateFrom')} <strong>{LOCALE_LABELS[primaryLocale] || primaryLocale}</strong>
                {primaryTitle ? `: "${primaryTitle.substring(0, 35)}${primaryTitle.length > 35 ? '…' : ''}"` : ''}
              </span>
              <button
                type="button"
                onClick={() => handleTranslateTo(activeLocale)}
                disabled={!!translatingLocale || !primaryTitle.trim()}
                className="flex items-center gap-1 text-xs text-primary font-medium hover:underline disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ml-3"
              >
                {translatingLocale === activeLocale ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> {t('editCustomProduct.translating')}</>
                ) : (
                  <><Languages className="w-3 h-3" /> {t('editCustomProduct.autoTranslate')}</>
                )}
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">
              {t('editCustomProduct.titleLabel')} {activeLocale === primaryLocale && <span className="text-red-500">*</span>}
            </Label>
            <Input
              dir={isRtl ? 'rtl' : 'ltr'}
              className="h-8 text-sm"
              placeholder={
                activeLocale === primaryLocale
                  ? t('editCustomProduct.titlePlaceholder')
                  : t('editCustomProduct.titleInLocale', { locale: LOCALE_LABELS[activeLocale] || activeLocale })
              }
              value={translations[activeLocale]?.title || ''}
              onChange={(e) => setTransField(activeLocale, 'title', e.target.value)}
            />
          </div>

          {activeLocale === primaryLocale && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t('editCustomProduct.slugLabel')}</Label>
              <Input
                className={`h-8 text-sm font-mono ${
                  slugStatus === 'taken' ? 'border-red-400 focus-visible:ring-red-400' : ''
                }`}
                value={translations[primaryLocale]?.slug || ''}
                onChange={(e) => setTransField(primaryLocale, 'slug', e.target.value)}
              />
              {slugStatus === 'checking' && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> {t('editCustomProduct.checkingAvailability')}
                </p>
              )}
              {slugStatus === 'available' && (
                <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                  <Check className="w-3 h-3" /> {t('editCustomProduct.slugAvailable')}
                </p>
              )}
              {slugStatus === 'taken' && (
                <p className="text-[11px] text-red-600">
                  {t('editCustomProduct.slugTaken')}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">{t('editCustomProduct.descriptionLabel')}</Label>
            <RichTextEditor
              content={translations[activeLocale]?.description || ''}
              onChange={(val) => setTransField(activeLocale, 'description', val)}
              placeholder={t('editCustomProduct.descriptionPlaceholder')}
            />
          </div>
        </CardContent>
      </Card>

      {/* FAQs */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t('editCustomProduct.faq')}</CardTitle>
        </CardHeader>
        <CardContent>
          <FaqManager
            productId={id}
            faqs={faqs}
            onChange={setFaqs}
            locales={allLocales}
            primaryLocale={primaryLocale}
            createUrl={`/custom-products/${id}/faqs`}
            faqBaseUrl="/custom-products/faqs"
          />
        </CardContent>
      </Card>

      {/* ═══ END LEFT COLUMN ═══ */}
      </div>

      {/* ═══ RIGHT COLUMN ═══ (sticky sidebar) */}
      <div className="lg:sticky lg:top-4 space-y-4">

        {/* Status & Review */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{t('editCustomProduct.statusReview')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {product.status === 'PENDING_REVIEW' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                <p className="font-semibold">{t('editCustomProduct.pendingReviewTitle')}</p>
                <p className="mt-0.5">{t('editCustomProduct.pendingReviewDesc')}</p>
              </div>
            )}
            {product.status === 'REJECTED' && product.rejection_reason && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <p className="font-semibold">{t('editCustomProduct.changesRequestedTitle')}</p>
                <p className="mt-0.5 whitespace-pre-wrap">{product.rejection_reason}</p>
                <p className="mt-1.5 text-[10px] text-red-600">
                  {t('editCustomProduct.changesRequestedHint')}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">{t('editCustomProduct.statusLabel')}</Label>
              {product.status === 'PENDING_REVIEW' ? (
                <div className="h-9 px-3 flex items-center rounded-md border bg-zinc-50 text-sm text-zinc-600">
                  {t('editCustomProduct.pendingReviewLocked')}
                </div>
              ) : (
                <SearchableSelect
                  value={status}
                  onChange={setStatus}
                  placeholder={t('editCustomProduct.selectStatus')}
                  options={requiresReview ? buildStatusOptionsReview(t) : buildStatusOptionsFree(t)}
                />
              )}
              {requiresReview && (
                <p className="text-[10px] text-muted-foreground">
                  {t('editCustomProduct.needsApprovalHint')}
                </p>
              )}
            </div>

            {canSubmitForReview && (
              <Button
                type="button"
                size="sm"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleSubmitForReview}
                disabled={saving}
              >
                {saving ? t('editCustomProduct.submitting') : product.status === 'REJECTED' ? t('editCustomProduct.resubmitForReview') : t('editCustomProduct.submitForReview')}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="shadow-none">
          <CardContent className="py-3 space-y-2">
            <Button
              size="sm"
              className="w-full"
              onClick={handleSave}
              disabled={
                saving ||
                slugStatus === 'checking' ||
                slugStatus === 'taken' ||
                (!translations[primaryLocale]?.title?.trim() &&
                  !product.translations.find((tr) => tr.locale === primaryLocale)?.title?.trim())
              }
            >
              {saving ? tc('saving') : t('editCustomProduct.saveChanges')}
            </Button>
            {saved && (
              <p className="text-xs text-emerald-600 font-medium text-center">{t('editCustomProduct.savedExclaim')}</p>
            )}
            {saveError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 space-y-1">
                <div className="flex items-start gap-1.5">
                  <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                  <p className="font-medium leading-relaxed">{saveError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSaveError('')}
                  className="text-[10px] text-red-500 hover:underline pl-5"
                >
                  {t('editCustomProduct.dismiss')}
                </button>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-red-500 border-red-200 hover:bg-red-50"
              onClick={() => setDeleteConfirm(true)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> {tc('delete')}
            </Button>
          </CardContent>
        </Card>

        {/* Collections */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{t('editCustomProduct.collections')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground mb-2">
              {t('editCustomProduct.collectionsDesc')}
            </p>
            <CollectionsMultiSelect
              value={creatorCategoryIds}
              onChange={setCreatorCategoryIds}
            />
          </CardContent>
        </Card>

        {/* Bundles */}
        <Card className="shadow-none">
          <CardContent className="pt-5">
            <BundlePicker
              value={bundleIds}
              onChange={setBundleIds}
              productPricing={
                product
                  ? computeProductPricingForBundleCheck({
                      pricingType,
                      baseProviderPrice: Number(product.product.base_price),
                      hasProvider: Boolean(product.product.provider_id),
                      finalPrice: parseFloat(finalPrice) || 0,
                      marginAmount: parseFloat(marginAmount) || 0,
                      selectedVariants: selectedVariantsForPricing.map((v) => ({
                        id: v.id,
                        price_adjustment: Number(v.price_adjustment) || 0,
                      })),
                      variantCustomPrices: Object.fromEntries(
                        Object.entries(variantPrices).map(([k, v]) => [
                          k,
                          parseFloat(v) || 0,
                        ]),
                      ),
                    })
                  : undefined
              }
            />
          </CardContent>
        </Card>

      {/* ═══ END RIGHT COLUMN ═══ */}
      </div>

      {/* ═══ END GRID ═══ */}
      </div>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('editCustomProduct.deleteTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {t('editCustomProduct.deleteConfirm')}
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(false)}>{tc('cancel')}</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>{tc('delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
