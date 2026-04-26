'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, Languages, Check } from 'lucide-react';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { VariantManager, type VariantOption, type GeneratedVariant } from './VariantManager';
import { CustomFieldManager, type CustomField } from './CustomFieldManager';
import FaqManager, { type Faq } from './FaqManager';
import { useImageUpload } from '@/lib/useImageUpload';
import { ImageGallery } from './ImageGallery';
import { TagInput } from '@/components/common/TagInput';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useCurrency } from '@/lib/useCurrency';

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────
const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
  tr: 'Türkçe',
  de: 'Deutsch',
  fr: 'Français',
};
const RTL_LOCALES = ['ar'];

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

// Translation state per locale
type LocaleTranslation = { title: string; description: string };

export function ProductForm({ mode, productId, backUrl, postCreateUrl }: ProductFormProps) {
  const { currency } = useCurrency();
  const { token } = useAuth();
  const router = useRouter();

  // ── UI state ──────────────────────────────────────────────
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Language config ───────────────────────────────────────
  const [primaryLocale, setPrimaryLocale] = useState('en');
  const [allLocales, setAllLocales] = useState<string[]>(['en']);
  const [activeLocale, setActiveLocale] = useState('en');
  // translations[locale] = { title, description }
  const [translations, setTranslations] = useState<Record<string, LocaleTranslation>>({
    en: { title: '', description: '' },
  });
  const [translatingLocale, setTranslatingLocale] = useState('');

  // ── Other product fields ───────────────────────────────────
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryAttrs, setCategoryAttrs] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [slug, setSlug] = useState('');
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
  const [attrValues, setAttrValues] = useState<Record<string, any>>({});
  const [images, setImages] = useState<any[]>([]);
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([]);
  const [variants, setVariants] = useState<GeneratedVariant[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [shippingProfiles, setShippingProfiles] = useState<{ id: string; name: string; is_default: boolean }[]>([]);
  const [shippingProfileId, setShippingProfileId] = useState('');

  const { pickAndUpload, uploading } = useImageUpload(token);

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
    api<any>('/stores/my/store', { token })
      .then(store => {
        const primary: string = store.language_config?.primary_locale || 'en';
        const secondary: string[] = store.language_config?.secondary_locales || [];
        const all = [primary, ...secondary.filter((l: string) => l !== primary)];
        setPrimaryLocale(primary);
        setAllLocales(all);
        setActiveLocale(primary);
        // initialise empty slots for every locale
        setTranslations(prev => {
          const next: Record<string, LocaleTranslation> = {};
          all.forEach(l => { next[l] = prev[l] || { title: '', description: '' }; });
          return next;
        });
      })
      .catch(() => {}); // no store yet — keep defaults
  }, [token]);

  // ── Fetch shipping profiles ────────────────────────────────
  useEffect(() => {
    if (!token) return;
    api<any[]>('/shipping/profiles', { token })
      .then(profiles => setShippingProfiles(Array.isArray(profiles) ? profiles : []))
      .catch(() => {});
  }, [token]);

  // ── Fetch categories ──────────────────────────────────────
  useEffect(() => {
    api<any[]>('/categories').then(cats => {
      const flat: any[] = [];
      const flatten = (items: any[], prefix = '') => {
        for (const c of items) {
          const name = c.translations?.find((t: any) => t.locale === 'en')?.name || c.slug;
          flat.push({ value: c.id, label: prefix + name });
          if (c.children) flatten(c.children, prefix + '— ');
        }
      };
      flatten(Array.isArray(cats) ? cats : []);
      setCategories(flat);
    });
  }, []);

  // ── Fetch product data (edit mode) ────────────────────────
  useEffect(() => {
    if (mode !== 'edit' || !token || !productId) return;
    api<any>(`/products/${productId}`, { token }).then(p => {
      const primaryT = p.translations?.find((t: any) => t.locale === primaryLocale) || p.translations?.[0];

      setCategoryId(p.category_id || '');
      setSlug(primaryT?.slug || '');
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
      setTags(p.tags?.map((t: any) => t.tag) || []);
      setStatus(p.status || 'DRAFT');
      setImages((p.images || []).filter((img: any) => !img.variant_id));
      setCustomFields(p.custom_fields || []);
      setFaqs(p.faqs || []);
      setShippingProfileId(p.shipping_profile_id || '');

      // Populate translations for all configured locales
      setTranslations(prev => {
        const next = { ...prev };
        (p.translations || []).forEach((t: any) => {
          next[t.locale] = { title: t.title || '', description: t.description || '' };
        });
        return next;
      });

      // Variants
      if (p.variants?.length > 0) {
        // Use persisted config if available (preserves styles, colorMap, etc.)
        if (Array.isArray(p.variant_option_config) && p.variant_option_config.length > 0) {
          setVariantOptions(p.variant_option_config);
        } else {
          // Fallback: reconstruct from variant data (old products without config)
          const optionNames = Object.keys(p.variants[0].options || {});
          const opts: VariantOption[] = optionNames.map(name => {
            const vals = p.variants.map((v: any) => String(v.options[name] || '')).filter(Boolean);
            return { name, style: 'text' as const, values: Array.from(new Set(vals)) };
          });
          setVariantOptions(opts);
        }
        const variantImageMap: Record<string, string> = {};
        (p.images || []).forEach((img: any) => {
          if (img.variant_id) variantImageMap[img.variant_id] = img.url;
        });
        setVariants(p.variants.map((v: any) => ({
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

      const av: Record<string, any> = {};
      (p.attributes || []).forEach((a: any) => { av[a.template_id] = a.value; });
      setAttrValues(av);
    }).catch(console.error).finally(() => setLoading(false));
  }, [mode, token, productId, primaryLocale]);

  // ── Fetch attrs when category changes ─────────────────────
  useEffect(() => {
    if (!categoryId) { setCategoryAttrs([]); return; }
    api<any[]>(`/categories/${categoryId}/attributes`)
      .then(attrs => setCategoryAttrs(Array.isArray(attrs) ? attrs : []))
      .catch(() => setCategoryAttrs([]));
  }, [categoryId]);

  // ── Auto-slug from primary locale title ───────────────────
  useEffect(() => {
    if (primaryTitle && mode === 'create' && !slug) {
      setSlug(primaryTitle.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').substring(0, 100));
    }
  }, [primaryTitle, mode]);

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
    if (!primaryTitle.trim()) errs.title = 'Title is required';
    if (!categoryId)          errs.categoryId = 'Category is required';
    if (!basePrice || parseFloat(basePrice) <= 0)
                              errs.basePrice = 'Price must be greater than 0';
    if (productType === 'CUSTOMIZABLE' && !customizationType)
                              errs.customizationType = 'Select a customization method';
    if (comparePrice && parseFloat(comparePrice) <= parseFloat(basePrice || '0'))
                              errs.comparePrice = 'Compare-at price must be higher than price';
    categoryAttrs.filter(a => a.is_required).forEach(a => {
      const val = attrValues[a.id];
      if (val === '' || val == null || val === false)
        errs[`attr_${a.id}`] = `${a.translations?.find((t: any) => t.locale === 'en')?.label || a.name} is required`;
    });
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError('Please fix the errors below before saving.');
      setTimeout(() => document.querySelector('[data-field-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      return false;
    }
    return true;
  };

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async (publishNow = false) => {
    if (!token) return;
    if (!validate()) return;
    setSaving(true);
    setError('');
    setFieldErrors({});

    try {
      const finalStatus = publishNow ? 'PUBLISHED' : status;

      // Build translations array from all locales that have a title
      const translationsPayload = Object.entries(translations)
        .filter(([, t]) => t.title.trim())
        .map(([locale, t]) => ({
          locale,
          title: t.title,
          description: t.description || '',
          slug: locale === primaryLocale
            ? (slug || primaryTitle.toLowerCase().replace(/\s+/g, '-'))
            : t.title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').substring(0, 100),
          ...(locale === primaryLocale
            ? { meta_title: metaTitle || undefined, meta_desc: metaDesc || undefined }
            : {}),
        }));

      const body: any = {
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
        status: finalStatus,
        translations: translationsPayload,
        attributes: Object.entries(attrValues).filter(([, v]) => v !== '' && v != null).map(([tid, value]) => ({ template_id: tid, value })),
        tags: tags.length > 0 ? tags : [],
      };

      let pid = productId;
      if (mode === 'create') {
        const product = await api<any>('/products', { method: 'POST', token: token ?? undefined, body: JSON.stringify(body) });
        pid = product.id;
      } else {
        await api(`/products/${pid}`, { method: 'PUT', token, body: JSON.stringify(body) });
      }

      // Variants
      const savedVariantIds: Map<string, string> = new Map();
      if (pid) {
        if (mode === 'edit') {
          const existing = await api<any[]>(`/products/${pid}/variants`, { token });
          for (const v of (Array.isArray(existing) ? existing : [])) {
            await api(`/variants/${v.id}`, { method: 'DELETE', token });
          }
        }
        for (const v of variants) {
          const saved = await api<any>(`/products/${pid}/variants`, {
            method: 'POST', token: token ?? undefined,
            body: JSON.stringify({
              options: v.options,
              price_adjustment: (v.price || 0) - (parseFloat(basePrice) || 0),
              compare_at_price: v.compare_at_price || undefined,
              sku: v.sku || undefined,
              stock_quantity: v.stock_quantity,
            }),
          });
          if (saved?.id) savedVariantIds.set(v._key, saved.id);
        }
      }

      // Images
      if (pid) {
        if (mode === 'edit') {
          const existingImages = await api<any[]>(`/products/${pid}/images`, { token });
          for (const img of (Array.isArray(existingImages) ? existingImages : [])) {
            await api(`/products/images/${img.id}`, { method: 'DELETE', token });
          }
        }
        for (let i = 0; i < images.length; i++) {
          const img = images[i]!;
          await api(`/products/${pid}/images`, {
            method: 'POST', token: token ?? undefined,
            body: JSON.stringify({ url: img.url, alt_text: img.alt_text, sort_order: i, is_featured: !!img.is_featured }),
          });
        }
        for (const v of variants) {
          if (v.image_url) {
            const variantId = savedVariantIds.get(v._key);
            await api(`/products/${pid}/images`, {
              method: 'POST', token: token ?? undefined,
              body: JSON.stringify({ url: v.image_url, sort_order: 999, is_featured: false, variant_id: variantId || undefined }),
            });
          }
        }
      }

      if (mode === 'create') {
        router.push(postCreateUrl ? `${postCreateUrl}/${pid}` : `/provider/products/${pid}`);
      } else {
        setSaved('Product saved!');
        setTimeout(() => setSaved(''), 3000);
      }
    } catch (err: any) {
      if (Array.isArray(err.errors)) setError(err.errors.join(' · '));
      else setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustomField = async (field: any) => {
    if (mode === 'edit' && productId && token) {
      await api(`/products/${productId}/custom-fields`, { method: 'POST', token: token ?? undefined, body: JSON.stringify(field) });
      const p = await api<any>(`/products/${productId}`, { token });
      setCustomFields(p.custom_fields || []);
    } else {
      setCustomFields(prev => [...prev, { ...field, id: `temp-${Date.now()}`, sort_order: prev.length }]);
    }
  };

  const handleUpdateCustomField = async (fid: string, field: any) => {
    if (token && !fid.startsWith('temp-')) {
      await api(`/custom-fields/${fid}`, { method: 'PUT', token, body: JSON.stringify(field) });
      if (productId) {
        const p = await api<any>(`/products/${productId}`, { token });
        setCustomFields(p.custom_fields || []);
        return;
      }
    }
    setCustomFields(prev => prev.map(f => f.id === fid ? { ...f, ...field, id: fid } : f));
  };

  const handleDeleteCustomField = async (fid: string) => {
    if (!window.confirm('Delete this custom field? This cannot be undone.')) return;
    if (token && !fid.startsWith('temp-')) {
      await api(`/custom-fields/${fid}`, { method: 'DELETE', token });
    }
    setCustomFields(prev => prev.filter(f => f.id !== fid));
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
            {mode === 'create' ? 'Add Product' : primaryTitle || 'Edit Product'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-emerald-600 font-medium">{saved}</span>}
          <Button variant="outline" size="sm" onClick={() => router.push(backUrl)}>Discard</Button>
          <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null} Save Draft
          </Button>
          <Button size="sm" onClick={() => handleSave(true)} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null} Publish
          </Button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg border border-red-200 mb-4">{error}</div>}

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
              {/* Translate button for secondary locales */}
              {activeLocale !== primaryLocale && (
                <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-lg border border-dashed">
                  <span className="text-xs text-muted-foreground">
                    Auto-translate from{' '}
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
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Translating...</>
                      : <><Languages className="w-3 h-3" /> Auto-translate</>}
                  </button>
                </div>
              )}

              {/* Title field */}
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Title {activeLocale === primaryLocale && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  dir={isRtl ? 'rtl' : 'ltr'}
                  placeholder={
                    activeLocale === primaryLocale
                      ? 'Premium Cotton T-Shirt'
                      : `Title in ${LOCALE_LABELS[activeLocale] || activeLocale}...`
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
                <Label className="text-xs">Description</Label>
                <RichTextEditor
                  content={translations[activeLocale]?.description || ''}
                  onChange={val => setTransField(activeLocale, 'description', val)}
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
          <VariantManager
            options={variantOptions}
            onOptionsChange={setVariantOptions}
            variants={variants}
            onVariantsChange={setVariants}
            basePrice={parseFloat(basePrice) || 0}
            onPickImage={() => pickAndUpload('products', false)}
          />

          {/* Dynamic Attributes */}
          {categoryAttrs.length > 0 && (
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  Specifications
                  <Badge variant="secondary" className="ml-2 text-[10px]">{categoryAttrs.length} fields</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {categoryAttrs.map((attr: any) => {
                    const label = attr.translations?.find((t: any) => t.locale === 'en')?.label || attr.name;
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
                            <span className="text-xs">Yes</span>
                          </label>
                        ) : attr.type === 'SELECT' && Array.isArray(attr.options) ? (
                          <SearchableSelect
                            value={attrValues[attr.id] || ''}
                            onChange={v => { setAttrValues({ ...attrValues, [attr.id]: v }); clearErr(); }}
                            placeholder={`Select ${label}...`}
                            options={attr.options.map((o: string) => ({ value: o, label: o }))}
                          />
                        ) : (
                          <Input
                            className={`h-8 text-sm ${fieldErrors[errKey] ? 'border-red-400' : ''}`}
                            placeholder={attr.unit ? `(${attr.unit})` : ''}
                            value={attrValues[attr.id] || ''}
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
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">SEO</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5"><Label className="text-xs">Page title</Label><Input className="h-8 text-sm" value={metaTitle} onChange={e => setMetaTitle(e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Meta description</Label>
                <textarea rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs" value={metaDesc} onChange={e => setMetaDesc(e.target.value)} />
              </div>
              <div className="space-y-1.5"><Label className="text-xs">URL slug</Label><Input className="h-8 text-sm font-mono" value={slug} onChange={e => setSlug(e.target.value)} /></div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Status</CardTitle></CardHeader>
            <CardContent>
              <SearchableSelect value={status} onChange={setStatus} options={[
                { value: 'DRAFT', label: 'Draft', description: 'Not visible' },
                { value: 'PUBLISHED', label: 'Published', description: 'Live in store' },
                { value: 'ARCHIVED', label: 'Archived', description: 'Hidden' },
              ]} />
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Product Type</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <label className="flex items-center gap-2.5 p-2.5 border rounded-lg cursor-pointer hover:bg-zinc-50 transition has-checked:border-primary has-checked:bg-primary/5">
                <input type="radio" name="pt" value="TRADITIONAL" checked={productType === 'TRADITIONAL'} onChange={() => setProductType('TRADITIONAL')} className="accent-primary" />
                <div><p className="text-xs font-medium">Traditional</p><p className="text-[10px] text-muted-foreground">Sold as-is</p></div>
              </label>
              <label className="flex items-center gap-2.5 p-2.5 border rounded-lg cursor-pointer hover:bg-zinc-50 transition has-checked:border-primary has-checked:bg-primary/5">
                <input type="radio" name="pt" value="CUSTOMIZABLE" checked={productType === 'CUSTOMIZABLE'} onChange={() => setProductType('CUSTOMIZABLE')} className="accent-primary" />
                <div><p className="text-xs font-medium">Customizable</p><p className="text-[10px] text-muted-foreground">Print, engrave, etc.</p></div>
              </label>
              {productType === 'CUSTOMIZABLE' && (
                <>
                  <SearchableSelect
                    value={customizationType}
                    onChange={v => { setCustomizationType(v); if (fieldErrors.customizationType) setFieldErrors(p => ({ ...p, customizationType: '' })); }}
                    placeholder="Method..."
                    options={[
                      { value: 'PRINT', label: 'Print' }, { value: 'ENGRAVE', label: 'Engrave' },
                      { value: 'PRINT_3D', label: '3D Print' }, { value: 'EMBROIDERY', label: 'Embroidery' },
                      { value: 'HANDMADE', label: 'Handmade' }, { value: 'OTHER', label: 'Other' },
                    ]}
                  />
                  <FieldError msg={fieldErrors.customizationType} />
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Category</CardTitle></CardHeader>
            <CardContent>
              <SearchableSelect
                value={categoryId}
                onChange={v => { setCategoryId(v); if (fieldErrors.categoryId) setFieldErrors(p => ({ ...p, categoryId: '' })); }}
                placeholder="Select..." searchPlaceholder="Search..."
                options={categories}
              />
              <FieldError msg={fieldErrors.categoryId} />
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Pricing</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5"><Label className="text-xs">Price *</Label>
                <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currency}</span>
                  <Input type="number" step="0.01"
                    className={`pl-7 h-8 text-sm ${fieldErrors.basePrice ? 'border-red-400' : ''}`}
                    value={basePrice}
                    onChange={e => { setBasePrice(e.target.value); if (fieldErrors.basePrice) setFieldErrors(p => ({ ...p, basePrice: '' })); }}
                  /></div>
                <FieldError msg={fieldErrors.basePrice} />
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Compare at</Label>
                <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currency}</span>
                  <Input type="number" step="0.01"
                    className={`pl-7 h-8 text-sm ${fieldErrors.comparePrice ? 'border-red-400' : ''}`}
                    value={comparePrice}
                    onChange={e => { setComparePrice(e.target.value); if (fieldErrors.comparePrice) setFieldErrors(p => ({ ...p, comparePrice: '' })); }}
                  /></div>
                <FieldError msg={fieldErrors.comparePrice} />
              </div>
              <Separator />
              <div className="space-y-1.5"><Label className="text-xs">Cost per item</Label>
                <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currency}</span>
                  <Input type="number" step="0.01" className="pl-7 h-8 text-sm" value={costPrice} onChange={e => setCostPrice(e.target.value)} /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Inventory</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded accent-primary" checked={trackInventory} onChange={e => setTrackInventory(e.target.checked)} />
                <span className="text-xs font-medium">Track inventory</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">SKU</Label><Input className="h-8 text-sm font-mono" value={sku} onChange={e => setSku(e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Quantity</Label><Input type="number" className="h-8 text-sm" value={stockQty} onChange={e => setStockQty(e.target.value)} /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Shipping</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Shipping Profile</Label>
                <SearchableSelect
                  value={shippingProfileId}
                  onChange={setShippingProfileId}
                  options={[
                    { value: '', label: 'Use default profile' },
                    ...shippingProfiles.map(p => ({
                      value: p.id,
                      label: `${p.name}${p.is_default ? ' (Default)' : ''}`,
                    })),
                  ]}
                  placeholder="Select shipping profile..."
                />
                <p className="text-[10px] text-muted-foreground">
                  Manage profiles in{' '}
                  <Link href="/provider/shipping" className="text-primary hover:underline">
                    Shipping Settings
                  </Link>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Weight</Label><Input type="number" step="0.01" className="h-8 text-sm" value={weight} onChange={e => setWeight(e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Unit</Label>
                  <SearchableSelect value={weightUnit} onChange={setWeightUnit} options={[{ value: 'kg', label: 'kg' }, { value: 'g', label: 'g' }, { value: 'lb', label: 'lb' }]} /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Tags</CardTitle></CardHeader>
            <CardContent>
              <TagInput tags={tags} onChange={setTags} placeholder="Type tag and press Enter" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
