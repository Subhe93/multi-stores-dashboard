'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  ArrowRight,
  Package,
  RefreshCw,
  Languages,
  Loader2,
  Check,
  Upload,
  Star,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useImageUpload } from '@/lib/useImageUpload';
import ImportModeSelector from '@/components/creator/ImportModeSelector';
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

// ── Types ────────────────────────────────────────────────

interface ProductTranslation { locale: string; title: string; description?: string; }
interface ProductImage { url: string; is_featured: boolean; sort_order: number; }
interface ProductVariant {
  id: string;
  sku: string | null;
  price_adjustment: number;
  stock_quantity: number | null;
  options: Record<string, string>;
  images?: ProductImage[];
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
interface VariantOptionConfig {
  name: string;
  style: 'text' | 'color' | 'image';
  values: string[];
  colorMap?: Record<string, string>;
  dualColorMap?: Record<string, [string, string]>;
}
interface Product {
  id: string;
  translations: ProductTranslation[];
  base_price: number;
  images: ProductImage[];
  variants?: ProductVariant[];
  variant_option_config?: VariantOptionConfig[];
  custom_fields?: ProductCustomField[];
  faqs?: { sort_order: number; translations: { locale: string; question: string; answer: string }[] }[];
  provider?: { id: string; company_name: string };
}

type ImportMode = 'AS_IS' | 'CUSTOMIZE';
type PricingType = 'SINGLE' | 'PER_VARIANT' | 'MARGIN';
type LocaleTranslation = { title: string; description: string; slug: string };

// ── Error helpers ────────────────────────────────────────
// The backend uses class-validator with whitelist + forbidNonWhitelisted, which
// returns terse messages like "translations.0.property id should not exist" and
// "final_price must be a positive number". Map them to friendlier guidance.

type Translator = ReturnType<typeof useTranslations>;

function friendlyErrorPatterns(t: Translator): { pattern: RegExp; message: string; stepKey?: string }[] {
  return [
    { pattern: /property\s+\w+\s+should not exist/i, message: t('customProductForm.errFaqData'), stepKey: 'faqs' },
    { pattern: /translations.*should not be empty|translations.*must be an array/i, message: t('customProductForm.errTitleEmpty'), stepKey: 'details' },
    { pattern: /(title|slug).*should not be empty/i, message: t('customProductForm.errTitleSlugRequired'), stepKey: 'details' },
    { pattern: /final_price.*positive/i, message: t('customProductForm.errFinalPrice'), stepKey: 'pricing' },
    { pattern: /margin_amount.*positive/i, message: t('customProductForm.errMargin'), stepKey: 'pricing' },
    { pattern: /selected_variants.*not be empty/i, message: t('customProductForm.errSelectVariant'), stepKey: 'variants' },
    { pattern: /custom_price.*positive/i, message: t('customProductForm.errVariantPrice'), stepKey: 'pricing' },
    { pattern: /question.*should not be empty/i, message: t('customProductForm.errFaqQuestion'), stepKey: 'faqs' },
    { pattern: /import_mode/i, message: t('customProductForm.errImportMode'), stepKey: 'mode' },
    // Bundle economics violations are already user-readable from the backend; keep
    // the full message and point the user back to the pricing/bundle section.
    { pattern: /below provider cost/i, message: '', stepKey: 'pricing' },
  ];
}

function formatSubmitError(err: any, t: Translator): string {
  const raw: string[] = Array.isArray(err?.errors)
    ? err.errors
    : err?.message
    ? [err.message]
    : [];
  if (raw.length === 0) return t('customProductForm.failedCreate');

  const patterns = friendlyErrorPatterns(t);
  const friendly = new Set<string>();
  for (const msg of raw) {
    const match = patterns.find((p) => p.pattern.test(msg));
    // An empty `message` means: pass the original through unchanged (used for
    // already-friendly backend messages like the bundle economics violation).
    friendly.add(match ? (match.message || msg) : msg);
  }
  return Array.from(friendly).join(' • ');
}

function stepKeyFromError(err: any, t: Translator): string | null {
  const raw: string[] = Array.isArray(err?.errors) ? err.errors : err?.message ? [err.message] : [];
  const patterns = friendlyErrorPatterns(t);
  for (const msg of raw) {
    const match = patterns.find((p) => p.pattern.test(msg));
    if (match?.stepKey) return match.stepKey;
  }
  return null;
}

// ── Component ────────────────────────────────────────────

export default function NewCustomProductPage() {
  const { fmt } = useCurrency();
  const { token } = useAuth();
  const router = useRouter();
  const t = useTranslations('creator');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const preselectedProductId = searchParams.get('product_id');

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [productDetails, setProductDetails] = useState<Product | null>(null);

  // Form state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [importMode, setImportMode] = useState<ImportMode | null>(null);
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, { value?: string; file_url?: string }>>({});
  const [pricingType, setPricingType] = useState<PricingType>('SINGLE');
  const [finalPrice, setFinalPrice] = useState('');
  const [marginAmount, setMarginAmount] = useState('');
  const [variantPrices, setVariantPrices] = useState<Record<string, string>>({});
  const [selectedImageUrls, setSelectedImageUrls] = useState<string[]>([]);
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null);
  const { pickAndUpload, uploading: imageUploading } = useImageUpload(token);
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // FAQs (local draft — saved after custom product is created)
  const [faqDrafts, setFaqDrafts] = useState<Faq[]>([]);
  const [bundleIds, setBundleIds] = useState<string[]>([]);
  const [creatorCategoryIds, setCreatorCategoryIds] = useState<string[]>([]);

