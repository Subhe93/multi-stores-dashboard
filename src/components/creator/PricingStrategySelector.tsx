'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, Layers, TrendingUp } from 'lucide-react';
import { useCurrency } from '@/lib/useCurrency';

type PricingType = 'SINGLE' | 'PER_VARIANT' | 'MARGIN';

interface VariantForPricing {
  id: string;
  options: Record<string, string>;
  price_adjustment: number;
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
}: PricingStrategySelectorProps) {
  const { fmt, currency } = useCurrency();
  return (
    <div className="space-y-4">
      {/* Strategy radio cards */}
      <div className="grid grid-cols-3 gap-2">
        {strategies.map(({ key, icon: Icon, title, description }) => {
          const selected = pricingType === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPricingTypeChange(key)}
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-center transition hover:bg-muted ${
                selected
                  ? 'border-zinc-900 bg-zinc-50'
                  : 'border-zinc-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${selected ? 'text-zinc-900' : 'text-zinc-400'}`} />
              <p className="text-xs font-semibold">{title}</p>
              <p className="text-[10px] text-muted-foreground">{description}</p>
            </button>
          );
        })}
      </div>

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
            className="h-8 text-sm"
          />
          {basePrice > 0 && finalPrice && (
            <ProfitIndicator basePrice={basePrice} sellPrice={parseFloat(finalPrice)} />
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
            className="h-8 text-sm"
          />
          {marginAmount && (
            <p className="text-xs text-muted-foreground">
              Example: Base {fmt(basePrice)} + Margin {fmt(parseFloat(marginAmount || '0'))} ={' '}
              <span className="font-medium text-zinc-900">
                {fmt(basePrice + parseFloat(marginAmount || '0'))}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Per-variant pricing table */}
      {pricingType === 'PER_VARIANT' && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">Set price for each variant</Label>
          <div className="rounded-md border divide-y max-h-60 overflow-y-auto">
            {selectedVariants.map((variant) => {
              const optionLabels = Object.entries(variant.options || {})
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ');
              const variantBase = basePrice + Number(variant.price_adjustment || 0);

              return (
                <div key={variant.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {optionLabels || variant.id.slice(0, 8)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Base: {fmt(variantBase)}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={variantBase.toFixed(2)}
                    value={variantPrices[variant.id] || ''}
                    onChange={(e) => onVariantPriceChange(variant.id, e.target.value)}
                    className="h-7 text-xs w-24"
                  />
                </div>
              );
            })}
          </div>
          {selectedVariants.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No variants selected. Go back and select variants first.
            </p>
          )}
        </div>
      )}
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
