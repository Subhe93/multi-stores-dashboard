'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import {
  AFTER_ADD_TO_CART,
  MAX_PAY_BUTTON_LABEL,
  NAMEZ_RECOMMENDED,
  checkoutFormErrors,
  toCheckoutBody,
  toCheckoutForm,
  type AfterAddToCart,
  type CheckoutSettings,
  type CheckoutSettingsForm,
} from '@/lib/checkoutSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';

// ── Checkout behaviour card (M5 W2-A, M5.1) ──────────────────────────────────
// Store settings → Store tab. Edits `Store.checkout_settings` as one form
// saved explicitly (PUT /stores/my/store { checkout_settings }). Every value
// defaults to today's behaviour; the help text lists the values Namez used
// with the iWings plugin so the merchant can reproduce them.

interface Props {
  token: string;
  /** Stored value (`null` = defaults). */
  value: unknown;
  /** Store content locales: the pay button label is editable per locale. */
  locales: string[];
  onSaved: (settings: CheckoutSettings | null) => void;
}

/** Default pay button text of the storefront per locale (mirror of web `checkout.payAndPlaceOrder`). */
const DEFAULT_PAY_LABEL: Record<string, string> = {
  en: 'Pay & Place Order',
  sv: 'Betala och lägg beställning',
  de: 'Bezahlen & Bestellen',
  fr: 'Payer et commander',
  tr: 'Öde ve Sipariş Ver',
  ar: 'ادفع وأكّد الطلب',
};

