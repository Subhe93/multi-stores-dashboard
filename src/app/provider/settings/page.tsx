'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { Upload, ImageIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useImageUpload } from '@/lib/useImageUpload';
import { useTranslations } from 'next-intl';

interface StripeConnectStatus {
  connected: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarding_completed: boolean;
}

export default function ProviderSettings() {
  const t = useTranslations('provider');
  const tc = useTranslations('common');
  const countries = [
    { value: 'DE', label: t('countryDE'), description: 'Deutschland' },
    { value: 'AT', label: t('countryAT'), description: 'Österreich' },
    { value: 'CH', label: t('countryCH'), description: 'Schweiz' },
    { value: 'FR', label: t('countryFR') },
    { value: 'NL', label: t('countryNL') },
    { value: 'TR', label: t('countryTR'), description: 'Türkiye' },
    { value: 'SA', label: t('countrySA') },
    { value: 'AE', label: t('countryAE') },
    { value: 'US', label: t('countryUS') },
    { value: 'GB', label: t('countryGB') },
  ];
  const { token } = useAuth();
  const { pickAndUpload, uploading } = useImageUpload(token);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // Stripe Connect (payout account) state
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus | null>(null);
  const [stripeLoading, setStripeLoading] = useState(true);
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeError, setStripeError] = useState('');

  useEffect(() => {
    if (!token) return;
    api<any>('/providers/me', { token })
      .then((p) => {
        setProfile(p);
        setCompanyName(p.company_name || '');
        setDescription(p.description || '');
        setPhone(p.phone || '');
        setCountry(p.country || '');
        setLogoUrl(p.logo_url || '');
      })
      .catch(console.error)
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
    } catch (err: any) {
      setStripeError(err?.message || t('stripeConnectError'));
      setStripeConnecting(false);
    }
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await api('/providers/me', {
        method: 'PUT', token,
        body: JSON.stringify({ company_name: companyName, description, phone, country, logo_url: logoUrl || undefined }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('settings')}</h1>
        <p className="text-sm text-muted-foreground">{t('settingsSubtitle')}</p>
      </div>

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
                  {uploading ? t('uploading') : <><Upload className="w-3 h-3 mr-1" /> {t('uploadLogo')}</>}
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

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">{t('stripeConnect')}</CardTitle>
            {!stripeLoading && (
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  stripeStatus?.payouts_enabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : stripeStatus?.connected
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                }`}
              >
                {stripeStatus?.payouts_enabled
                  ? t('payoutsEnabled')
                  : stripeStatus?.connected
                    ? t('onboardingPending')
                    : t('notConnected')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">{t('stripeConnectHint')}</p>
          {stripeError && <p className="text-[11px] text-destructive mb-2">{stripeError}</p>}
          {stripeStatus?.payouts_enabled ? (
            <span className="inline-flex h-6 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="size-3.5" />
              {t('payoutsEnabled')}
            </span>
          ) : (
            <Button size="sm" onClick={handleConnectStripe} disabled={stripeConnecting || stripeLoading}>
              {stripeConnecting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : stripeStatus?.connected ? (
                t('completeStripeSetup')
              ) : (
                t('connectStripeAccount')
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 justify-end">
        {saved && <span className="text-xs text-emerald-600 font-medium">{t('settingsSaved')}</span>}
        <Button size="sm" onClick={handleSave} disabled={saving || loading}>
          {saving ? tc('saving') : t('saveChanges')}
        </Button>
      </div>
    </div>
  );
}
