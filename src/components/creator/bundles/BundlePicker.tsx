'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { AlertTriangle, Layers, Loader2, Plus, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { pickTranslation, type Bundle } from './types';
import { bundleHasEconomicConflict, type ProductPricingForCheck } from './economics';

interface Props {
  /** Currently attached bundle ids. */
  value: string[];
  onChange: (ids: string[]) => void;
  /**
   * Optional pricing context. When provided, bundles whose deepest offer would
   * sell the product below provider cost are flagged and disabled.
   * Only meaningful for SINGLE pricing — pass undefined for PER_VARIANT/MARGIN.
   */
  productPricing?: ProductPricingForCheck;
}

/**
 * Lightweight multi-select for attaching bundles to a product. Loads the creator's
 * bundles via /bundles, shows them as a checklist with a quick "Create bundle" link.
 * The product page is responsible for sending the chosen ids on save.
 */
export function BundlePicker({ value, onChange, productPricing }: Props) {
  const t = useTranslations();
  const { token } = useAuth();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [primaryLocale, setPrimaryLocale] = useState('en');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([
      api<{ data: Bundle[] }>('/bundles?limit=200', { token }).catch(() => ({
        data: [] as Bundle[],
      })),
      api<{ primary_locale: string }>('/translations/overview', { token }).catch(
        () => ({ primary_locale: 'en' }),
      ),
    ])
      .then(([bundlesRes, ovRes]) => {
        if (cancelled) return;
        setBundles(bundlesRes?.data ?? []);
        setPrimaryLocale(ovRes?.primary_locale || 'en');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const isIncompatible = (b: Bundle): boolean =>
    productPricing
      ? bundleHasEconomicConflict(b.offers, productPricing)
      : false;

  const activeBundles = bundles.filter((b) => b.status === 'ACTIVE');
  const visible = activeBundles.length > 0 ? activeBundles : bundles;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{t('bundle.bundles')}</span>
          <span className="text-xs text-muted-foreground">
            {t('bundle.attachedCount', { count: value.length })}
          </span>
        </div>
        <Link
          href="/creator/bundles/new"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Plus className="size-3" /> {t('bundle.createBundle')}
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-center">
          <p className="text-xs text-muted-foreground">
            {t('bundle.noBundlesYet')}
          </p>
          <Link
            href="/creator/bundles/new"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Plus className="size-3" /> {t('bundle.createFirstBundle')}
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {visible.map((b) => {
            const name =
              pickTranslation(b.translations, primaryLocale)?.name ||
              t('bundle.untitledBundle');
            const checked = value.includes(b.id);
            const conflict = !checked && isIncompatible(b);
            return (
              <label
                key={b.id}
                className={`flex items-center gap-3 px-3 py-2 transition ${
                  conflict
                    ? 'cursor-not-allowed bg-red-50/40'
                    : checked
                      ? 'cursor-pointer bg-zinc-50'
                      : 'cursor-pointer hover:bg-zinc-50'
                }`}
                title={
                  conflict
                    ? t('bundle.belowCostTooltip')
                    : undefined
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(b.id)}
                  disabled={conflict}
                  className="size-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`truncate text-sm font-medium ${conflict ? 'text-zinc-400' : ''}`}
                    >
                      {name}
                    </span>
                    {b.status === 'DISABLED' && (
                      <span className="rounded bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                        {t('bundle.statusDisabled')}
                      </span>
                    )}
                    {conflict && (
                      <span className="inline-flex items-center gap-0.5 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                        <AlertTriangle className="size-2.5" />
                        {t('bundle.belowCost')}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {t('bundle.offersCount', { count: b.offers.length })}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {value.length > 0 && !loading && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-red-500"
        >
          <X className="size-3" /> {t('bundle.clearAll')}
        </button>
      )}
    </div>
  );
}
