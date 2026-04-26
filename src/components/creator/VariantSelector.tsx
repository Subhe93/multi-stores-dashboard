'use client';

import { Check } from 'lucide-react';
import { useCurrency } from '@/lib/useCurrency';

interface Variant {
  id: string;
  sku: string | null;
  price_adjustment: number;
  stock_quantity: number | null;
  options: Record<string, string>;
}

interface VariantSelectorProps {
  variants: Variant[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  basePrice: number;
}

export default function VariantSelector({
  variants,
  selectedIds,
  onChange,
  basePrice,
}: VariantSelectorProps) {
  const { fmt } = useCurrency();
  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((v) => v !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectAll = () => onChange(variants.map((v) => v.id));
  const deselectAll = () => onChange([]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {selectedIds.length} of {variants.length} variants selected
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-primary hover:underline"
          >
            Select all
          </button>
          <span className="text-xs text-muted-foreground">·</span>
          <button
            type="button"
            onClick={deselectAll}
            className="text-xs text-primary hover:underline"
          >
            Deselect all
          </button>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
        {variants.map((variant) => {
          const selected = selectedIds.includes(variant.id);
          const optionLabels = Object.entries(variant.options || {})
            .map(([k, v]) => `${k}: ${v}`)
            .join(' · ');
          const price = basePrice + Number(variant.price_adjustment || 0);

          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => toggle(variant.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted ${
                selected ? 'bg-zinc-50' : ''
              }`}
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  selected
                    ? 'bg-zinc-900 border-zinc-900'
                    : 'border-zinc-300'
                }`}
              >
                {selected && <Check className="w-3 h-3 text-white" />}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {optionLabels || variant.sku || variant.id.slice(0, 8)}
                </p>
                {variant.stock_quantity !== null && (
                  <p className="text-[11px] text-muted-foreground">
                    Stock: {variant.stock_quantity}
                  </p>
                )}
              </div>

              <span className="text-xs text-muted-foreground shrink-0">
                {fmt(price)}
              </span>
            </button>
          );
        })}
      </div>

      {selectedIds.length === 0 && (
        <p className="text-xs text-red-600">At least one variant must be selected.</p>
      )}
    </div>
  );
}