export function CheckoutSettingsCard({ token, value, locales, onSaved }: Props) {
  const t = useTranslations('creator.settings.checkout');
  const uiLocale = useLocale();
  const [form, setForm] = useState<CheckoutSettingsForm>(() => toCheckoutForm(value));
  const [saved, setSaved] = useState<CheckoutSettingsForm>(() => toCheckoutForm(value));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // A fresh store payload (e.g. after another card saved) resets the form.
  useEffect(() => {
    const next = toCheckoutForm(value);
    setForm(next);
    setSaved(next);
  }, [value]);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const errors = checkoutFormErrors(form);
  const hasErrors = Object.keys(errors).length > 0;

  const localeNames = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([uiLocale, 'en'], { type: 'language' });
    } catch {
      names = null;
    }
    return (code: string) => {
      try {
        return names?.of(code) || code;
      } catch {
        return code;
      }
    };
  }, [uiLocale]);

  const afterAddOptions = AFTER_ADD_TO_CART.map((key) => ({
    value: key,
    label: t(`afterAdd.${key}`),
    description: t(`afterAdd.${key}Hint`),
  }));

  const update = (patch: Partial<CheckoutSettingsForm>) => {
    setMsg(null);
    setForm((f) => ({ ...f, ...patch }));
  };

  const handleSave = async () => {
    if (saving || hasErrors) return;
    setSaving(true);
    setMsg(null);
    const body = toCheckoutBody(form);
    try {
      await api('/stores/my/store', {
        method: 'PUT',
        token,
        body: JSON.stringify({ checkout_settings: body }),
      });
      setSaved(form);
      setMsg({ type: 'success', text: t('saved') });
      onSaved(body);
    } catch (err) {
      setMsg({ type: 'error', text: (err instanceof Error && err.message) || t('saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const applyNamez = () => {
    setMsg(null);
    setForm(toCheckoutForm(NAMEZ_RECOMMENDED));
  };

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
        <p className="text-[11px] text-muted-foreground">{t('subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* After add to cart */}
        <div className="space-y-1.5">
          <Label htmlFor="ck_after_add">{t('afterAdd.label')}</Label>
          <SearchableSelect
            id="ck_after_add"
            options={afterAddOptions}
            value={form.after_add_to_cart}
            onChange={(v) => update({ after_add_to_cart: v as AfterAddToCart })}
          />
        </div>

        {/* Phone required */}
        <div className="flex items-center justify-between border-t pt-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t('phoneRequired')}</p>
            <p className="text-[11px] text-muted-foreground">
              {form.phone_required ? t('phoneRequiredOn') : t('phoneRequiredOff')}
            </p>
          </div>
          <ToggleSwitch
            checked={form.phone_required}
            onChange={(checked) => update({ phone_required: checked })}
            label={t('phoneRequired')}
          />
        </div>

        {/* Pay button label per locale, with a preview */}
        <div className="space-y-2 border-t pt-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t('payLabel')}</p>
            <p className="text-[11px] text-muted-foreground">{t('payLabelHint', { max: MAX_PAY_BUTTON_LABEL })}</p>
          </div>
          <div className="space-y-3">
            {locales.map((locale) => {
              const current = form.pay_button_label[locale] ?? '';
              const preview = current.trim() || DEFAULT_PAY_LABEL[locale] || DEFAULT_PAY_LABEL.en;
              const tooLong = errors.pay_button_label === locale;
              return (
                <div key={locale} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-1">
                    <Label htmlFor={`ck_pay_${locale}`} className="text-xs">
                      {localeNames(locale)} <span className="font-mono text-muted-foreground">({locale})</span>
                    </Label>
                    <Input
                      id={`ck_pay_${locale}`}
                      value={current}
                      maxLength={MAX_PAY_BUTTON_LABEL + 20}
                      placeholder={DEFAULT_PAY_LABEL[locale] || DEFAULT_PAY_LABEL.en}
                      onChange={(e) => update({ pay_button_label: { ...form.pay_button_label, [locale]: e.target.value } })}
                      aria-invalid={tooLong || undefined}
                    />
                    {tooLong && <p className="text-[11px] text-red-600">{t('payLabelTooLong', { max: MAX_PAY_BUTTON_LABEL })}</p>}
                  </div>
                  {/* Preview: how the storefront pay button reads in this locale. */}
                  <div
                    dir={locale === 'ar' ? 'rtl' : 'ltr'}
                    aria-label={t('payLabelPreview')}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 text-xs font-bold text-white"
                  >
                    <Lock className="size-3" />
                    <span className="max-w-[220px] truncate">{preview}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coupon links */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{t('couponAutoapply')}</p>
              <p className="text-[11px] text-muted-foreground">
                {form.coupon_autoapply ? t('couponAutoapplyOn') : t('couponAutoapplyOff')}
              </p>
            </div>
            <ToggleSwitch
              checked={form.coupon_autoapply}
              onChange={(checked) => update({ coupon_autoapply: checked })}
              label={t('couponAutoapply')}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ck_coupon_param" className="text-xs">{t('couponParam')}</Label>
            <Input
              id="ck_coupon_param"
              value={form.coupon_param_text}
              placeholder="coupon, coupon1"
              onChange={(e) => update({ coupon_param_text: e.target.value })}
              aria-invalid={errors.coupon_param ? true : undefined}
              disabled={!form.coupon_autoapply}
            />
            {errors.coupon_param ? (
              <p className="text-[11px] text-red-600">{t('couponParamInvalid', { key: errors.coupon_param })}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">{t('couponParamHint')}</p>
            )}
          </div>
        </div>

        {/* Namez recommendation */}
        <div className="rounded-md border border-dashed bg-zinc-50 p-3 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground">{t('namez.title')}</p>
          <p className="mt-1">{t('namez.body')}</p>
          <ul className="mt-1 list-disc ps-4 space-y-0.5">
            <li>{t('namez.afterAdd')}</li>
            <li>{t('namez.phone')}</li>
            <li>{t('namez.payLabel')}</li>
            <li>{t('namez.coupon')}</li>
          </ul>
          <Button type="button" size="sm" variant="outline" className="mt-2" onClick={applyNamez} disabled={saving}>
            {t('namez.apply')}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-3">
          {msg ? (
            <p className={`text-[11px] ${msg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>
          ) : (
            <span className="text-[11px] text-muted-foreground">{dirty ? t('unsaved') : ''}</span>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving || !dirty || hasErrors}>
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            {t('save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
