'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, Layers, TrendingUp, Check, Package } from 'lucide-react';
import { useCurrency } from '@/lib/useCurrency';

type PricingType = 'SINGLE' | 'PER_VARIANT' | 'MARGIN';

interface VariantImage {
  url: string;
  is_featured?: boolean;
}

interface VariantForPricing {
  id: string;
  sku?: string | null;
  options: Record<string, string>;
  price_adjustment: number;
  images?: VariantImage[];
}

// Mirrors the provider's VariantManager option config — the source of truth
// for how a value like "2C" maps to actual hex codes (single or dual).
interface VariantOptionConfig {
  name: string;
  style: 'text' | 'color' | 'image';
  values: string[];
  colorMap?: Record<string, string>;
  dualColorMap?: Record<string, [string, string]>;
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '');

function resolveImageUrl(url: string): string {
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

function findVariantImage(images?: VariantImage[]): string | null {
  if (!images?.length) return null;
  const featured = images.find((i) => i.is_featured) ?? images[0];
  return featured?.url ? resolveImageUrl(featured.url) : null;
}

// Same swatch component used by the provider's VariantManager so the visual
// is identical across both flows. Two-tone swatches use a 50/50 linear-gradient
// at 135deg.
function ColorSwatch({
  hex,
  dualHex,
  size = 16,
}: {
  hex?: string;
  dualHex?: [string, string];
  size?: number;
}) {
  if (dualHex) {
    return (
      <span
        className="inline-block rounded-full border border-gray-200 shrink-0"
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${dualHex[0]} 50%, ${dualHex[1]} 50%)`,
        }}
      />
    );
  }
  return (
    <span
      className="inline-block rounded-full border border-gray-200 shrink-0"
      style={{ width: size, height: size, backgroundColor: hex || '#ccc' }}
    />
  );
}

interface PricingStrategySelectorProps {
  pricingType: PricingType;
  onPricingTypeChange: (type: PricingType) => void;
  finalPrice: string;
  onFinalPriceChange: (value: string) => void;
  marginAmount: string;
  onMarginAmountChange: (value: string) => void;
  variantPrices: Record<string, string>;
  onVariantPriceChange: (variantId: string, price: string) => void;
  selectedVariants: VariantForPricing[];
  basePrice: number;
  variantOptionConfig?: VariantOptionConfig[];
}

const strategies = [
  {
    key: 'SINGLE' as PricingType,
    icon: DollarSign,
    title: 'Single Price',
    description: 'One price for all variants',
  },
  {
    key: 'PER_VARIANT' as PricingType,
    icon: Layers,
    title: 'Per-Variant',
    description: 'Different price per variant',
  },
  {
    key: 'MARGIN' as PricingType,
    icon: TrendingUp,
    title: 'Fixed Margin',
    description: 'Markup on base price',
  },
];

export default function PricingStrategySelector({
  pricingType,
  onPricingTypeChange,
  finalPrice,
  onFinalPriceChange,
  marginAmount,
  onMarginAmountChange,
  variantPrices,
  onVariantPriceChange,
  selectedVariants,
  basePrice,
  variantOptionConfig,
}: PricingStrategySelectorProps) {
  const { fmt, currency } = useCurrency();
  const activeStrategy = strategies.find((s) => s.key === pricingType);

  // Build a lookup: optionName → config (so we can resolve a value like "2C"
  // to a single hex or a [hex1, hex2] dual color).
  const optionByName = (variantOptionConfig || []).reduce<Record<string, VariantOptionConfig>>(
    (acc, c) => {
      if (c?.name) acc[c.name] = c;
      return acc;
    },
    {},
  );

  // Compute the price the customer will see, based on the chosen strategy.
  const finalSinglePrice = parseFloat(finalPrice || '0');
  const finalMarginPrice = basePrice + parseFloat(marginAmount || '0');
  const variantPriceValues = selectedVariants
    .map((v) => parseFloat(variantPrices[v.id] || '0'))
    .filter((p) => p > 0);
  const variantMin = variantPriceValues.length ? Math.min(...variantPriceValues) : 0;
  const variantMax = variantPriceValues.length ? Math.max(...variantPriceValues) : 0;

  return (
    <div className="space-y-4">
      {/* Base product price banner */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-zinc-50">
        <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center shrink-0">
          <Package className="w-4 h-4 text-zinc-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted-foreground">Provider base price (your cost)</p>
          <p className="text-sm font-semibold text-zinc-900">{fmt(basePrice)}</p>
        </div>
        <p className="text-[10px] text-muted-foreground text-right shrink-0">
          Choose how to price<br />for your customers
        </p>
      </div>

      {/* Strategy radio cards */}
      <div>
        <Label className="text-xs font-medium block mb-2">Pricing method</Label>
        <div className="grid grid-cols-3 gap-2">
          {strategies.map(({ key, icon: Icon, title, description }) => {
            const selected = pricingType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onPricingTypeChange(key)}
                className={`relative flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-center transition ${
                  selected
                    ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm'
                    : 'border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50'
                }`}
              >
                {selected && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                  </span>
                )}
                <Icon className={`w-4 h-4 ${selected ? 'text-white' : 'text-zinc-400'}`} />
                <p className="text-xs font-semibold">{title}</p>
                <p className={`text-[10px] ${selected ? 'text-zinc-300' : 'text-muted-foreground'}`}>
                  {description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active method configuration panel */}
      {activeStrategy && (() => {
        const ActiveIcon = activeStrategy.icon;
        return (
        <div className="rounded-lg border-2 border-zinc-900 bg-white overflow-hidden">
          {/* Header — confirms which method is active */}
          <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 border-b">
            <ActiveIcon className="w-3.5 h-3.5 text-zinc-900" />
            <p className="text-xs font-semibold flex-1">
              Using <span className="text-zinc-900">{activeStrategy.title}</span>
            </p>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
              <Check className="w-2.5 h-2.5" /> Active
            </span>
          </div>

          <div className="p-3 space-y-3">
            {/* Single price input */}
            {pricingType === 'SINGLE' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Final Price ({currency})</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={finalPrice}
                  onChange={(e) => onFinalPriceChange(e.target.value)}
                  className="h-9 text-sm"
                />
                {basePrice > 0 && finalPrice && (
                  <ProfitIndicator basePrice={basePrice} sellPrice={finalSinglePrice} />
                )}
              </div>
            )}

            {/* Margin input */}
            {pricingType === 'MARGIN' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Profit Margin ({currency})</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={marginAmount}
                  onChange={(e) => onMarginAmountChange(e.target.value)}
                  className="h-9 text-sm"
                />
                {marginAmount && (
                  <p className="text-xs text-muted-foreground">
                    Base {fmt(basePrice)} + Margin {fmt(parseFloat(marginAmount || '0'))} ={' '}
                    <span className="font-semibold text-zinc-900">{fmt(finalMarginPrice)}</span>
                  </p>
                )}
              </div>
            )}

            {/* Per-variant pricing table */}
            {pricingType === 'PER_VARIANT' && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Set a price for each variant</Label>
                {selectedVariants.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center bg-zinc-50 rounded">
                    No variants selected. Go back and select variants first.
                  </p>
                ) : (
                  <div className="rounded-md border divide-y max-h-72 overflow-y-auto">
                    {selectedVariants.map((variant) => {
                      const variantBase = basePrice + Number(variant.price_adjustment || 0);
                      const imgUrl = findVariantImage(variant.images);

                      // For every option on the variant, decide whether it's a
                      // color (by consulting the parent product's option config)
                      // and resolve its hex/dual-hex via colorMap/dualColorMap.
                      // Anything that isn't a color renders as a chip below.
                      const entries = Object.entries(variant.options || {});
                      const colorEntries: { key: string; value: string; hex?: string; dualHex?: [string, string] }[] = [];
                      const otherOptions: [string, string][] = [];
                      for (const [k, v] of entries) {
                        const cfg = optionByName[k];
                        if (cfg && cfg.style === 'color') {
                          colorEntries.push({
                            key: k,
                            value: v,
                            hex: cfg.colorMap?.[v],
                            dualHex: cfg.dualColorMap?.[v],
                          });
                        } else {
                          otherOptions.push([k, v]);
                        }
                      }

                      return (
                        <div key={variant.id} className="flex items-center gap-3 px-3 py-2.5">
                          {/* Image thumbnail (or fallback icon) */}
                          <div className="w-10 h-10 rounded-md overflow-hidden border bg-zinc-50 flex items-center justify-center shrink-0">
                            {imgUrl ? (
                              <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-4 h-4 text-zinc-300" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Color swatches — uses the same ColorSwatch as the
                                provider's VariantManager so dual colors render
                                identically (e.g. "2C" → 50/50 split swatch). */}
                            {colorEntries.length > 0 && (
                              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                <div className="flex items-center -space-x-1">
                                  {colorEntries.map((c, i) => (
                                    <ColorSwatch
                                      key={i}
                                      hex={c.hex}
                                      dualHex={c.dualHex}
                                      size={16}
                                    />
                                  ))}
                                </div>
                                <span className="text-xs font-medium capitalize truncate">
                                  {colorEntries.map((c) => c.value).join(' / ')}
                                </span>
                              </div>
                            )}
                            {/* Other options as compact chips */}
                            {otherOptions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-0.5">
                                {otherOptions.map(([k, v]) => (
                                  <span
                                    key={k}
                                    className="inline-flex items-center gap-0.5 text-[10px] bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded"
                                  >
                                    <span className="text-zinc-400">{k}:</span>
                                    <span className="font-medium">{v}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* Fallback if no options at all */}
                            {colorEntries.length === 0 && otherOptions.length === 0 && (
                              <p className="text-xs font-medium truncate">
                                {variant.sku || variant.id.slice(0, 8)}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground">
                              Cost: {fmt(variantBase)}
                            </p>
                          </div>

                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder={variantBase.toFixed(2)}
                            value={variantPrices[variant.id] || ''}
                            onChange={(e) => onVariantPriceChange(variant.id, e.target.value)}
                            className="h-8 text-xs w-24"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Customer-facing price preview */}
            {(pricingType === 'SINGLE' && finalSinglePrice > 0) ||
            (pricingType === 'MARGIN' && parseFloat(marginAmount || '0') > 0) ||
            (pricingType === 'PER_VARIANT' && variantPriceValues.length > 0) ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200">
                <span className="text-[11px] text-emerald-800 font-medium">
                  Customer will see
                </span>
                <span className="text-sm font-bold text-emerald-900">
                  {pricingType === 'SINGLE' && fmt(finalSinglePrice)}
                  {pricingType === 'MARGIN' && fmt(finalMarginPrice)}
                  {pricingType === 'PER_VARIANT' &&
                    (variantMin === variantMax
                      ? fmt(variantMin)
                      : `${fmt(variantMin)} – ${fmt(variantMax)}`)}
                </span>
              </div>
            ) : null}
          </div>
        </div>
        );
      })()}
    </div>
  );
}

function ProfitIndicator({ basePrice, sellPrice }: { basePrice: number; sellPrice: number }) {
  const { fmt } = useCurrency();
  const profit = sellPrice - basePrice;
  if (isNaN(profit)) return null;
  return (
    <div className="flex items-center gap-4 text-xs">
      <span className="text-muted-foreground">Base cost: {fmt(basePrice)}</span>
      <span className={`font-medium ${profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
        Profit: {profit >= 0 ? '+' : '-'}{fmt(Math.abs(profit))}
      </span>
    </div>
  );
}
