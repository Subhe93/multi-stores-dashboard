'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Plus,
  ArrowLeft,
  Loader2,
  Languages,
} from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { BundleOfferEditor } from './BundleOfferEditor';
import { BundlePreview } from './BundlePreview';
import { BundleTemplatesDialog } from './BundleTemplatesDialog';
import { ProductMultiSelect, type ProductOption } from './ProductMultiSelect';
import {
  LOCALE_LABELS,
  RTL_LOCALES,
  pickTranslation,
  type Bundle,
  type BundleOffer,
  type BundleStatus,
  type BundleTemplate,
  type BundleTranslation,
} from './types';

// dnd-kit needs a string id per item that survives reorders.
// Offers from the API have a real id; new offers get a temporary local id.
interface OfferWithKey extends BundleOffer {
  _key: string;
}
let localOfferCounter = 0;
function nextLocalKey(): string {
  localOfferCounter += 1;
  return `new_${Date.now()}_${localOfferCounter}`;
}
function attachKey(o: BundleOffer): OfferWithKey {
  return { ...o, _key: o.id || nextLocalKey() };
}

interface Props {
  mode: 'create' | 'edit';
  initial?: Bundle;
}

interface OverviewResp {
  primary_locale: string;
  secondary_locales: string[];
}

const FALLBACK_LOCALES: OverviewResp = {
  primary_locale: 'en',
  secondary_locales: [],
};

function blankOffer(sortOrder: number): OfferWithKey {
  return {
    quantity: 1,
    discount_type: 'PERCENTAGE',
    discount_value: 10,
    external_ref: null,
    sort_order: sortOrder,
    translations: [{ locale: 'en', title: '', label: '', sticker_text: '' }],
    _key: nextLocalKey(),
  };
}

function templateToOffers(tpl: BundleTemplate, primary: string): OfferWithKey[] {
  return tpl.offers.map((o, idx) => ({
    quantity: o.quantity,
    discount_type: o.discount_type,
    discount_value: o.discount_value,
    external_ref: null,
    sort_order: idx,
    translations: [
      {
        locale: primary,
        title: '',
        label: o.label ?? '',
        sticker_text: '',
      },
    ],
    _key: nextLocalKey(),
  }));
}

function friendlyError(err: unknown): { message: string; firstField?: string } {
  if (!err || typeof err !== 'object') return { message: 'Something went wrong. Please try again.' };
  const e = err as { message?: string; errors?: string[] };
  const errors = e.errors ?? [];
  const first = errors[0];
  if (first) {
    const m = first.toLowerCase();
    if (m.includes('translations') && m.includes('name')) {
      return { message: 'Bundle name is required.', firstField: 'bundle-name' };
    }
    if (m.includes('offers') && m.includes('arrayminsize')) {
      return { message: 'Add at least one offer to the bundle.', firstField: 'offers' };
    }
    if (m.includes('offers') && m.includes('title')) {
      return { message: 'Each offer needs a title in the primary language.', firstField: 'offers' };
    }
    if (m.includes('quantity')) {
      return { message: 'Quantity must be at least 1.', firstField: 'offers' };
    }
    if (m.includes('discount_value')) {
      return { message: 'Discount value cannot be negative.', firstField: 'offers' };
    }
    if (m.includes('below provider cost')) {
      return { message: first, firstField: 'offers' };
    }
    return { message: first };
  }
  return { message: e.message || 'Something went wrong. Please try again.' };
}

