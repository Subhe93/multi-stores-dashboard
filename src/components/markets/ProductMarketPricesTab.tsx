'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/useApiError';
import { useTransientFlag } from '@/lib/useTransientFlag';
import {
  getProductMarketPrices,
  putProductMarketPrices,
  type ProductMarketPriceRow,
  type ProductMarketPricesView,
} from '@/lib/markets.api';

const fmtMoney = (amount: number | null, currency: string) => {
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

const parseOverride = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

interface ProductMarketPricesTabProps {
  productId: string;
}

/**
 * "Prices by market" on the own-product editor: per market the auto-converted
 * price (read-only, with the rate), a manual override, compare-at override,
 * availability toggle and expandable per-variant overrides. Saves through
 * PUT /markets/products/:id/prices.
 */
export function ProductMarketPricesTab({ productId }: ProductMarketPricesTabProps) {
  const t = useTranslations('creator.products.marketPrices');
  const { token } = useAuth();
  const describeError = useApiError();

  const [view, setView] = useState<ProductMarketPricesView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, flashSaved] = useTransientFlag();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!token || !productId) return;
    let cancelled = false;
    getProductMarketPrices(token, productId)
      .then((res) => { if (!cancelled) setView(res); })
      .catch((err: unknown) => { if (!cancelled) setLoadError(describeError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- describeError is stable for the mounted locale
  }, [token, productId]);

  const updateRow = (marketId: string, patch: Partial<ProductMarketPriceRow>) =>
    setView((prev) => prev && { ...prev, markets: prev.markets.map((m) => (m.market_id === marketId ? { ...m, ...patch } : m)) });

  const updateVariant = (marketId: string, variantId: string, override: number | null) =>
    setView((prev) =>
      prev && {
        ...prev,
        markets: prev.markets.map((m) =>
          m.market_id === marketId
            ? { ...m, variants: m.variants.map((v) => (v.variant_id === variantId ? { ...v, override } : v)) }
            : m,
        ),
      },
    );

  const handleSave = async () => {
    if (!token || !view || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await putProductMarketPrices(token, productId, {
        markets: view.markets.map((m) => ({
          market_id: m.market_id,
          available: m.available,
          price: m.override,
          compare_at_price: m.compare_at_override,
          variants: m.variants.map((v) => ({ variant_id: v.variant_id, price: v.override })),
        })),
      });
      setView(res);
      flashSaved();
    } catch (err) {
      setSaveError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }
  if (loadError) return <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">{loadError}</p>;
  if (!view) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t('title')}</h2>
          <p className="text-[11px] text-muted-foreground">{t('subtitle', { currency: view.base_currency })}</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs font-medium text-emerald-600">{t('saved')}</span>}
          <Button size="sm" disabled={saving} onClick={handleSave}>
            {saving ? <Loader2 className="animate-spin" /> : null} {t('save')}
          </Button>
        </div>
      </div>
      {saveError && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">{saveError}</p>}

      {view.markets.length === 0 ? (
        <Card className="shadow-none"><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('noMarkets')}</CardContent></Card>
      ) : (
        view.markets.map((m) => {
          const isOpen = !!expanded[m.market_id];
          // Fixed mode without override and without a rate: the API hides the product (L2).
          const hiddenByRule = m.available && m.override == null && m.auto_price == null;
          return (
            <Card key={m.market_id} className="shadow-none">
              <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle className="text-sm font-semibold">
                  {m.name} <span className="font-mono text-[11px] font-normal text-muted-foreground" dir="ltr">({m.key} · {m.currency})</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{t('available')}</span>
                  <ToggleSwitch checked={m.available} onChange={(v) => updateRow(m.market_id, { available: v })} label={t('available')} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {hiddenByRule && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span>{t('hiddenWarning')}</span>
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">{t('colAuto')}</p>
                    <p className="text-sm font-medium tabular-nums">{fmtMoney(m.auto_price, m.currency)}</p>
                    <p className="text-[10px] text-muted-foreground">{m.rate != null ? t('rateNote', { rate: m.rate }) : t('noRate')}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] text-muted-foreground">{t('colOverride')}</p>
                      {m.override != null && <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">{t('manual')}</Badge>}
                    </div>
                    <Input
                      className="h-8 text-sm"
                      type="number"
                      min={0}
                      step="0.01"
                      dir="ltr"
                      value={m.override ?? ''}
                      placeholder={m.auto_price != null ? String(m.auto_price) : ''}
                      onChange={(e) => updateRow(m.market_id, { override: parseOverride(e.target.value) })}
                    />
                    {m.override != null && (
                      <button type="button" className="text-[10px] text-primary hover:underline" onClick={() => updateRow(m.market_id, { override: null })}>
                        {t('resetToAuto')}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">{t('colCompareAt')}</p>
                    <Input
                      className="h-8 text-sm"
                      type="number"
                      min={0}
                      step="0.01"
                      dir="ltr"
                      value={m.compare_at_override ?? ''}
                      placeholder={m.compare_at_auto != null ? String(m.compare_at_auto) : ''}
                      onChange={(e) => updateRow(m.market_id, { compare_at_override: parseOverride(e.target.value) })}
                    />
                  </div>
                </div>

                {m.variants.length > 0 && (
                  <div className="space-y-2 border-t pt-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-medium text-zinc-700 hover:text-zinc-900"
                      onClick={() => setExpanded((prev) => ({ ...prev, [m.market_id]: !isOpen }))}
                    >
                      {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5 rtl:rotate-180" />}
                      {t('variants', { count: m.variants.length })}
                    </button>
                    {isOpen && (
                      <div className="divide-y rounded-md border">
                        {m.variants.map((v) => (
                          <div key={v.variant_id} className="grid items-center gap-2 px-3 py-2 text-xs md:grid-cols-[1fr_auto_160px]">
                            <span className="truncate font-medium">{v.label}</span>
                            <span className="tabular-nums text-muted-foreground">{fmtMoney(v.auto_price, m.currency)}</span>
                            <div className="flex items-center gap-1.5">
                              <Input
                                className="h-7 text-xs"
                                type="number"
                                min={0}
                                step="0.01"
                                dir="ltr"
                                value={v.override ?? ''}
                                placeholder={v.auto_price != null ? String(v.auto_price) : ''}
                                onChange={(e) => updateVariant(m.market_id, v.variant_id, parseOverride(e.target.value))}
                              />
                              {v.override != null && <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">{t('manual')}</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
