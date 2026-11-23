'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  customPrefillFromProduct,
  linkFieldMode,
  pickedProductValue,
  productLinkEnabled,
  productRefId,
  type LinkFieldMode,
  type ProductLinkFlag,
} from '@/lib/linkFieldMode';
import { productLinkPickerEnabled } from '@/lib/productLinkPickerFlag';
import { useProductRef } from '@/lib/productRefs';
import { productRefSlug } from '@/lib/productRefsBatch';
import { ProductLinkPicker } from './ProductLinkPicker';
import { ProductRefChip } from './ProductRefChip';

/**
 * Link field of the builder (M165), rendered for every `type: 'url'` field.
 * Two modes: Custom URL (the plain input, unchanged) and Product, which
 * stores a stable reference `product:<id>` that the storefront turns into
 * the right product URL for every language and market. The mode follows the
 * stored value; switching never erases it silently (Product -> Custom
 * pre-fills `/products/<slug>`, Custom -> Product keeps the typed value until
 * a product is picked).
 */
export function LinkField({
  value,
  onChange,
  flag,
  token,
  contentLocale,
}: {
  value: unknown;
  onChange: (value: string) => void;
  flag: ProductLinkFlag;
  token: string;
  contentLocale: string;
}) {
  const t = useTranslations('builder.linkField');
  const str = typeof value === 'string' ? value : '';
  const enabled = productLinkPickerEnabled() && productLinkEnabled(flag);
  const [override, setOverride] = useState<LinkFieldMode | null>(null);
  const [changing, setChanging] = useState(false);
  const refId = productRefId(str);
  const { result } = useProductRef(enabled ? refId : null, token);
  const pickerId = useId();

  const input = (
    <Input
      type="url"
      className="h-9 text-[12.5px] font-mono"
      value={str}
      onChange={(e) => onChange(e.target.value)}
      placeholder="https://"
      dir="ltr"
    />
  );
  if (!enabled) return input;

  const derived = linkFieldMode(str, flag);
  // A picked reference always shows Product mode; otherwise the owner's choice wins.
  const mode: LinkFieldMode = refId ? (override === 'custom' ? 'custom' : 'product') : (override ?? derived);

  const toCustom = () => {
    if (refId) {
      const product = result?.state === 'ok' ? result.product : null;
      onChange(customPrefillFromProduct(product ? { slug: productRefSlug(product, contentLocale) } : null));
    }
    setOverride('custom');
    setChanging(false);
  };
  const toProduct = () => {
    setOverride('product');
  };

  const pick = (id: string) => {
    onChange(pickedProductValue(id));
    setOverride('product');
    setChanging(false);
  };

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label={t('modeLabel')} className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 text-[11px] font-medium">
        {(['custom', 'product'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => (m === 'custom' ? mode !== 'custom' && toCustom() : mode !== 'product' && toProduct())}
            className={cn(
              'rounded-md ps-2.5 pe-2.5 py-1 transition',
              mode === m ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800',
            )}
          >
            {m === 'custom' ? t('modeCustom') : t('modeProduct')}
          </button>
        ))}
      </div>

      {mode === 'custom' ? (
        input
      ) : refId && !changing ? (
        <>
          <ProductRefChip
            id={refId}
            token={token}
            contentLocale={contentLocale}
            onChange={() => setChanging(true)}
            onRemove={() => onChange('')}
            missingTitle={t('missingTitle')}
            missingBody={t('missingBody')}
            missingActions={
              <>
                <button type="button" onClick={() => setChanging(true)} className="rounded-md border border-amber-300 bg-white ps-2 pe-2 py-1 text-[10.5px] font-medium hover:bg-amber-100">
                  {t('pickAnother')}
                </button>
                <button type="button" onClick={toCustom} className="rounded-md border border-amber-300 bg-white ps-2 pe-2 py-1 text-[10.5px] font-medium hover:bg-amber-100">
                  {t('useCustom')}
                </button>
              </>
            }
          />
          {result?.state === 'ok' && <p className="text-[10.5px] text-zinc-400 leading-relaxed">{t('everyLanguageHint')}</p>}
        </>
      ) : (
        <div className="space-y-1">
          <ProductLinkPicker id={pickerId} token={token} contentLocale={contentLocale} onPick={(p) => pick(p.id)} />
          {refId && changing && (
            <button type="button" onClick={() => setChanging(false)} className="text-[10.5px] font-medium text-zinc-500 hover:text-zinc-800">
              {t('cancel')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
