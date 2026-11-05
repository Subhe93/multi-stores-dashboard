'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { Upload, ImageIcon, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth, type ProviderProfile } from '@/lib/auth';
import { api } from '@/lib/api';
import { useImageUpload } from '@/lib/useImageUpload';
import { useLocale, useTranslations } from 'next-intl';
import { taxCountryOptions } from '@/lib/taxCountries';
import { TwoFactorCard } from '@/components/security/TwoFactorCard';
import { ChangePasswordCard } from '@/components/security/ChangePasswordCard';
import { useReauth } from '@/components/security/ReauthDialog';
import { useApiError } from '@/lib/useApiError';

/** GET /providers/me — auth profile plus the editable logo. */
interface ProviderMe extends ProviderProfile {
  logo_url?: string | null;
}

interface StripeConnectStatus {
  connected: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarding_completed: boolean;
  /** The account kind does not match the payout model; onboarding replaces it. */
  requires_relink?: boolean;
}

export default function ProviderSettings() {
  const t = useTranslations('provider');
  const tc = useTranslations('common');
  // Account/security strings shared with the creator settings page.
  const tcs = useTranslations('creator.settings');
  const ts = useTranslations('security');
  const describeError = useApiError();
  const locale = useLocale();
  const { token, user } = useAuth();
  // Disconnecting the payout account asks for the password (and 2FA code) first.
  const reauth = useReauth({ twoFactorSetupHref: '#two-factor' });
  const { pickAndUpload, uploading } = useImageUpload(token);
  const [profile, setProfile] = useState<ProviderMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  // Full localized country list (same source as the trader details form);
  // keeps a stored code that is not in the list selectable.
  const countries = useMemo(() => taxCountryOptions(locale, country ? [country] : []), [locale, country]);
  const [logoUrl, setLogoUrl] = useState('');

  // Stripe Connect (payout account) state
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus | null>(null);
  const [stripeLoading, setStripeLoading] = useState(true);
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeError, setStripeError] = useState('');
  // Stripe disconnect (two-step confirm, then re-auth)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (!token) return;
    api<ProviderMe>('/providers/me', { token })
      .then((p) => {
        setProfile(p);
        setCompanyName(p.company_name || '');
        setDescription(p.description || '');
        setPhone(p.phone || '');
        setCountry(p.country || '');
        setLogoUrl(p.logo_url || '');
      })
      .catch((err) => setSaveError(describeError(err)))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setStripeLoading(true);
    api<StripeConnectStatus>('/payments/connect/status', { token })
      .then(setStripeStatus)
      .catch(() => setStripeStatus(null))
      .finally(() => setStripeLoading(false));
  }, [token]);

  const handleConnectStripe = async () => {
    if (!token || stripeConnecting) return;
    setStripeConnecting(true);
    setStripeError('');
    try {
      const { url } = await api<{ url: string }>('/payments/connect/onboarding-link', { token });
      window.location.href = url;
    } catch (err) {
      setStripeError(err instanceof Error && err.message ? err.message : t('stripeConnectError'));
      setStripeConnecting(false);
    }
  };

  const handleDisconnectStripe = () => {
    if (!token || disconnecting) return;
    setStripeError('');
    // Errors are shown inside the re-auth dialog, which stays open to retry.
    reauth.request(async (credentials) => {
      setDisconnecting(true);
      try {
        await api('/payments/connect/disconnect', {
          method: 'POST',
          token,
          body: JSON.stringify(credentials),
        });
        const fresh = await api<StripeConnectStatus>('/payments/connect/status', { token });
        setStripeStatus(fresh);
        setConfirmDisconnect(false);
      } finally {
        setDisconnecting(false);
      }
    }, ts('reauth.disconnectDescription'));
  };

  /** Maps a failed PUT /providers/me to a friendly message. */
  const saveErrorMessage = (err: unknown): string => {
    const e = err as { code?: string; status?: number; errors?: string[]; message?: string } | null;
    if (e?.code) return describeError(err);
    if (e?.status === 400) {
      // Raw class-validator output names the offending field.
      const text = (e.errors ?? [e.message ?? '']).join(' ').toLowerCase();
      if (text.includes('company_name')) return t('companyNameInvalid');
      if (text.includes('country')) return t('countryInvalid');
      if (text.includes('logo_url')) return t('logoInvalid');
    }
    return t('settingsSaveFailed');
  };

  const handleSave = async () => {
    if (!token) return;
    setSaveError('');
    setSaved(false);
    const name = companyName.trim();
    if (name.length < 2 || name.length > 100) {
      setSaveError(t('companyNameInvalid'));
      return;
    }
    setSaving(true);
    try {
      await api('/providers/me', {
        method: 'PUT', token,
        body: JSON.stringify({
          company_name: name,
          description,
          phone,
          // The API needs a 2-letter code; an unset country is left out.
          country: country || undefined,
          // null clears a removed logo (undefined would keep the stored one).
          logo_url: logoUrl || null,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(saveErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const requiresRelink = !!stripeStatus?.requires_relink;
  const stripeReady = !!stripeStatus?.payouts_enabled && !requiresRelink;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('settings')}</h1>
        <p className="text-sm text-muted-foreground">{t('settingsSubtitle')}</p>
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{tcs('accountInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label className="text-xs">{tcs('email')}</Label>
            <Input value={user?.email || ''} disabled className="h-9 text-sm" placeholder={tc('loading')} />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t('companyInformation')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('companyLogo')}</Label>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-lg border bg-zinc-50 overflow-hidden flex items-center justify-center shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt={t('companyLogo')} className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-zinc-300" />
                )}
              </div>
              <div>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={uploading}
                  onClick={async () => {
                    const imgs = await pickAndUpload('logos', false);
                    if (imgs.length) setLogoUrl(imgs[0]!.url);
                  }}>
                  {uploading ? t('uploading') : <><Upload className="w-3 h-3 me-1" /> {t('uploadLogo')}</>}
                </Button>
                {logoUrl && (
                  <button onClick={() => setLogoUrl('')} className="block text-[10px] text-red-500 mt-1 hover:underline">{t('removeLogo')}</button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t('companyName')}</Label>
            <Input className="h-9 text-sm" value={companyName} onChange={e => setCompanyName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{tc('description')}</Label>
            <textarea rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('phone')}</Label>
              <Input className="h-9 text-sm" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('country')}</Label>
              <SearchableSelect
                value={country}
                onChange={setCountry}
                placeholder={t('selectCountry')}
                searchPlaceholder={t('searchCountries')}
                options={countries}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Saves the company information above. */}
      <div className="space-y-2">
        {saveError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            {saveError}
          </div>
        )}
        <div className="flex items-center gap-3 justify-end">
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="size-3.5" />
              {t('settingsSaved')}
            </span>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving || loading}>
            {saving ? tc('saving') : t('saveChanges')}
          </Button>
        </div>
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">{t('stripeConnect')}</CardTitle>
            {!stripeLoading && (
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  stripeReady
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : stripeStatus?.connected
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                }`}
              >
                {stripeReady
                  ? t('payoutsEnabled')
                  : stripeStatus?.connected
                    ? requiresRelink
                      ? tcs('stripeRelinkRequired')
                      : t('onboardingPending')
                    : t('notConnected')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('stripeConnectHint')}</p>
          {stripeError && <p className="text-[11px] text-destructive">{stripeError}</p>}
          {stripeLoading ? (
            <div className="h-7 w-40 animate-pulse rounded bg-zinc-100" />
          ) : stripeReady ? (
            <span className="inline-flex h-6 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="size-3.5" />
              {t('payoutsEnabled')}
            </span>
          ) : (
            <Button size="sm" onClick={handleConnectStripe} disabled={stripeConnecting}>
              {stripeConnecting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : requiresRelink ? (
                tcs('reconnectStripe')
              ) : stripeStatus?.connected ? (
                t('completeStripeSetup')
              ) : (
                t('connectStripeAccount')
              )}
            </Button>
          )}

          {/* Disconnect: unlinks the account and stops payouts until a new
              account is connected (two-step confirm, then re-auth). */}
          {!stripeLoading && stripeStatus?.connected && (
            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <p className="text-[11px] text-muted-foreground">{tcs('disconnectStripeHint')}</p>
              {confirmDisconnect ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setConfirmDisconnect(false)} disabled={disconnecting}>
                    {tc('cancel')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    onClick={handleDisconnectStripe}
                    disabled={disconnecting}
                  >
                    {disconnecting && <Loader2 className="size-3.5 animate-spin" />}
                    {tcs('disconnectConfirm')}
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setConfirmDisconnect(true)}
                >
                  {tcs('disconnectStripe')}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ChangePasswordCard />

      <TwoFactorCard />

      {reauth.dialog}
    </div>
  );
}
