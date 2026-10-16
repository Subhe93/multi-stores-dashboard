'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { listOwnProducts, type PickerProduct } from '@/lib/personalization';

interface ProductPickerProps {
  token: string;
  primaryLocale: string;
  value: string;
  onChange: (productId: string) => void;
}

/**
 * Select of the creator's own products (personalization applies to own
 * products only, D2). Loads the first 100 once; the select filters locally.
 */
export function ProductPicker({ token, primaryLocale, value, onChange }: ProductPickerProps) {
  const t = useTranslations('creator.personalization');
  const [products, setProducts] = useState<PickerProduct[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listOwnProducts(token, primaryLocale)
      .then((list) => {
        if (!cancelled) setProducts(list);
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([]);
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, primaryLocale]);

  if (products === null) {
    return (
      <div className="flex h-8 items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> {t('loading')}
      </div>
    );
  }
  if (failed) return <p className="text-xs text-red-600">{t('productsLoadFailed')}</p>;
  if (products.length === 0) return <p className="text-xs text-muted-foreground">{t('noProducts')}</p>;

  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      placeholder={t('pickProduct')}
      options={products.map((p) => ({ value: p.id, label: p.title }))}
    />
  );
}
