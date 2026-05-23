'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { clearCurrencyCache } from '@/lib/useCurrency';
import { CURRENCIES } from '@/lib/currencies';

interface PlatformConfig {
  commission_type: string;
  commission_value: number;
  default_currency: string;
  default_locale: string;
  supported_locales: string[];
  platform_name: string;
  support_email: string | null;
  min_order_amount: number | null;
  require_provider_approval: boolean;
  require_creator_approval: boolean;
}

interface StripeSettings {
  publishableKey: string | null;
  secretKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  usingEnvFallback: boolean;
}

interface SmtpSettings {
  host: string | null;
  port: number | null;
  secure: boolean;
  user: string | null;
  from: string | null;
  passwordSet: boolean;
  configured: boolean;
  usingEnvFallback: boolean;
}

const LOCALES = [
  { value: 'en', label: 'English', description: 'English (en)' },
  { value: 'ar', label: 'العربية', description: 'Arabic (ar)' },
  { value: 'tr', label: 'Türkçe', description: 'Turkish (tr)' },
  { value: 'de', label: 'Deutsch', description: 'German (de)' },
  { value: 'fr', label: 'Français', description: 'French (fr)' },
  { value: 'sv', label: 'Svenska', description: 'Swedish (sv)' },
];

const ALL_LOCALE_CODES = LOCALES.map(l => l.value);