export function BundleForm({ mode, initial }: Props) {
  const { token, user } = useAuth();
  const router = useRouter();

  const [overview, setOverview] = useState<OverviewResp>(FALLBACK_LOCALES);
  const [overviewLoaded, setOverviewLoaded] = useState(false);

  const [nameTranslations, setNameTranslations] = useState<Record<string, string>>({});
  const [activeNameLocale, setActiveNameLocale] = useState('en');
  const [translatingName, setTranslatingName] = useState('');

  const [offers, setOffers] = useState<OfferWithKey[]>([]);
  // Picker stores prefixed ids: "p:<id>" for own Product, "cp:<id>" for CustomProduct.
  // We split them into two arrays at submit time.
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const [status, setStatus] = useState<BundleStatus>('ACTIVE');

  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const offersAnchorRef = useRef<HTMLDivElement>(null);
  const nameAnchorRef = useRef<HTMLDivElement>(null);

  const locales = useMemo(() => {
    const all = [overview.primary_locale, ...overview.secondary_locales];
    return Array.from(new Set(all.filter(Boolean)));
  }, [overview]);

  const primaryLocale = overview.primary_locale;

  // Load translations overview to derive locale tabs.
  useEffect(() => {
    if (!token) return;
    api<OverviewResp>('/translations/overview', { token })
      .then((res) => {
        setOverview({
          primary_locale: res?.primary_locale || 'en',
          secondary_locales: res?.secondary_locales || [],
        });
      })
      .catch(() => {})
      .finally(() => setOverviewLoaded(true));
  }, [token]);

  // Initialize from existing bundle (edit mode) or seed defaults (create mode) once overview is known.
  useEffect(() => {
    if (!overviewLoaded) return;
    if (mode === 'edit' && initial) {
      const map: Record<string, string> = {};
      for (const t of initial.translations) map[t.locale] = t.name;
      setNameTranslations(map);
      setOffers(
        initial.offers
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((o, idx) => attachKey({ ...o, sort_order: idx })),
      );
      setPickedIds([
        ...initial.products.map((p) => `p:${p.product_id}`),
        ...(initial.custom_products ?? []).map(
          (cp) => `cp:${cp.custom_product_id}`,
        ),
      ]);
      setStatus(initial.status);
      setActiveNameLocale(primaryLocale);
    } else {
      setNameTranslations({ [primaryLocale]: '' });
      setOffers([blankOffer(0)]);
      setActiveNameLocale(primaryLocale);
    }
  }, [mode, initial, overviewLoaded, primaryLocale]);

  // Load creator's products (both kinds) for the picker.
  useEffect(() => {
    if (!token) return;
    interface ProductTranslation {
      locale: string;
      title: string;
    }
    interface CustomProductRow {
      id: string;
      final_price?: number | string;
      pricing_type?: 'SINGLE' | 'PER_VARIANT' | 'MARGIN';
      margin_amount?: number | string | null;
      translations?: ProductTranslation[];
      mockup_images?: { url: string }[];
      selected_variants?: { custom_price?: number | string | null }[];
      product?: {
        base_price?: number | string;
        translations?: ProductTranslation[];
        images?: { url: string }[];
      };
    }
    interface OwnProductRow {
      id: string;
      creator_id?: string | null;
      base_price?: number | string;
      translations?: ProductTranslation[];
      images?: { url: string; is_featured?: boolean }[];
    }
    let cancelled = false;

    const fetchCustom = api<{ data: CustomProductRow[] }>(
      '/custom-products?limit=200',
      { token },
    ).catch(() => ({ data: [] as CustomProductRow[] }));

    const cid = user?.creator?.id;
    const fetchOwn = cid
      ? api<{ data: OwnProductRow[] }>(
          `/products?creator_id=${cid}&limit=200`,
          { token },
        ).catch(() => ({ data: [] as OwnProductRow[] }))
      : Promise.resolve({ data: [] as OwnProductRow[] });

    Promise.all([fetchCustom, fetchOwn])
      .then(([customRes, ownRes]) => {
        if (cancelled) return;
        const custom: ProductOption[] = (customRes?.data || []).map((p) => {
          const t =
            p.translations?.find((tr) => tr.locale === primaryLocale) ||
            p.translations?.[0] ||
            p.product?.translations?.find((tr) => tr.locale === primaryLocale) ||
            p.product?.translations?.[0];
          // Reference unit price for preview math — matches the same formula
          // orders.service uses, so the preview reflects reality.
          const base = Number(p.product?.base_price ?? 0);
          const margin = Number(p.margin_amount ?? 0);
          let unitPrice = 0;
          if (p.pricing_type === 'MARGIN') {
            unitPrice = base + margin;
          } else if (p.pricing_type === 'PER_VARIANT') {
            const customPrices = (p.selected_variants ?? [])
              .map((sv) => Number(sv.custom_price ?? 0))
              .filter((n) => n > 0);
            unitPrice = customPrices.length
              ? Math.min(...customPrices)
              : Number(p.final_price ?? base);
          } else {
            unitPrice = Number(p.final_price ?? base);
          }
          return {
            id: `cp:${p.id}`,
            name: `${t?.title || 'Untitled product'} · custom`,
            thumbnail:
              p.mockup_images?.[0]?.url ||
              p.product?.images?.[0]?.url ||
              null,
            unitPrice,
            pricingType: p.pricing_type,
          };
        });
        const own: ProductOption[] = (ownRes?.data || []).map((p) => {
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
            thumbnail: featured,
            unitPrice: Number(p.base_price ?? 0),
            pricingType: 'SINGLE',
          };
        });
        setProductOptions([...own, ...custom]);
      })
      .finally(() => {
        if (!cancelled) setProductsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, primaryLocale, user?.creator?.id]);

  const handleTranslateName = async (target: string) => {
    if (!token || translatingName) return;
    const source = nameTranslations[primaryLocale]?.trim();
    if (!source) return;
    setTranslatingName(target);
    try {
      const res = await api<{ translated: string }>(
        '/translations/translate-text',
        {
          method: 'POST',
          token,
          body: JSON.stringify({
            text: source,
            source_locale: primaryLocale,
            target_locale: target,
          }),
        },
      );
      setNameTranslations((prev) => ({ ...prev, [target]: res?.translated || prev[target] || '' }));
    } catch {
      // swallow
    } finally {
      setTranslatingName('');
    }
  };

  const validate = (): { ok: boolean; message?: string; field?: string } => {
    const primaryName = (nameTranslations[primaryLocale] || '').trim();
    if (!primaryName) {
      return {
        ok: false,
        message: 'Bundle name is required.',
        field: 'bundle-name',
      };
    }
    if (offers.length === 0) {
      return {
        ok: false,
        message: 'Add at least one offer to the bundle.',
        field: 'offers',
      };
    }
    for (let i = 0; i < offers.length; i++) {
      const offer = offers[i];
      const primaryTitle = offer.translations.find((t) => t.locale === primaryLocale)?.title?.trim();
      if (!primaryTitle) {
        return {
          ok: false,
          message: `Offer ${i + 1} needs a title in the primary language.`,
          field: 'offers',
        };
      }
      if (!Number.isFinite(offer.quantity) || offer.quantity < 1) {
        return {
          ok: false,
          message: `Offer ${i + 1}: quantity must be at least 1.`,
          field: 'offers',
        };
      }
      if (!Number.isFinite(offer.discount_value) || offer.discount_value < 0) {
        return {
          ok: false,
          message: `Offer ${i + 1}: discount value cannot be negative.`,
          field: 'offers',
        };
      }
      if (offer.discount_type === 'PERCENTAGE' && offer.discount_value > 100) {
        return {
          ok: false,
          message: `Offer ${i + 1}: percentage discount cannot exceed 100.`,
          field: 'offers',
        };
      }
    }
    return { ok: true };
  };

  const focusField = (field: string) => {
    if (field === 'bundle-name') {
      nameAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (field === 'offers') {
      offersAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const buildPayload = () => {
    const translations: BundleTranslation[] = Object.entries(nameTranslations)
      .filter(([, v]) => v.trim())
      .map(([locale, name]) => ({ locale, name: name.trim() }));

    const offersOut = offers.map((o, idx) => ({
      quantity: o.quantity,
      discount_type: o.discount_type,
      discount_value: o.discount_value,
      external_ref: o.external_ref?.trim() || undefined,
      sort_order: idx,
      translations: o.translations
        .filter((t) => t.title?.trim())
        .map((t) => ({
          locale: t.locale,
          title: t.title.trim(),
          label: t.label?.trim() || undefined,
          sticker_text: t.sticker_text?.trim() || undefined,
        })),
    }));

    const product_ids: string[] = [];
    const custom_product_ids: string[] = [];
    for (const raw of pickedIds) {
      if (raw.startsWith('p:')) product_ids.push(raw.slice(2));
      else if (raw.startsWith('cp:')) custom_product_ids.push(raw.slice(3));
    }

    return {
      status,
      translations,
      offers: offersOut,
      product_ids,
      custom_product_ids,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setErrorField('');
    const v = validate();
    if (!v.ok) {
      setError(v.message || 'Please fix the highlighted fields.');
      setErrorField(v.field || '');
      if (v.field) focusField(v.field);
      return;
    }
    if (!token) return;

    setSaving(true);
    try {
      const payload = buildPayload();
      if (mode === 'create') {
        await api('/bundles', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
      } else if (initial) {
        await api(`/bundles/${initial.id}`, {
          method: 'PUT',
          token,
          body: JSON.stringify(payload),
        });
      }
      router.push('/creator/bundles');
    } catch (err) {
      const f = friendlyError(err);
      setError(f.message);
      setErrorField(f.firstField || '');
      if (f.firstField) focusField(f.firstField);
    } finally {
      setSaving(false);
    }
  };

  const updateOffer = (idx: number, next: BundleOffer) => {
    setOffers((prev) =>
      prev.map((o, i) => (i === idx ? { ...next, _key: o._key } : o)),
    );
  };

  const addOffer = () => {
    setOffers((prev) => [...prev, blankOffer(prev.length)]);
  };

  const removeOffer = (idx: number) => {
    setOffers((prev) =>
      prev.filter((_, i) => i !== idx).map((o, i) => ({ ...o, sort_order: i })),
    );
  };

  const applyTemplate = (tpl: BundleTemplate) => {
    if (tpl.offers.length === 0) {
      setOffers([blankOffer(0)]);
    } else {
      setOffers(templateToOffers(tpl, primaryLocale));
    }
  };

  // Derive a reference unit price for the preview: use the first attached
  // product's price (matches what the customer will actually see). Falls back
  // to a sample value when nothing is attached yet.
  const previewContext = useMemo(() => {
    const firstId = pickedIds[0];
    if (!firstId) return { unitPrice: 50, pricingType: undefined as ProductOption['pricingType'] };
    const opt = productOptions.find((o) => o.id === firstId);
    if (!opt) return { unitPrice: 50, pricingType: undefined as ProductOption['pricingType'] };
    return {
      unitPrice: opt.unitPrice && opt.unitPrice > 0 ? opt.unitPrice : 50,
      pricingType: opt.pricingType,
    };
  }, [pickedIds, productOptions]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOffers((prev) => {
      const oldIndex = prev.findIndex((o) => o._key === active.id);
      const newIndex = prev.findIndex((o) => o._key === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex).map((o, i) => ({
        ...o,
        sort_order: i,
      }));
    });
  };

  const previewOffers = offers;
  const showSecondaryLocales = locales.length > 1;
  const nameDir = RTL_LOCALES.has(activeNameLocale) ? 'rtl' : 'ltr';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push('/creator/bundles')}
          aria-label="Back to bundles"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === 'create' ? 'Create bundle' : 'Edit bundle'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Group quantity-tier offers and attach them to one or more products.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={status}
            onChange={(e) => setStatus(e.target.value as BundleStatus)}
          >
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </select>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving…
              </>
            ) : mode === 'create' ? (
              'Create bundle'
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div ref={nameAnchorRef}>
          <Card className={`shadow-none ${errorField === 'bundle-name' ? 'ring-destructive/60' : ''}`}>
            <CardHeader>
              <CardTitle className="text-sm">Bundle name</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {showSecondaryLocales && (
                <div className="flex items-center gap-0 border-b">
                  {locales.map((locale) => (
                    <button
                      key={locale}
                      type="button"
                      onClick={() => setActiveNameLocale(locale)}
                      className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-medium transition ${
                        locale === activeNameLocale
                          ? 'border-zinc-900 text-zinc-900'
                          : 'border-transparent text-zinc-400 hover:text-zinc-600'
                      }`}
                    >
                      {LOCALE_LABELS[locale] || locale.toUpperCase()}
                      {locale === primaryLocale && (
                        <span className="ml-1 text-[9px] text-zinc-400">(primary)</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {activeNameLocale !== primaryLocale && (
                <div className="flex items-center justify-between rounded-lg border border-dashed bg-zinc-50 p-2.5">
                  <span className="text-xs text-muted-foreground">
                    Auto-translate from{' '}
                    <strong>{LOCALE_LABELS[primaryLocale] || primaryLocale}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTranslateName(activeNameLocale)}
                    disabled={!!translatingName}
                    className="ml-3 flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {translatingName === activeNameLocale ? (
                      <>
                        <Loader2 className="size-3 animate-spin" /> Translating…
                      </>
                    ) : (
                      <>
                        <Languages className="size-3" /> Auto-translate
                      </>
                    )}
                  </button>
                </div>
              )}

              <div dir={nameDir} className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Bundle name
                  {activeNameLocale === primaryLocale && (
                    <span className="text-red-500"> *</span>
                  )}
                </Label>
                <Input
                  className="h-9 text-sm"
                  placeholder="e.g. Bundle A"
                  value={nameTranslations[activeNameLocale] || ''}
                  onChange={(e) =>
                    setNameTranslations((prev) => ({
                      ...prev,
                      [activeNameLocale]: e.target.value,
                    }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Give your bundle a name so you can recognize it when you want to attach it to a product.
                </p>
              </div>
            </CardContent>
          </Card>
          </div>

          <div ref={offersAnchorRef} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Offers
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({offers.length})
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setShowTemplates(true)}
                className="text-xs font-medium text-primary hover:underline"
              >
                Load from template
              </button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={offers.map((o) => o._key)}
                strategy={verticalListSortingStrategy}
              >
                {offers.map((offer, idx) => (
                  <BundleOfferEditor
                    key={offer._key}
                    id={offer._key}
                    index={idx}
                    offer={offer}
                    locales={locales}
                    primaryLocale={primaryLocale}
                    onChange={(next) => updateOffer(idx, next)}
                    onRemove={() => removeOffer(idx)}
                  />
                ))}
              </SortableContext>
            </DndContext>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addOffer}
              className="w-full"
            >
              <Plus className="size-4" /> Add another offer
            </Button>
          </div>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-sm">Attached products</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ProductMultiSelect
                options={productOptions}
                value={pickedIds}
                onChange={setPickedIds}
                loading={productsLoading}
              />
              <p className="text-[11px] text-muted-foreground">
                The bundle will appear on the storefront pages of the selected products. Leave empty to keep it inactive on storefront.
              </p>
            </CardContent>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <BundlePreview
            offers={previewOffers}
            primaryLocale={primaryLocale}
            unitPrice={previewContext.unitPrice}
            pricingType={previewContext.pricingType}
          />
        </aside>
      </div>

      <BundleTemplatesDialog
        open={showTemplates}
        onOpenChange={setShowTemplates}
        onPick={applyTemplate}
      />
    </form>
  );
}

export function defaultBundleNameFromTranslations(b: Bundle, primary: string): string {
  return pickTranslation(b.translations, primary)?.name || 'Untitled bundle';
}
