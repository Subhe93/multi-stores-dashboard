'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ImageOff } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/media';
import type { LowStockProduct, OverviewProductRef, TopProduct } from './overview.api';
import type { OverviewFormat } from './format';

export const productEditHref = (p: Pick<OverviewProductRef, 'id' | 'kind'>) =>
  p.kind === 'custom' ? `/creator/custom-products/${p.id}` : `/creator/products/own/${p.id}`;

function Thumb({ src, alt }: { src?: string | null; alt: string }) {
  const url = resolveMediaUrl(src);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} loading="lazy" className="size-10 shrink-0 rounded-md border bg-zinc-50 object-cover" />
  ) : (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-zinc-50 text-zinc-400">
      <ImageOff className="size-4" aria-hidden="true" />
    </span>
  );
}

interface TopProductsProps {
  products: TopProduct[];
  /** Period revenue, for each product's share bar. */
  total: number;
  fmt: OverviewFormat;
}

export function TopProductsList({ products, total, fmt }: TopProductsProps) {
  const t = useTranslations('creator.overview');
  return (
    <ul className="divide-y">
      {products.map((p) => {
        const share = total > 0 ? Math.min(1, p.revenue / total) : 0;
        return (
          <li key={`${p.kind}:${p.id}`}>
            <Link
              href={productEditHref(p)}
              className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-zinc-50"
            >
              <Thumb src={p.image} alt="" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p dir="auto" className="truncate text-start text-sm font-medium">{p.title}</p>
                  <p className="shrink-0 text-sm font-medium tabular-nums"><bdi>{fmt.money(p.revenue)}</bdi></p>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--viz-track)" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-(--viz-accent)"
                      style={{ width: `${share * 100}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    <bdi>{t('soldCount', { count: p.quantity })}</bdi> · <bdi>{fmt.percent(share)}</bdi>
                  </span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function LowStockList({ products }: { products: LowStockProduct[] }) {
  const t = useTranslations('creator.overview');
  return (
    <ul className="divide-y">
      {products.map((p) => (
        <li key={`${p.kind}:${p.id}`}>
          <Link
            href={productEditHref(p)}
            className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-zinc-50"
          >
            <Thumb src={p.image} alt="" />
            <p dir="auto" className="min-w-0 flex-1 truncate text-start text-sm font-medium">{p.title}</p>
            <span
              className={
                p.stock <= 0
                  ? 'shrink-0 rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700'
                  : 'shrink-0 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800'
              }
            >
              {p.stock <= 0 ? t('outOfStock') : t('stockLeft', { count: p.stock })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
