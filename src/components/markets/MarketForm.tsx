'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { CountryMultiSelect } from '@/components/common/CountryMultiSelect';
import { PriceRuleEditor } from '@/components/markets/PriceRuleEditor';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import { clearCurrencyCache, useCurrency } from '@/lib/useCurrency';
import { useTransientFlag } from '@/lib/useTransientFlag';
import { SUPPORTED_CURRENCY_OPTIONS } from '@/lib/supportedCurrencies';
import { createMarket, updateMarket, type MarketInput, type MarketView, type PriceRule } from '@/lib/markets.api';

// Mirror of the API key rule (CreateMarketDto): 1–16 lowercase letters, digits
// or hyphens, no leading/trailing hyphen.
const KEY_RE = /^[a-z0-9](?:[a-z0-9-]{0,14}[a-z0-9])?$/;

// Storefront locales the proxy can serve (web `locales` list); the API rejects
// anything else with MARKET_LOCALE_UNSUPPORTED.
export const MARKET_LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'sv', label: 'Svenska' },
];

export const localeLabel = (code: string) => MARKET_LOCALES.find((l) => l.value === code)?.label ?? code.toUpperCase();

const DEFAULT_RULE: PriceRule = { mode: 'convert', source: 'manual', rate: null, rounding: { ending: 'none' } };

interface MarketFormProps {
  initial?: MarketView;
  onSaved: (market: MarketView) => void;
  /** Called after a refused update (e.g. MARKET_PAYMENT_CHECK_FAILED) so the parent can reload the stored payment_check. */
  onSaveFailed?: () => void;
}

/**
 * Create / edit a market's identity, countries, locales, currency and price
 * rule. Domains and the payment check live on the detail page because they
 * need an existing market id.
 */