export default function AdminSettings() {
  const t = useTranslations('admin');
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState<PlatformConfig>({
    commission_type: 'percentage',
    commission_value: 15,
    default_currency: 'EUR',
    default_locale: 'en',
    supported_locales: ['en'],
    platform_name: 'Multi Stores',
    support_email: '',
    min_order_amount: null,
    require_provider_approval: true,
    require_creator_approval: true,
  });

  // Platform Stripe settings (separate, admin-only endpoint — secrets are never
  // returned, only whether they are configured).
  const [stripe, setStripe] = useState<StripeSettings>({
    publishableKey: null,
    secretKeyConfigured: false,
    webhookSecretConfigured: false,
    usingEnvFallback: false,
  });
  const [stripePublishable, setStripePublishable] = useState('');
  const [stripeSecret, setStripeSecret] = useState('');
  const [stripeWebhook, setStripeWebhook] = useState('');
  const [stripeSaving, setStripeSaving] = useState(false);
  const [stripeSaved, setStripeSaved] = useState(false);

  // Platform SMTP settings (admin-only; password never returned).
  const [smtp, setSmtp] = useState<SmtpSettings>({
    host: null, port: null, secure: false, user: null, from: null,
    passwordSet: false, configured: false, usingEnvFallback: false,
  });
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpSaved, setSmtpSaved] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    api<PlatformConfig>('/admin/platform-config', { token })
      .then(config => {
        if (config) setForm({
          commission_type: config.commission_type || 'percentage',
          commission_value: Number(config.commission_value) || 15,
          default_currency: config.default_currency || 'EUR',
          default_locale: config.default_locale || 'en',
          supported_locales: config.supported_locales?.length ? config.supported_locales : ['en'],
          platform_name: config.platform_name || 'Multi Stores',
          support_email: config.support_email || '',
          min_order_amount: config.min_order_amount ? Number(config.min_order_amount) : null,
          require_provider_approval: config.require_provider_approval ?? true,
          require_creator_approval: config.require_creator_approval ?? true,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api<StripeSettings>('/payments/admin/settings', { token })
      .then((s) => {
        if (s) {
          setStripe(s);
          setStripePublishable(s.publishableKey || '');
        }
      })
      .catch(console.error);
  }, [token]);

  const handleSaveStripe = async () => {
    if (!token) return;
    setStripeSaving(true);
    setStripeSaved(false);
    try {
      const body: Record<string, string> = { publishable_key: stripePublishable };
      // Only send secrets when the admin typed a new value; blank leaves them unchanged.
      if (stripeSecret.trim()) body.secret_key = stripeSecret.trim();
      if (stripeWebhook.trim()) body.webhook_secret = stripeWebhook.trim();
      const updated = await api<StripeSettings>('/payments/admin/settings', {
        method: 'PUT',
        token,
        body: JSON.stringify(body),
      });
      setStripe(updated);
      setStripePublishable(updated.publishableKey || '');
      setStripeSecret('');
      setStripeWebhook('');
      setStripeSaved(true);
      setTimeout(() => setStripeSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setStripeSaving(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    api<SmtpSettings>('/mail/admin/settings', { token })
      .then((s) => {
        if (s) {
          setSmtp(s);
          setSmtpHost(s.host || '');
          setSmtpPort(s.port != null ? String(s.port) : '587');
          setSmtpSecure(!!s.secure);
          setSmtpUser(s.user || '');
          setSmtpFrom(s.from || '');
        }
      })
      .catch(console.error);
  }, [token]);

  const handleSaveSmtp = async () => {
    if (!token) return;
    setSmtpSaving(true);
    setSmtpSaved(false);
    try {
      const body: Record<string, unknown> = {
        host: smtpHost,
        port: smtpPort ? parseInt(smtpPort, 10) : null,
        secure: smtpSecure,
        user: smtpUser,
        from: smtpFrom,
      };
      // Only send the password when the admin typed a new one.
      if (smtpPassword.trim()) body.password = smtpPassword.trim();
      const updated = await api<SmtpSettings>('/mail/admin/settings', {
        method: 'PUT', token, body: JSON.stringify(body),
      });
      setSmtp(updated);
      setSmtpPassword('');
      setSmtpSaved(true);
      setTimeout(() => setSmtpSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!token || testing) return;
    setTesting(true);
    setTestMsg(null);
    try {
      await api('/mail/admin/test', {
        method: 'POST', token,
        body: JSON.stringify(testEmail.trim() ? { to: testEmail.trim() } : {}),
      });
      setTestMsg({ type: 'success', text: t('smtpTestSent') });
    } catch (err: any) {
      setTestMsg({ type: 'error', text: err?.message || t('smtpTestFailed') });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setSaved(false);
    try {
      await api('/admin/platform-config', {
        method: 'PUT',
        token,
        body: JSON.stringify({
          ...form,
          commission_value: parseFloat(String(form.commission_value)),
          min_order_amount: form.min_order_amount ? parseFloat(String(form.min_order_amount)) : null,
          support_email: form.support_email || null,
        }),
      });
      clearCurrencyCache();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleLocale = (code: string) => {
    if (code === form.default_locale) return; // can't remove the default locale
    setForm(prev => ({
      ...prev,
      supported_locales: prev.supported_locales.includes(code)
        ? prev.supported_locales.filter(l => l !== code)
        : [...prev.supported_locales, code],
    }));
  };

  const setField = <K extends keyof PlatformConfig>(key: K, value: PlatformConfig[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  if (loading) return <p className="text-sm text-muted-foreground py-12 text-center">{t('loading')}</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('platformSettings')}</h1>
        <p className="text-sm text-muted-foreground">{t('platformSettingsSubtitle')}</p>
      </div>

      {/* Platform Info */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t('platformInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('platformName')}</Label>
              <Input
                className="h-8 text-sm"
                value={form.platform_name}
                onChange={e => setField('platform_name', e.target.value)}
                placeholder="Multi Stores"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('supportEmail')}</Label>
              <Input
                className="h-8 text-sm"
                type="email"
                value={form.support_email || ''}
                onChange={e => setField('support_email', e.target.value)}
                placeholder="support@platform.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commission */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">{t('commissionRate')}</CardTitle>
            <Badge variant="secondary" className="text-[10px]">{t('appliedToAllTransactions')}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('type')}</Label>
              <SearchableSelect
                value={form.commission_type}
                onChange={v => setField('commission_type', v)}
                placeholder={t('selectType')}
                options={[
                  { value: 'percentage', label: t('commissionPercentage'), description: t('commissionPercentageDesc') },
                  { value: 'fixed', label: t('commissionFixed'), description: t('commissionFixedDesc') },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('value')}</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  className="h-8 text-sm pr-8"
                  value={form.commission_value}
                  onChange={e => setField('commission_value', parseFloat(e.target.value) || 0)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {form.commission_type === 'percentage' ? '%' : form.default_currency}
                </span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {t('commissionExplanation', { rate: `${form.commission_value}${form.commission_type === 'percentage' ? '%' : form.default_currency}` })}
          </p>
        </CardContent>
      </Card>

      {/* Currency & Locale */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t('currencyAndLanguage')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('defaultCurrency')}</Label>
              <SearchableSelect
                value={form.default_currency}
                onChange={v => setField('default_currency', v)}
                placeholder={t('selectCurrency')}
                searchPlaceholder={t('searchCurrencies')}
                options={CURRENCIES}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('defaultLanguage')}</Label>
              <SearchableSelect
                value={form.default_locale}
                onChange={v => {
                  // When changing default locale, make sure it's in supported list
                  setForm(prev => ({
                    ...prev,
                    default_locale: v,
                    supported_locales: prev.supported_locales.includes(v)
                      ? prev.supported_locales
                      : [...prev.supported_locales, v],
                  }));
                }}
                placeholder={t('selectLanguage')}
                options={LOCALES}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">{t('supportedLanguages')}</Label>
            <div className="flex flex-wrap gap-2">
              {LOCALES.map(locale => {
                const isEnabled = form.supported_locales.includes(locale.value);
                const isDefault = form.default_locale === locale.value;
                return (
                  <button
                    key={locale.value}
                    type="button"
                    onClick={() => toggleLocale(locale.value)}
                    className={`px-3 py-1.5 rounded-md border text-xs font-medium transition ${
                      isEnabled
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    {locale.label}
                    {isDefault && <span className="ml-1.5 opacity-60 text-[10px]">{t('defaultLabel')}</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {t('creatorsActivateLanguagesHint')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Order Limits */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t('orderLimits')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-w-xs">
            <Label className="text-xs">{t('minimumOrderAmount', { currency: form.default_currency })}</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                className="h-8 text-sm pr-10"
                placeholder={t('noMinimum')}
                value={form.min_order_amount ?? ''}
                onChange={e => setField('min_order_amount', e.target.value ? parseFloat(e.target.value) : null)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {form.default_currency}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">{t('leaveBlankAnyAmount')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Registration Approvals */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t('registrationApprovals')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {t('registrationApprovalsHint')}
          </p>
          <Separator />
          <label className="flex items-center justify-between py-1 cursor-pointer group">
            <div>
              <p className="text-sm font-medium">{t('providerApprovalRequired')}</p>
              <p className="text-[11px] text-muted-foreground">{t('providerApprovalHint')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.require_provider_approval}
              onClick={() => setField('require_provider_approval', !form.require_provider_approval)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                form.require_provider_approval ? 'bg-zinc-900' : 'bg-zinc-200'
              }`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                form.require_provider_approval ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </label>
          <Separator />
          <label className="flex items-center justify-between py-1 cursor-pointer group">
            <div>
              <p className="text-sm font-medium">{t('creatorApprovalRequired')}</p>
              <p className="text-[11px] text-muted-foreground">{t('creatorApprovalHint')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.require_creator_approval}
              onClick={() => setField('require_creator_approval', !form.require_creator_approval)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                form.require_creator_approval ? 'bg-zinc-900' : 'bg-zinc-200'
              }`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                form.require_creator_approval ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </label>
        </CardContent>
      </Card>

      {/* Payments — platform Stripe account */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">{t('paymentsStripe')}</CardTitle>
            <Badge
              variant={stripe.secretKeyConfigured ? 'default' : 'secondary'}
              className="text-[10px]"
            >
              {stripe.secretKeyConfigured ? t('stripeConfigured') : t('stripeNotConfigured')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">{t('paymentsStripeSubtitle')}</p>
          {stripe.usingEnvFallback && (
            <p className="text-[11px] rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
              {t('stripeUsingEnvFallback')}
            </p>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">{t('stripePublishableKey')}</Label>
            <Input
              className="h-8 text-sm font-mono"
              value={stripePublishable}
              onChange={(e) => setStripePublishable(e.target.value)}
              placeholder="pk_live_… / pk_test_…"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t('stripeSecretKey')}</Label>
            <Input
              className="h-8 text-sm font-mono"
              type="password"
              autoComplete="off"
              value={stripeSecret}
              onChange={(e) => setStripeSecret(e.target.value)}
              placeholder={stripe.secretKeyConfigured ? t('stripeKeyConfiguredPlaceholder') : 'sk_live_… / sk_test_…'}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t('stripeWebhookSecret')}</Label>
            <Input
              className="h-8 text-sm font-mono"
              type="password"
              autoComplete="off"
              value={stripeWebhook}
              onChange={(e) => setStripeWebhook(e.target.value)}
              placeholder={stripe.webhookSecretConfigured ? t('stripeKeyConfiguredPlaceholder') : 'whsec_…'}
            />
            <p className="text-[10px] text-muted-foreground">{t('stripeWebhookHint')}</p>
          </div>

          <div className="flex items-center gap-3 justify-end">
            {stripeSaved && <span className="text-xs text-emerald-600 font-medium">{t('settingsSavedSuccessfully')}</span>}
            <Button size="sm" onClick={handleSaveStripe} disabled={stripeSaving}>
              {stripeSaving ? t('saving') : t('saveSettings')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email — platform SMTP */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">{t('emailSmtp')}</CardTitle>
            <Badge variant={smtp.configured ? 'default' : 'secondary'} className="text-[10px]">
              {smtp.configured ? t('stripeConfigured') : t('stripeNotConfigured')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">{t('emailSmtpSubtitle')}</p>
          {smtp.usingEnvFallback && (
            <p className="text-[11px] rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
              {t('smtpUsingEnvFallback')}
            </p>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">{t('smtpHost')}</Label>
              <Input className="h-8 text-sm font-mono" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.example.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('smtpPort')}</Label>
              <Input className="h-8 text-sm" type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('smtpUser')}</Label>
              <Input className="h-8 text-sm font-mono" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('smtpPassword')}</Label>
              <Input className="h-8 text-sm font-mono" type="password" autoComplete="off" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} placeholder={smtp.passwordSet ? t('stripeKeyConfiguredPlaceholder') : ''} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 items-end">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">{t('smtpFrom')}</Label>
              <Input className="h-8 text-sm" value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} placeholder="Multi Stores <no-reply@yourdomain.com>" />
            </div>
            <label className="flex items-center gap-2 h-8 cursor-pointer select-none">
              <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} className="w-4 h-4 rounded border-zinc-300" />
              <span className="text-xs">{t('smtpSecure')}</span>
            </label>
          </div>

          <div className="flex items-center gap-3 justify-end">
            {smtpSaved && <span className="text-xs text-emerald-600 font-medium">{t('settingsSavedSuccessfully')}</span>}
            <Button size="sm" onClick={handleSaveSmtp} disabled={smtpSaving}>
              {smtpSaving ? t('saving') : t('saveSettings')}
            </Button>
          </div>

          {/* Test email */}
          <div className="border-t pt-3 space-y-2">
            <Label className="text-xs">{t('smtpTest')}</Label>
            <div className="flex gap-2">
              <Input className="h-8 text-sm flex-1" type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder={t('smtpTestPlaceholder')} />
              <Button size="sm" variant="outline" onClick={handleTestEmail} disabled={testing || !smtp.configured}>
                {testing ? '…' : t('smtpSendTest')}
              </Button>
            </div>
            {testMsg && (
              <p className={`text-[11px] ${testMsg.type === 'success' ? 'text-emerald-600' : 'text-destructive'}`}>{testMsg.text}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 justify-end">
        {saved && <span className="text-xs text-emerald-600 font-medium">{t('settingsSavedSuccessfully')}</span>}
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? t('saving') : t('saveSettings')}
        </Button>
      </div>
    </div>
  );
}
