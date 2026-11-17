'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink, Loader2, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import {
  AFTER_ADD_TO_CART,
  MAX_PAY_BUTTON_LABEL,
  NAMEZ_RECOMMENDED,
  RETURN_MODES,
  checkoutFormErrors,
  externalSiteNeedsReauth,
  externalUrlRejection,
  toCheckoutBody,
  toCheckoutForm,
  withExternalFocus,
  withNoCustomerAccounts,
  withReturnLabel,
  type AfterAddToCart,
  type CheckoutSettings,
  type CheckoutSettingsForm,
  type ExternalUrlReason,
  type ReturnMode,
} from '@/lib/checkoutSettings';
import type { ReauthAction } from '@/components/security/ReauthDialog';
import type { ReauthCredentials } from '@/lib/twoFactor';
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
  /** Opens the page's re-auth dialog (useReauth().request): setting or
   *  replacing the external site URL needs the password (+ 2FA code). */
  requestReauth?: (action: ReauthAction, description?: string) => void;
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

/** Default "back to site" text of the storefront (mirror of web `checkout.returnToSite`). */
const DEFAULT_BACK_LABEL: Record<string, string> = {
  en: 'Back to {site}',
  sv: 'Tillbaka till {site}',
  de: 'Zurück zu {site}',
  fr: 'Retour sur {site}',
  tr: '{site} sitesine dön',
  ar: 'العودة إلى {site}',
};

// Messages that mention the placeholder render it literally ({order_number}
// is an ICU argument in the message catalog).
const ORDER_PLACEHOLDER_VALUES = { order_number: '{order_number}' };

/** Host shown in the default label preview ("example.se"), '' when unknown. */
function siteHostForPreview(raw: string): string {
  try {
    const host = new URL(raw.trim()).hostname;
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return '';
  }
}

