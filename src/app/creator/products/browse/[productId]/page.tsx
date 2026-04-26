'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, ShoppingBag, ChevronRight, Truck, Globe, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCurrency } from '@/lib/useCurrency';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '');

function resolveUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductImage {
  url: string;
  alt_text?: string;
  sort_order: number;
}

interface ProductVariant {
  id: string;
  sku?: string;
  price_adjustment: number;
  stock_quantity?: number;
  options: Record<string, string>;
  images?: ProductImage[];
}

interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  base_cost: number;
  per_item_cost: number;
  free_threshold?: number;
  estimated_days_min: number;
  estimated_days_max: number;
}

interface Product {
  id: string;
  base_price: number;
  images?: ProductImage[];
  category?: { translations: { locale: string; name: string }[] };
  translations: { locale: string; title: string; description?: string; slug?: string }[];
  variants?: ProductVariant[];
  variant_option_config?: {
    name: string;
    style: 'text' | 'color' | 'image';
    values: string[];
    colorMap?: Record<string, string>;
    dualColorMap?: Record<string, [string, string]>;
  }[];
  custom_fields?: { id: string; translations: { locale: string; label: string }[] }[];
  attributes?: { value: any; template: { translations: { locale: string; name: string }[] } }[];
  tags?: { tag: string }[];
  faqs?: { translations: { locale: string; question: string; answer: string }[] }[];
  provider?: { company_name: string };
  shipping_profile?: { name: string; zones: ShippingZone[] };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTrans(translations: { locale: string; title: string; description?: string }[]) {
  return translations.find((t) => t.locale === 'en') || translations[0];
}

function getCategoryName(translations?: { locale: string; name: string }[]) {
  if (!translations) return '';
  return translations.find((t) => t.locale === 'en')?.name || translations[0]?.name || '';
}

// Color swatch component
function ColorSwatch({ hex, dualHex, size = 28 }: { hex?: string; dualHex?: [string, string]; size?: number }) {
  const isLight = (color: string) => {
    const c = color.replace('#', '');
    if (c.length < 6) return true;
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 200;
  };

  if (dualHex) {
    return (
      <span
        className="inline-block rounded-full shrink-0"
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${dualHex[0]} 50%, ${dualHex[1]} 50%)`,
          border: '2px solid #e5e7eb',
        }}
      />
    );
  }
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: hex || '#ccc',
        border: isLight(hex || '#ccc') ? '2px solid #e5e7eb' : '2px solid transparent',
      }}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const { fmt } = useCurrency();
  const { productId } = useParams<{ productId: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token || !productId) return;
    setLoading(true);
    api<Product>(`/products/${productId}/import-details`, { token })
      .then((data) => setProduct(data))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [token, productId]);

  // Build option config lookup
  const optionConfig = useMemo(() => {
    const map: Record<string, NonNullable<Product['variant_option_config']>[0]> = {};
    product?.variant_option_config?.forEach((c) => { if (c.name) map[c.name] = c; });
    return map;
  }, [product?.variant_option_config]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground animate-pulse">Loading product…</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Package className="size-10 text-zinc-300" />
        <p className="text-sm text-muted-foreground">Product not found.</p>
        <Button variant="outline" size="sm" onClick={() => router.back()}>Go back</Button>
      </div>
    );
  }

  const trans = getTrans(product.translations);
  const images = product.images || [];
  const currentImage = images[selectedImage];

  // Compute active variant + display price
  const optionKeys = [...new Set(product.variants?.flatMap((v) => Object.keys(v.options || {})) || [])];
  const allOptionsSelected = optionKeys.length > 0 && optionKeys.every((k) => selectedOptions[k]);
  const activeVariant = allOptionsSelected
    ? product.variants?.find((v) =>
        Object.entries(selectedOptions).every(([k, val]) => v.options?.[k] === val)
      ) ?? null
    : null;
  const displayPrice = activeVariant
    ? Number(product.base_price) + Number(activeVariant.price_adjustment)
    : Number(product.base_price);
  const priceChanged = activeVariant && Number(activeVariant.price_adjustment) !== 0;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Back */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <span className="text-sm text-muted-foreground">Provider Catalog</span>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="text-sm font-medium truncate">{trans?.title || 'Product'}</span>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">

        {/* ── Left: Image gallery ── */}
        <div className="space-y-3 lg:sticky lg:top-24 self-start">
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-zinc-50 border">
            {currentImage ? (
              <img
                key={currentImage.url}
                src={resolveUrl(currentImage.url) || ''}
                alt={trans?.title || ''}
                className="h-full w-full object-contain p-6 transition-opacity duration-300"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="size-24 text-zinc-200" />
              </div>
            )}
            {images.length > 1 && (
              <span className="absolute bottom-3 right-3 px-2 py-1 text-xs font-semibold text-white bg-black/50 rounded-full backdrop-blur-sm">
                {selectedImage + 1} / {images.length}
              </span>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedImage(i)}
                  className={`shrink-0 rounded-xl overflow-hidden border-2 transition ${
                    i === selectedImage
                      ? 'border-zinc-900 shadow-sm opacity-100'
                      : 'border-zinc-200 hover:border-zinc-400 opacity-60 hover:opacity-100'
                  }`}
                  style={{ width: 72, height: 72 }}
                >
                  <img src={resolveUrl(img.url) || ''} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Product info ── */}
        <div className="space-y-5">
          {/* Provider */}
          {product.provider && (
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
              {product.provider.company_name}
            </p>
          )}

          {/* Title */}
          <h1 className="text-2xl font-bold leading-tight tracking-tight">{trans?.title || 'Untitled'}</h1>

          {/* Category */}
          {product.category && (
            <Badge variant="secondary" className="text-[10px]">
              {getCategoryName(product.category.translations)}
            </Badge>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-zinc-900">{fmt(displayPrice)}</span>
            {priceChanged && (
              <span className="text-sm text-muted-foreground line-through">
                {fmt(product.base_price)}
              </span>
            )}
            {!allOptionsSelected && optionKeys.length > 0 && (
              <span className="text-xs text-muted-foreground">Starting from</span>
            )}
          </div>

          {/* Variants — Smart rendering based on option style */}
          {optionKeys.length > 0 && (
            <div className="space-y-5">
              {optionKeys.map((key) => {
                const config = optionConfig[key];
                const style = config?.style || 'text';
                const values = [...new Set(
                  product.variants!.map((v) => v.options?.[key]).filter(Boolean) as string[]
                )];

                return (
                  <div key={key}>
                    {/* Label with selected value */}
                    <p className="text-sm font-semibold text-zinc-800 mb-2.5">
                      {key}
                      {selectedOptions[key] && (
                        <>
                          : <span className="font-normal text-zinc-500">{selectedOptions[key]}</span>
                        </>
                      )}
                    </p>

                    {/* Color swatches */}
                    {style === 'color' ? (
                      <div className="flex flex-wrap gap-2.5">
                        {values.map((val) => {
                          const isSelected = selectedOptions[key] === val;
                          const hex = config?.colorMap?.[val];
                          const dual = config?.dualColorMap?.[val];

                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setSelectedOptions((prev) => ({ ...prev, [key]: val }))}
                              title={val}
                              className={`relative rounded-full transition-all duration-150 cursor-pointer hover:scale-110 ${
                                isSelected ? 'ring-2 ring-offset-2 ring-zinc-900' : ''
                              }`}
                            >
                              <ColorSwatch hex={hex} dualHex={dual} size={36} />
                              {isSelected && (
                                <span className="absolute inset-0 flex items-center justify-center">
                                  <Check className="w-4 h-4" style={{
                                    color: hex && !dual
                                      ? (parseInt(hex.replace('#','').substring(0,2),16)*299 + parseInt(hex.replace('#','').substring(2,4),16)*587 + parseInt(hex.replace('#','').substring(4,6),16)*114)/1000 > 128
                                        ? '#000' : '#fff'
                                      : '#fff'
                                  }} strokeWidth={3} />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : style === 'image' ? (
                      /* Image-based options (e.g., Material) */
                      <div className="flex flex-wrap gap-2">
                        {values.map((val) => {
                          const isSelected = selectedOptions[key] === val;
                          // Find variant image for this option value
                          const matchedVariant = product.variants?.find(v => v.options?.[key] === val);
                          const imgUrl = matchedVariant?.images?.[0]?.url;

                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setSelectedOptions((prev) => ({ ...prev, [key]: val }))}
                              className={`relative w-16 h-16 rounded-xl border-2 overflow-hidden transition-all ${
                                isSelected
                                  ? 'border-zinc-900 shadow-md'
                                  : 'border-zinc-200 hover:border-zinc-400'
                              }`}
                              title={val}
                            >
                              {imgUrl ? (
                                <img src={resolveUrl(imgUrl)} alt={val} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-[10px] text-zinc-400 font-medium text-center p-1">
                                  {val}
                                </div>
                              )}
                              {isSelected && (
                                <div className="absolute top-1 right-1 w-4 h-4 bg-zinc-900 rounded-full flex items-center justify-center">
                                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      /* Text-based options (e.g., Size) */
                      <div className="flex flex-wrap gap-2">
                        {values.map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setSelectedOptions((prev) => ({ ...prev, [key]: val }))}
                            className={`min-w-12 px-4 py-2 rounded-lg border-2 text-sm font-medium text-center transition-all ${
                              selectedOptions[key] === val
                                ? 'bg-zinc-900 text-white border-zinc-900'
                                : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400 hover:shadow-sm'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Shipping Profile */}
          {product.shipping_profile && product.shipping_profile.zones.length > 0 && (
            <div className="rounded-xl border border-zinc-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-zinc-50 border-b">
                <Truck className="w-4 h-4 text-zinc-500" />
                <p className="text-xs font-semibold text-zinc-700">Shipping — {product.shipping_profile.name}</p>
              </div>
              <div className="divide-y">
                {product.shipping_profile.zones.map((zone) => (
                  <div key={zone.id} className="px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-zinc-800">{zone.name}</p>
                        <p className="text-[10px] text-zinc-400">
                          {zone.estimated_days_min}–{zone.estimated_days_max} days
                          {zone.countries.length > 0 && ` · ${zone.countries.slice(0, 3).join(', ')}${zone.countries.length > 3 ? ` +${zone.countries.length - 3}` : ''}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-zinc-800">{fmt(zone.base_cost)}</p>
                      {zone.free_threshold && (
                        <p className="text-[10px] text-green-600 font-medium">
                          Free over {fmt(zone.free_threshold)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <Button
            size="lg"
            className="w-full rounded-xl"
            onClick={() => router.push(`/creator/custom-products/new?product_id=${product.id}`)}
          >
            <ShoppingBag className="w-4 h-4 mr-2" />
            Add to My Store
          </Button>

          {/* Customizable notice */}
          {product.custom_fields && product.custom_fields.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <p className="text-xs font-semibold text-amber-800 mb-1">Customizable Product</p>
              <p className="text-xs text-amber-700">
                This product has {product.custom_fields.length} custom field(s) that customers can personalize.
              </p>
            </div>
          )}

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {product.tags.map((t, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">#{t.tag}</Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom: Description + Specs + FAQ ── */}
      <div className="border-t pt-8 space-y-8">

        {/* Description */}
        {trans?.description && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold">Description</h2>
            <div
              className="prose prose-sm max-w-none text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: trans.description }}
            />
          </div>
        )}

        {/* Specifications */}
        {product.attributes && product.attributes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold">Specifications</h2>
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {product.attributes.map((attr, i) => {
                    const name = attr.template?.translations?.find((t) => t.locale === 'en')?.name || '—';
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                        <td className="px-4 py-2.5 text-muted-foreground font-medium w-2/5 border-b border-zinc-100">{name}</td>
                        <td className="px-4 py-2.5 font-semibold border-b border-zinc-100">{String(attr.value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FAQ */}
        {product.faqs && product.faqs.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold">Frequently Asked Questions</h2>
            <div className="divide-y rounded-xl border overflow-hidden">
              {product.faqs.map((faq, i) => {
                const q = faq.translations?.find((t) => t.locale === 'en')?.question || faq.translations?.[0]?.question || '';
                const a = faq.translations?.find((t) => t.locale === 'en')?.answer || faq.translations?.[0]?.answer || '';
                return (
                  <details key={i} className="group">
                    <summary className="flex items-center justify-between px-5 py-4 cursor-pointer text-sm font-medium hover:bg-zinc-50 transition list-none">
                      {q}
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 transition-transform group-open:rotate-90" />
                    </summary>
                    <div
                      className="px-5 pb-4 text-sm text-muted-foreground prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: a }}
                    />
                  </details>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