export function MarketForm({ initial, onSaved, onSaveFailed }: MarketFormProps) {
  const t = useTranslations('creator.markets.form');
  const { token } = useAuth();
  const describeError = useApiError();
  // Base currency = the store currency (prices are entered in it).
  const { currency: baseCurrency } = useCurrency();

  const [form, setForm] = useState<MarketInput>({
    key: initial?.key ?? '',
    name: initial?.name ?? '',
    countries: initial?.countries ?? [],
    default_locale: initial?.default_locale ?? 'en',
    locales: initial?.locales ?? [],
    currency: initial?.currency ?? baseCurrency,
    price_rule: initial?.price_rule && initial.price_rule.mode ? initial.price_rule : DEFAULT_RULE,
    noindex: initial?.noindex ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, flashSaved] = useTransientFlag();
  const [error, setError] = useState<string | null>(null);
  // Server detail shown under the mapped title (e.g. which countries overlap).
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const isEdit = !!initial;
  const isDefault = !!initial?.is_default;
  const set = <K extends keyof MarketInput>(key: K, value: MarketInput[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleLocale = (code: string) => {
    if (code === form.default_locale) return;
    set('locales', form.locales.includes(code) ? form.locales.filter((l) => l !== code) : [...form.locales, code]);
  };

  const sameCurrency = form.currency === baseCurrency;
  const keyValid = isEdit || KEY_RE.test(form.key.trim());
  // A manual convert rule needs a usable rate (the API answers MARKET_FX_RATE_MISSING otherwise).
  const rule = form.price_rule;
  const rateValid =
    sameCurrency || rule.mode !== 'convert' || (rule.source ?? 'manual') !== 'manual' || Number(rule.rate) > 0;
  const canSave = !!form.key.trim() && !!form.name.trim() && !!form.currency && keyValid && rateValid && !saving;

  const handleSave = async () => {
    if (!token || !canSave) return;
    setSaving(true);
    setError(null);
    setErrorDetail(null);
    const payload: MarketInput = {
      ...form,
      key: form.key.trim().toLowerCase(),
      name: form.name.trim(),
      // The default locale must never appear in the extra list (API: MARKET_DEFAULT_LOCALE_IN_LOCALES).
      locales: form.locales.filter((l) => l !== form.default_locale),
      // Same currency as the store: identity conversion, as the API backfill stores it.
      price_rule: sameCurrency
        ? { mode: 'convert', source: 'manual', rate: 1, rounding: form.price_rule.rounding ?? {} }
        : form.price_rule,
    };
    try {
      // The key is locked after creation, so the update omits it.
      const { key, ...editable } = payload;
      const market = isEdit ? await updateMarket(token, initial.id, editable) : await createMarket(token, { ...editable, key });
      // The default market's currency is the store currency the dashboard formats in.
      if (market.is_default && initial?.currency !== market.currency) clearCurrencyCache();
      flashSaved();
      onSaved(market);
    } catch (err) {
      // Inline, mapped via errors.<code> (MARKET_FX_RATE_MISSING, MARKET_PAYMENT_CHECK_FAILED, …).
      setError(describeError(err));
      if (err instanceof ApiError && err.code === 'MARKET_COUNTRY_OVERLAP' && err.message) setErrorDetail(err.message);
      if (isEdit) onSaveFailed?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t('general')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('name')}</Label>
              <Input className="h-8 text-sm" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('namePlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('key')}</Label>
              <Input
                className="h-8 text-sm font-mono"
                dir="ltr"
                value={form.key}
                disabled={isEdit}
                readOnly={isEdit}
                maxLength={16}
                onChange={(e) => set('key', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="eu"
              />
              <p className={`text-[11px] ${!keyValid && form.key ? 'text-red-600' : 'text-muted-foreground'}`}>
                {isEdit ? t('keyLocked') : !keyValid && form.key ? t('keyInvalid') : t('keyHint')}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t('countries')}</Label>
            <CountryMultiSelect value={form.countries} onChange={(codes) => set('countries', codes)} />
            <p className="text-[11px] text-muted-foreground">{t('countriesHint')}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('defaultLocale')}</Label>
              <SearchableSelect
                value={form.default_locale}
                onChange={(v) => setForm((prev) => ({ ...prev, default_locale: v, locales: prev.locales.filter((l) => l !== v) }))}
                options={MARKET_LOCALES}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('currency')}</Label>
              <SearchableSelect
                value={form.currency}
                onChange={(v) =>
                  setForm((prev) => {
                    if (v === prev.currency) return prev;
                    // Back to the store currency: the identity rule (as the
                    // save path stores it). Away from it: the old rate is
                    // meaningless (a 1:1 rate must not be saved by accident),
                    // so the merchant has to enter one.
                    const price_rule: PriceRule =
                      v === baseCurrency
                        ? { mode: 'convert', source: 'manual', rate: 1, rounding: prev.price_rule.rounding ?? {} }
                        : { ...prev.price_rule, rate: null };
                    return { ...prev, currency: v, price_rule };
                  })
                }
                options={SUPPORTED_CURRENCY_OPTIONS}
              />
              {isDefault && <p className="text-[11px] text-muted-foreground">{t('defaultCurrencyHint')}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">{t('locales')}</Label>
            <div className="flex flex-wrap gap-2">
              {MARKET_LOCALES.map((locale) => {
                const isDefaultLocale = locale.value === form.default_locale;
                const selected = form.locales.includes(locale.value);
                return (
                  <button
                    key={locale.value}
                    type="button"
                    disabled={isDefaultLocale}
                    onClick={() => toggleLocale(locale.value)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      selected || isDefaultLocale ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                    } ${isDefaultLocale ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                  >
                    {locale.label}
                    {isDefaultLocale && <Badge variant="secondary" className="ms-1 h-auto px-1 py-0 text-[9px]">{t('defaultBadge')}</Badge>}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t('pricing')}</CardTitle>
          <p className="text-[11px] text-muted-foreground">{t('pricingHint', { currency: baseCurrency })}</p>
        </CardHeader>
        <CardContent>
          <PriceRuleEditor
            value={form.price_rule}
            onChange={(rule) => set('price_rule', rule)}
            baseCurrency={baseCurrency}
            marketCurrency={form.currency}
          />
          {!rateValid && <p className="mt-2 text-[11px] text-red-600">{t('rateRequired')}</p>}
        </CardContent>
      </Card>

      {/* Search engine indexing: noindex for test/staging domains (M6). */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t('indexing')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="market-noindex" className="text-xs font-medium">{t('noindex')}</Label>
              <p className="text-[10px] text-muted-foreground">{t('noindexHint')}</p>
            </div>
            <ToggleSwitch
              id="market-noindex"
              checked={!!form.noindex}
              onChange={(v) => set('noindex', v)}
              label={t('noindex')}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" disabled={!canSave} onClick={handleSave}>
          {saving ? <Loader2 className="animate-spin" /> : null} {isEdit ? t('save') : t('create')}
        </Button>
        {saved && <span className="text-xs font-medium text-emerald-600">{t('saved')}</span>}
        {error && (
          <span className="text-xs text-red-600">
            {error}
            {errorDetail && <span className="block text-[11px] text-red-500">{errorDetail}</span>}
          </span>
        )}
      </div>
    </div>
  );
}