export function CheckoutSettingsCard({ token, value, locales, onSaved, requestReauth }: Props) {
  const t = useTranslations('creator.settings.checkout');
  const uiLocale = useLocale();
  const describeError = useApiError();
  const [form, setForm] = useState<CheckoutSettingsForm>(() => toCheckoutForm(value));
  const [saved, setSaved] = useState<CheckoutSettingsForm>(() => toCheckoutForm(value));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // The API refused an external URL (P3): shown under that field.
  const [urlRejection, setUrlRejection] = useState<{ field: 'external_site_url' | 'return_url'; reason: ExternalUrlReason } | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  // A fresh store payload (e.g. after another card saved) re-seeds the form,
  // but only when the stored settings actually changed and never over
  // unsaved edits (same rule as useStoreAppSettingsForm).
  const lastSeeded = useRef(JSON.stringify(toCheckoutForm(value)));
  useEffect(() => {
    const next = toCheckoutForm(value);
    const json = JSON.stringify(next);
    if (json === lastSeeded.current) return;
    lastSeeded.current = json;
    if (dirty) return;
    setForm(next);
    setSaved(next);
  }, [value, dirty]);
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

  const returnModeOptions = RETURN_MODES.map((key) => ({
    value: key,
    label: t(`external.mode.${key}`),
    description: t(`external.mode.${key}Hint`),
  }));

  const update = (patch: Partial<CheckoutSettingsForm>) => {
    setMsg(null);
    setUrlRejection(null);
    setForm((f) => {
      const next = { ...f, ...patch };
      // The focused storefront and the after-payment button text need a
      // website address: emptying the address drops them from the form too.
      if (next.external_site_url.trim()) return next;
      const unfocused = next.external_focus ? withExternalFocus(next, false) : next;
      return unfocused.return_label ? withReturnLabel(unfocused, null) : unfocused;
    });
  };

  // PUT the form; with credentials when the external site URL changes.
  const persist = async (credentials?: ReauthCredentials) => {
    const body = toCheckoutBody(form, saved.external_site_url.trim() !== '', saved.external_focus === true, {
      noCustomerAccounts: saved.no_customer_accounts === true,
      returnLabel: Boolean(saved.return_label),
    });
    await api('/stores/my/store', {
      method: 'PUT',
      token,
      body: JSON.stringify({ checkout_settings: body, ...(credentials ?? {}) }),
    });
    setSaved(form);
    setMsg({ type: 'success', text: t('saved') });
    onSaved(body);
  };

  /** A refused external URL becomes a message under its field; true if handled. */
  const showUrlRejection = (err: unknown): boolean => {
    const rejection = externalUrlRejection(err);
    if (!rejection) return false;
    setUrlRejection(rejection);
    setMsg({ type: 'error', text: t(`external.reasons.${rejection.reason}`, ORDER_PLACEHOLDER_VALUES) });
    return true;
  };

  const handleSave = async () => {
    if (saving || hasErrors) return;
    setMsg(null);
    setUrlRejection(null);
    if (requestReauth && externalSiteNeedsReauth(form, saved)) {
      // Password errors stay in the dialog; a refused URL closes it and is
      // shown on the field instead.
      requestReauth(async (credentials) => {
        setSaving(true);
        try {
          await persist(credentials);
        } catch (err) {
          if (!showUrlRejection(err)) throw err;
        } finally {
          setSaving(false);
        }
      }, t('external.reauthDescription'));
      return;
    }
    setSaving(true);
    try {
      await persist();
    } catch (err) {
      if (!showUrlRejection(err)) setMsg({ type: 'error', text: describeError(err) });
    } finally {
      setSaving(false);
    }
  };

  const siteError = errors.external_site_url ?? (urlRejection?.field === 'external_site_url' ? urlRejection.reason : undefined);
  const returnError = errors.return_url ?? (urlRejection?.field === 'return_url' ? urlRejection.reason : undefined);
  const hasSite = form.external_site_url.trim() !== '';
  const previewHost = siteHostForPreview(form.external_site_url) || 'example.se';

  const applyNamez = () => {
    setMsg(null);
    // The Namez preset covers the M5.1 keys only; the external site, the
    // after-payment button text and the no-accounts option stay.
    setForm((f) => ({
      ...toCheckoutForm(NAMEZ_RECOMMENDED),
      external_site_url: f.external_site_url,
      return_url: f.return_url,
      return_mode: f.return_mode,
      back_label: f.back_label,
      ...(f.external_focus ? { external_focus: true } : {}),
      ...(f.no_customer_accounts ? { no_customer_accounts: true } : {}),
      ...(f.return_label ? { return_label: f.return_label } : {}),
    }));
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

        {/* Store without customer accounts: no account email, no "view your
            order" link. The customer record is still saved. */}
        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t('noAccounts')}</p>
            <p className="text-[11px] text-muted-foreground">{t('noAccountsHint')}</p>
          </div>
          <ToggleSwitch
            id="ck_no_customer_accounts"
            checked={form.no_customer_accounts === true}
            onChange={(checked) => {
              setMsg(null);
              setUrlRejection(null);
              setForm((f) => withNoCustomerAccounts(f, checked));
            }}
            label={t('noAccounts')}
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

        {/* External website (headless booking P3): where the shopper goes
            back to after paying. Empty = today's behaviour. */}
        <div className="space-y-3 border-t pt-4">
          <div className="space-y-0.5">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <ExternalLink className="size-3.5" aria-hidden="true" />
              {t('external.title')}
            </p>
            <p className="text-[11px] text-muted-foreground">{t('external.subtitle')}</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ck_external_site" className="text-xs">{t('external.siteUrl')}</Label>
            <Input
              id="ck_external_site"
              dir="ltr"
              type="url"
              inputMode="url"
              value={form.external_site_url}
              placeholder="https://example.se"
              onChange={(e) => update({ external_site_url: e.target.value })}
              aria-invalid={siteError ? true : undefined}
            />
            {siteError ? (
              <p className="text-[11px] text-red-600">{t(`external.reasons.${siteError}`, ORDER_PLACEHOLDER_VALUES)}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">{t('external.siteUrlHint')}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="ck_return_url" className="text-xs">{t('external.returnUrl')}</Label>
            <Input
              id="ck_return_url"
              dir="ltr"
              value={form.return_url}
              placeholder="https://example.se/tack?order={order_number}"
              onChange={(e) => update({ return_url: e.target.value })}
              aria-invalid={returnError ? true : undefined}
              disabled={!hasSite && !form.return_url}
            />
            {returnError ? (
              <p className="text-[11px] text-red-600">{t(`external.reasons.${returnError}`, ORDER_PLACEHOLDER_VALUES)}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">{t('external.returnUrlHint', ORDER_PLACEHOLDER_VALUES)}</p>
            )}
          </div>
          {/* Focused storefront: the store becomes a purchase step of the
              website. Needs a website address; off = today's storefront. */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className={`text-xs font-medium ${hasSite ? '' : 'text-muted-foreground'}`}>{t('external.focus')}</p>
              <p className="text-[11px] text-muted-foreground">
                {hasSite ? t('external.focusHint') : t('external.focusNeedsSite')}
              </p>
            </div>
            <ToggleSwitch
              id="ck_external_focus"
              checked={hasSite && form.external_focus === true}
              disabled={!hasSite}
              onChange={(checked) => {
                setMsg(null);
                setUrlRejection(null);
                setForm((f) => withExternalFocus(f, checked));
              }}
              label={t('external.focus')}
            />
          </div>
          {hasSite && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="ck_return_mode" className="text-xs">{t('external.returnMode')}</Label>
                <SearchableSelect
                  id="ck_return_mode"
                  options={returnModeOptions}
                  value={form.return_mode}
                  onChange={(v) => update({ return_mode: v as ReturnMode })}
                />
              </div>
              <div className="space-y-2">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">{t('external.backLabel')}</p>
                  <p className="text-[11px] text-muted-foreground">{t('external.backLabelHint', { max: MAX_PAY_BUTTON_LABEL })}</p>
                </div>
                {locales.map((locale) => {
                  const current = form.back_label[locale] ?? '';
                  const fallback = (DEFAULT_BACK_LABEL[locale] || DEFAULT_BACK_LABEL.en).replace('{site}', previewHost);
                  const tooLong = errors.back_label === locale;
                  return (
                    <div key={locale} className="space-y-1">
                      <Label htmlFor={`ck_back_${locale}`} className="text-xs">
                        {localeNames(locale)} <span className="font-mono text-muted-foreground">({locale})</span>
                      </Label>
                      <Input
                        id={`ck_back_${locale}`}
                        dir={locale === 'ar' ? 'rtl' : 'ltr'}
                        value={current}
                        maxLength={MAX_PAY_BUTTON_LABEL + 20}
                        placeholder={fallback}
                        onChange={(e) => update({ back_label: { ...form.back_label, [locale]: e.target.value } })}
                        aria-invalid={tooLong || undefined}
                      />
                      {tooLong && <p className="text-[11px] text-red-600">{t('payLabelTooLong', { max: MAX_PAY_BUTTON_LABEL })}</p>}
                    </div>
                  );
                })}
              </div>
              {/* Text of the return button on the paid confirmation page only;
                  empty = the button text above (or the standard text). */}
              <div className="space-y-2">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">{t('external.returnLabel')}</p>
                  <p className="text-[11px] text-muted-foreground">{t('external.returnLabelHint', { max: MAX_PAY_BUTTON_LABEL })}</p>
                </div>
                {locales.map((locale) => {
                  const current = form.return_label?.[locale] ?? '';
                  const fallback =
                    (form.back_label[locale] ?? '').trim() ||
                    (DEFAULT_BACK_LABEL[locale] || DEFAULT_BACK_LABEL.en).replace('{site}', previewHost);
                  const tooLong = errors.return_label === locale;
                  return (
                    <div key={locale} className="space-y-1">
                      <Label htmlFor={`ck_return_label_${locale}`} className="text-xs">
                        {localeNames(locale)} <span className="font-mono text-muted-foreground">({locale})</span>
                      </Label>
                      <Input
                        id={`ck_return_label_${locale}`}
                        dir={locale === 'ar' ? 'rtl' : 'ltr'}
                        value={current}
                        maxLength={MAX_PAY_BUTTON_LABEL + 20}
                        placeholder={fallback}
                        onChange={(e) => {
                          setMsg(null);
                          setUrlRejection(null);
                          setForm((f) => withReturnLabel(f, locale, e.target.value));
                        }}
                        aria-invalid={tooLong || undefined}
                      />
                      {tooLong && <p className="text-[11px] text-red-600">{t('payLabelTooLong', { max: MAX_PAY_BUTTON_LABEL })}</p>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            {t('external.reauthNote')}
          </p>
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