  // Slug availability check — debounced, primary-locale only.
  type SlugStatus = 'idle' | 'checking' | 'available' | 'taken';
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');

  // Language
  const [primaryLocale, setPrimaryLocale] = useState('en');
  const [allLocales, setAllLocales] = useState<string[]>(['en']);
  const [activeLocale, setActiveLocale] = useState('en');
  const [translations, setTranslations] = useState<Record<string, LocaleTranslation>>({
    en: { title: '', description: '', slug: '' },
  });
  const [translatingLocale, setTranslatingLocale] = useState('');

  // Step tracking
  const [currentStep, setCurrentStep] = useState(1);

  const setTransField = (locale: string, field: keyof LocaleTranslation, value: string) => {
    setTranslations((prev) => ({ ...prev, [locale]: { ...prev[locale], [field]: value } }));
  };

  // ── Data fetching ──────────────────────────────────────

  useEffect(() => {
    if (!token) return;
    api<any>('/stores/my/store', { token })
      .then((store) => {
        const primary: string = store.language_config?.primary_locale || 'en';
        const secondary: string[] = store.language_config?.secondary_locales || [];
        const all = [primary, ...secondary.filter((l: string) => l !== primary)];
        setPrimaryLocale(primary);
        setAllLocales(all);
        setActiveLocale(primary);
        setTranslations(() => {
          const next: Record<string, LocaleTranslation> = {};
          all.forEach((l) => { next[l] = { title: '', description: '', slug: '' }; });
          return next;
        });
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams({ limit: '100' });
    if (productSearch.trim()) params.set('search', productSearch.trim());
    api<any>(`/products?${params.toString()}`, { token })
      .then((res) => {
        const allProducts: Product[] = res?.data ?? res ?? [];
        setProducts(allProducts);
        if (preselectedProductId && !selectedProduct) {
          const found = allProducts.find((p) => p.id === preselectedProductId);
          if (found) {
            setSelectedProduct(found);
            fetchProductDetails(found.id);
          }
        }
      })
      .catch(console.error);
  }, [token, productSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced slug availability check against the backend. We only check the
  // primary-locale slug — secondary translations don't drive the storefront URL.
  useEffect(() => {
    if (!token) return;
    const slug = (translations[primaryLocale]?.slug || '').trim();
    if (!slug) {
      setSlugStatus('idle');
      return;
    }
    setSlugStatus('checking');
    const handle = setTimeout(async () => {
      try {
        const res = await api<{ available: boolean }>(
          `/custom-products/check-slug?slug=${encodeURIComponent(slug)}`,
          { token },
        );
        setSlugStatus(res?.available ? 'available' : 'taken');
      } catch {
        setSlugStatus('idle');
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [token, translations, primaryLocale]);

  const fetchProductDetails = async (productId: string) => {
    if (!token) return;
    try {
      const details = await api<Product>(`/products/${productId}/import-details`, { token });
      setProductDetails(details);
      // Pre-populate FAQ drafts from base product. Only keep whitelisted fields —
      // backend DTO rejects extras like id/faq_id from the source records.
      if (details.faqs && details.faqs.length > 0) {
        setFaqDrafts(
          details.faqs.map((f, i) => ({
            sort_order: i,
            translations: f.translations.map((tr) => ({
              locale: tr.locale,
              question: tr.question,
              answer: tr.answer,
            })),
          })),
        );
      } else {
        setFaqDrafts([]);
      }
    } catch (err) {
      console.error('Failed to fetch product details:', err);
    }
  };

  // ── Helpers ────────────────────────────────────────────

  const filteredProducts = products;

  const getPrimaryImage = (product: Product): string | null => {
    const primary = product.images?.find((img) => img.is_featured) ?? product.images?.[0];
    if (!primary?.url) return null;
    return primary.url.startsWith('http') ? primary.url : `${API_BASE}${primary.url}`;
  };

  const generateSlug = (value: string) =>
    value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const handleTitleChange = (value: string) => {
    setTransField(activeLocale, 'title', value);
    if (activeLocale === primaryLocale) {
      const currentSlug = translations[primaryLocale]?.slug || '';
      const prevTitle = translations[primaryLocale]?.title || '';
      if (!currentSlug || currentSlug === generateSlug(prevTitle)) {
        setTransField(primaryLocale, 'slug', generateSlug(value));
      }
    }
  };

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

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    fetchProductDetails(product.id);
    setImportMode(null);
    setSelectedVariantIds([]);
    setSelectedImageUrls([]);
    setFieldValues({});
    setPricingType('SINGLE');
    setFinalPrice('');
    setMarginAmount('');
    setVariantPrices({});
    setFaqDrafts([]);
  };

  const handleImportModeChange = (mode: ImportMode) => {
    setImportMode(mode);
    if (mode === 'AS_IS') {
      if (productDetails?.variants) setSelectedVariantIds(productDetails.variants.map((v) => v.id));
      if (productDetails?.images) setSelectedImageUrls(productDetails.images.map((img) => img.url));
    } else {
      setSelectedVariantIds([]);
      setSelectedImageUrls([]);
    }
  };

  // ── Step definitions ───────────────────────────────────

  const basePrice = productDetails ? Number(productDetails.base_price) : 0;
  const hasCustomFields = (productDetails?.custom_fields?.length ?? 0) > 0;
  const hasVariants = (productDetails?.variants?.length ?? 0) > 0;

  const getSteps = () => {
    const steps: { key: string; title: string }[] = [];
    if (!preselectedProductId) {
      steps.push({ key: 'product', title: t('customProductForm.stepChooseProduct') });
    }
    steps.push({ key: 'mode', title: t('customProductForm.stepImportMode') });
    if (importMode === 'CUSTOMIZE') {
      if (hasVariants) steps.push({ key: 'variants', title: t('customProductForm.stepSelectVariants') });
      if (hasCustomFields) steps.push({ key: 'fields', title: t('customProductForm.stepCustomFields') });
    }
    steps.push({ key: 'pricing', title: t('customProductForm.stepPricing') });
    steps.push({ key: 'details', title: t('customProductForm.stepProductDetails') });
    steps.push({ key: 'faqs', title: t('customProductForm.stepFaq') });
    return steps;
  };

  const steps = getSteps();
  const totalSteps = steps.length;
  const currentStepDef = steps[currentStep - 1];

  const selectedVariantsForPricing = importMode === 'AS_IS'
    ? (productDetails?.variants || [])
    : (productDetails?.variants || []).filter((v) => selectedVariantIds.includes(v.id));

  // ── Navigation ─────────────────────────────────────────

  const canGoNext = () => {
    if (!currentStepDef) return false;
    switch (currentStepDef.key) {
      case 'product':  return !!selectedProduct && !!productDetails;
      case 'mode':     return !!importMode;
      case 'variants': return selectedVariantIds.length > 0;
      case 'fields':   return true;
      case 'pricing':
        if (pricingType === 'SINGLE') return !!finalPrice && !isNaN(parseFloat(finalPrice));
        if (pricingType === 'MARGIN') return !!marginAmount && !isNaN(parseFloat(marginAmount));
        if (pricingType === 'PER_VARIANT') {
          const variantIdsForPricing = importMode === 'AS_IS'
            ? (productDetails?.variants || []).map((v) => v.id)
            : selectedVariantIds;
          return variantIdsForPricing.length > 0 && variantIdsForPricing.every((id) => variantPrices[id] && !isNaN(parseFloat(variantPrices[id])));
        }
        return false;
      case 'details':  return !!(translations[primaryLocale]?.title?.trim() && translations[primaryLocale]?.slug?.trim()) && slugStatus !== 'taken' && slugStatus !== 'checking';
      case 'faqs':     return true;
      default:         return false;
    }
  };

  const goNext = () => { if (currentStep < totalSteps) setCurrentStep(currentStep + 1); };
  const goBack = () => { if (currentStep > 1) setCurrentStep(currentStep - 1); };

  // ── Submit ─────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!token || !selectedProduct || !importMode) return;
    setSaving(true);
    setSubmitError('');
    try {
      const translationsPayload = Object.entries(translations)
        .filter(([, tr]) => tr.title.trim())
        .map(([locale, tr]) => ({
          locale,
          title: tr.title,
          description: tr.description || undefined,
          slug: tr.slug || generateSlug(tr.title).substring(0, 100),
        }));

      const body: any = {
        product_id: selectedProduct.id,
        import_mode: importMode,
        pricing_type: pricingType,
        translations: translationsPayload,
      };

      if (pricingType === 'SINGLE')  body.final_price   = parseFloat(finalPrice);
      if (pricingType === 'MARGIN')  body.margin_amount = parseFloat(marginAmount);

      // Send selected_variants for CUSTOMIZE mode or PER_VARIANT pricing
      const variantIdsToSend = importMode === 'AS_IS' && pricingType === 'PER_VARIANT'
        ? (productDetails?.variants || []).map((v) => v.id)
        : selectedVariantIds;

      if (variantIdsToSend.length > 0) {
        body.selected_variants = variantIdsToSend.map((id) => ({
          variant_id: id,
          ...(pricingType === 'PER_VARIANT' ? { custom_price: parseFloat(variantPrices[id] || '0') } : {}),
        }));
      }

      const fieldEntries = Object.entries(fieldValues).filter(([, v]) => v.value?.trim() || v.file_url?.trim());
      if (fieldEntries.length > 0) {
        body.field_values = fieldEntries.map(([custom_field_id, data]) => ({
          custom_field_id,
          value: data.value || undefined,
          file_url: data.file_url || undefined,
        }));
      }

      if (selectedImageUrls.length > 0) {
        // Featured image first (sort_order=0)
        const sorted = featuredImageUrl
          ? [featuredImageUrl, ...selectedImageUrls.filter((u) => u !== featuredImageUrl)]
          : selectedImageUrls;
        body.mockup_image_urls = sorted;
      }

      if (bundleIds.length > 0) {
        body.bundle_ids = bundleIds;
      }

      if (creatorCategoryIds.length > 0) {
        body.creator_category_ids = creatorCategoryIds;
      }

      // Create custom product
      const created = await api<{ id: string }>('/custom-products', { method: 'POST', token, body: JSON.stringify(body) });

      // Save FAQ drafts to the new custom product. Sanitize translations to only
      // whitelisted fields — backend rejects any extras.
      if (faqDrafts.length > 0 && created?.id) {
        await Promise.all(
          faqDrafts
            .filter((f) => f.translations.some((tr) => tr.question.trim()))
            .map((f, i) =>
              api(`/custom-products/${created.id}/faqs`, {
                method: 'POST',
                token,
                body: JSON.stringify({
                  sort_order: i,
                  translations: f.translations
                    .filter((tr) => tr.question.trim())
                    .map((tr) => ({
                      locale: tr.locale,
                      question: tr.question,
                      answer: tr.answer || '',
                    })),
                }),
              }),
            ),
        );
      }

      // Redirect to edit page so the creator can submit for review or finalize details
      router.push(created?.id ? `/creator/custom-products/${created.id}` : '/creator/custom-products');
    } catch (err: any) {
      setSubmitError(formatSubmitError(err, t));
      const targetKey = stepKeyFromError(err, t);
      if (targetKey) {
        const idx = steps.findIndex((s) => s.key === targetKey);
        if (idx >= 0) setCurrentStep(idx + 1);
      }
    } finally {
      setSaving(false);
    }
  };

  const isRtl = RTL_LOCALES.includes(activeLocale);
  const hasMultipleLocales = allLocales.length > 1;
  const primaryTitle = translations[primaryLocale]?.title || '';
  const isLastStep = currentStep === totalSteps;

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('customProductForm.newTitle')}</h1>
          <p className="text-sm text-muted-foreground">
            {preselectedProductId
              ? t('customProductForm.subtitlePreselected')
              : t('customProductForm.subtitle')}
          </p>
        </div>
      </div>

      {/* Preselected base product banner */}
      {preselectedProductId && selectedProduct && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-zinc-50">
          <div className="w-10 h-10 rounded overflow-hidden border bg-white flex items-center justify-center shrink-0">
            {getPrimaryImage(selectedProduct) ? (
              <img src={getPrimaryImage(selectedProduct)!} alt="" className="w-full h-full object-cover" />
            ) : (
              <Package className="w-4 h-4 text-zinc-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground">{t('customProductForm.baseProduct')}</p>
            <p className="text-sm font-medium truncate">
              {selectedProduct.translations.find((tr) => tr.locale === 'en')?.title ??
                selectedProduct.translations[0]?.title ??
                '—'}
            </p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {fmt(selectedProduct.base_price)}
          </span>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-1 flex-wrap">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-center gap-1">
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-semibold ${
                i + 1 === currentStep
                  ? 'bg-zinc-900 text-white'
                  : i + 1 < currentStep
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-zinc-100 text-zinc-400'
              }`}
            >
              {i + 1 < currentStep ? <Check className="w-3 h-3" /> : i + 1}
            </div>
            <span
              className={`text-[11px] hidden sm:inline ${
                i + 1 === currentStep ? 'text-zinc-900 font-medium' : 'text-zinc-400'
              }`}
            >
              {step.title}
            </span>
            {i < steps.length - 1 && <div className="w-4 h-px bg-zinc-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            {currentStep}. {currentStepDef?.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* ── Step: Choose Product ── */}
          {currentStepDef?.key === 'product' && (
            <>
              <Input
                placeholder={t('customProductForm.searchProducts')}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
                {filteredProducts.length === 0 ? (
                  <p className="py-6 text-xs text-muted-foreground text-center">{t('customProductForm.noProducts')}</p>
                ) : (
                  filteredProducts.map((product) => {
                    const name =
                      product.translations.find((tr) => tr.locale === 'en')?.title ??
                      product.translations[0]?.title ?? '—';
                    const img = getPrimaryImage(product);
                    const isSelected = selectedProduct?.id === product.id;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleSelectProduct(product)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted transition ${
                          isSelected ? 'ring-2 ring-inset ring-zinc-900 bg-zinc-50' : ''
                        }`}
                      >
                        <div className="w-8 h-8 rounded overflow-hidden border bg-zinc-100 flex items-center justify-center shrink-0">
                          {img ? (
                            <img src={img} alt={name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-4 h-4 text-zinc-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{name}</p>
                          {product.provider && (
                            <p className="text-[11px] text-muted-foreground">{product.provider.company_name}</p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {fmt(product.base_price)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* ── Step: Import Mode ── */}
          {currentStepDef?.key === 'mode' && (
            productDetails ? (
              <ImportModeSelector value={importMode} onChange={handleImportModeChange} />
            ) : (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                {t('customProductForm.loadingProduct')}
              </div>
            )
          )}

          {/* ── Step: Select Variants ── */}
          {currentStepDef?.key === 'variants' && productDetails?.variants && (
            <VariantSelector
              variants={productDetails.variants}
              selectedIds={selectedVariantIds}
              onChange={setSelectedVariantIds}
              basePrice={basePrice}
            />
          )}

          {/* ── Step: Custom Fields ── */}
          {currentStepDef?.key === 'fields' && productDetails?.custom_fields && (
            <CustomFieldRenderer
              fields={productDetails.custom_fields}
              values={fieldValues}
              onChange={(fieldId, data) =>
                setFieldValues((prev) => ({ ...prev, [fieldId]: data }))
              }
              locale={primaryLocale}
              token={token}
            />
          )}

          {/* ── Step: Pricing ── */}
          {currentStepDef?.key === 'pricing' && (
            <PricingStrategySelector
              pricingType={pricingType}
              onPricingTypeChange={setPricingType}
              finalPrice={finalPrice}
              onFinalPriceChange={setFinalPrice}
              marginAmount={marginAmount}
              onMarginAmountChange={setMarginAmount}
              variantPrices={variantPrices}
              onVariantPriceChange={(id, price) =>
                setVariantPrices((prev) => ({ ...prev, [id]: price }))
              }
              selectedVariants={selectedVariantsForPricing}
              basePrice={basePrice}
              variantOptionConfig={productDetails?.variant_option_config}
            />
          )}

          {/* ── Step: Product Details ── */}
          {currentStepDef?.key === 'details' && (
            <>
              {/* Images — upload + select from base product */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">
                    {t('customProductForm.images')}
                    <span className="text-muted-foreground font-normal ml-1">{t('customProductForm.selectedCount', { count: selectedImageUrls.length })}</span>
                  </Label>
                  <Button
                    type="button"
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
                    {t('customProductForm.upload')}
                  </Button>
                </div>

                {/* Current selected images with featured + remove */}
                {selectedImageUrls.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {selectedImageUrls.map((url, i) => {
                      const imgUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
                      const isFeatured = url === featuredImageUrl;
                      return (
                        <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border-2 border-zinc-200">
                          <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                          {isFeatured && (
                            <div className="absolute top-1 left-1 bg-amber-500 text-white rounded-full p-0.5">
                              <Star className="w-3 h-3 fill-current" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                            {!isFeatured && (
                              <button type="button" onClick={() => setFeaturedImageUrl(url)}
                                className="p-1.5 bg-white rounded-full shadow text-amber-600 hover:text-amber-700" title={t('customProductForm.setAsFeatured')}>
                                <Star className="w-3 h-3" />
                              </button>
                            )}
                            <button type="button" onClick={() => {
                              setSelectedImageUrls((prev) => prev.filter((u) => u !== url));
                              if (featuredImageUrl === url) {
                                const remaining = selectedImageUrls.filter((u) => u !== url);
                                setFeaturedImageUrl(remaining[0] || null);
                              }
                            }} className="p-1.5 bg-white rounded-full shadow text-red-500 hover:text-red-600" title={tc('remove')}>
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Select from base product */}
                {productDetails?.images && productDetails.images.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">{t('customProductForm.selectFromBase')}</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {productDetails.images.map((img, i) => {
                        const imgUrl = img.url.startsWith('http') ? img.url : `${API_BASE}${img.url}`;
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
                            <img src={imgUrl} alt="" className="w-full h-full object-cover" />
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
              </div>

              {/* Language tabs */}
              {hasMultipleLocales && (
                <div className="flex items-center gap-0 border-b">
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
                        {locale === primaryLocale && <span className="text-[9px] text-zinc-400">{t('customProductForm.primaryParen')}</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Auto-translate */}
              {activeLocale !== primaryLocale && (
                <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-lg border border-dashed">
                  <span className="text-xs text-muted-foreground">
                    {t('customProductForm.autoTranslateFrom')} <strong>{LOCALE_LABELS[primaryLocale] || primaryLocale}</strong>
                    {primaryTitle ? `: "${primaryTitle.substring(0, 35)}${primaryTitle.length > 35 ? '…' : ''}"` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTranslateTo(activeLocale)}
                    disabled={!!translatingLocale || !primaryTitle.trim()}
                    className="flex items-center gap-1 text-xs text-primary font-medium hover:underline disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ml-3"
                  >
                    {translatingLocale === activeLocale ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> {t('customProductForm.translating')}</>
                    ) : (
                      <><Languages className="w-3 h-3" /> {t('customProductForm.autoTranslate')}</>
                    )}
                  </button>
                </div>
              )}

              {/* Copy title & description from the original product —
                  positioned right above Title so the creator notices it
                  exactly when filling in title/description. */}
              {productDetails && (
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-xs text-blue-700">
                    {t('customProductForm.copyFromOriginalDesc')}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
                    onClick={() => {
                      allLocales.forEach((locale) => {
                        const origTrans = productDetails.translations.find((tr) => tr.locale === locale);
                        if (origTrans) {
                          setTransField(locale, 'title', origTrans.title || '');
                          if (origTrans.description) setTransField(locale, 'description', origTrans.description);
                        }
                      });
                      const primaryTrans = productDetails.translations.find((tr) => tr.locale === primaryLocale);
                      if (primaryTrans?.title) setTransField(primaryLocale, 'slug', generateSlug(primaryTrans.title));
                    }}
                  >
                    {t('customProductForm.copyFromOriginal')}
                  </Button>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {t('customProductForm.titleLabel')} {activeLocale === primaryLocale && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  dir={isRtl ? 'rtl' : 'ltr'}
                  className="h-8 text-sm"
                  placeholder={activeLocale === primaryLocale ? t('customProductForm.titlePlaceholder') : t('customProductForm.titleInLocale', { locale: LOCALE_LABELS[activeLocale] || activeLocale })}
                  value={translations[activeLocale]?.title || ''}
                  onChange={(e) => handleTitleChange(e.target.value)}
                />
              </div>

              {/* Slug */}
              {activeLocale === primaryLocale && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t('customProductForm.slugLabel')} <span className="text-red-500">*</span></Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="my-custom-product"
                      value={translations[primaryLocale]?.slug || ''}
                      onChange={(e) => setTransField(primaryLocale, 'slug', generateSlug(e.target.value))}
                      className={`h-8 text-sm font-mono ${
                        slugStatus === 'taken' ? 'border-red-400 focus-visible:ring-red-400' : ''
                      }`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setTransField(primaryLocale, 'slug', generateSlug(translations[primaryLocale]?.title || ''))}
                      title={t('customProductForm.regenerateSlug')}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {slugStatus === 'checking' && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> {t('customProductForm.checkingAvailability')}
                    </p>
                  )}
                  {slugStatus === 'available' && (
                    <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                      <Check className="w-3 h-3" /> {t('customProductForm.slugAvailable')}
                    </p>
                  )}
                  {slugStatus === 'taken' && (
                    <p className="text-[11px] text-red-600">
                      {t('customProductForm.slugTaken')}
                    </p>
                  )}
                </div>
              )}

              {/* Collections — let the creator add this product to one or more of their collections */}
              {activeLocale === primaryLocale && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t('customProductForm.collections')}</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {t('customProductForm.collectionsDesc')}
                  </p>
                  <CollectionsMultiSelect
                    value={creatorCategoryIds}
                    onChange={setCreatorCategoryIds}
                  />
                </div>
              )}

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('customProductForm.descriptionLabel')}</Label>
                <RichTextEditor
                  content={translations[activeLocale]?.description || ''}
                  onChange={(val) => setTransField(activeLocale, 'description', val)}
                  placeholder={t('customProductForm.descriptionPlaceholder')}
                />
              </div>
            </>
          )}

          {/* ── Step: FAQ ── */}
          {currentStepDef?.key === 'faqs' && (
            <div className="space-y-3">
              {faqDrafts.length === 0 && (
                <p className="text-xs text-muted-foreground pb-1">
                  {t('customProductForm.noFaqsFromBase')}
                </p>
              )}
              {faqDrafts.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-700">
                    {t('customProductForm.faqsCopiedFromBase', { count: faqDrafts.length })}
                  </p>
                </div>
              )}
              <FaqManager
                faqs={faqDrafts}
                onChange={setFaqDrafts}
                locales={allLocales}
                primaryLocale={primaryLocale}
              />

              <div className="mt-6 border-t pt-4">
                <BundlePicker
                  value={bundleIds}
                  onChange={setBundleIds}
                  productPricing={
                    selectedProduct
                      ? computeProductPricingForBundleCheck({
                          pricingType,
                          baseProviderPrice: Number(selectedProduct.base_price),
                          hasProvider: Boolean(selectedProduct.provider?.id),
                          finalPrice: parseFloat(finalPrice) || 0,
                          marginAmount: parseFloat(marginAmount) || 0,
                          selectedVariants: selectedVariantsForPricing.map(
                            (v) => ({
                              id: v.id,
                              price_adjustment: Number(v.price_adjustment) || 0,
                            }),
                          ),
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
              </div>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Error message */}
      {submitError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <p className="font-medium mb-1">{t('customProductForm.couldNotSave')}</p>
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

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={goBack} disabled={currentStep === 1 || saving}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          {tc('back')}
        </Button>
        <div className="flex items-center gap-2">
          {isLastStep ? (
            <Button size="sm" onClick={handleSubmit} disabled={saving || !canGoNext()}>
              {saving ? t('customProductForm.creating') : t('customProductForm.createCustomProduct')}
            </Button>
          ) : (
            <Button size="sm" onClick={goNext} disabled={!canGoNext()}>
              {tc('next')}
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
