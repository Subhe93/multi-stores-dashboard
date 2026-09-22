'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, Camera, CheckCircle2, ExternalLink, Loader2, RefreshCw, Trash2, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useImageUpload } from '@/lib/useImageUpload';
import { clearCurrencyCache } from '@/lib/useCurrency';
import { CURRENCIES } from '@/lib/currencies';
import { countryName, taxCountryOptions } from '@/lib/taxCountries';
import { localizedTaxText, type MyTaxSettings, type TaxBasis, type TaxPricingMode } from '@/lib/taxRate';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '');
function resolveAvatarUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  email: string;
  avatar_url?: string;
  creator?: {
    display_name?: string;
  };
}

interface StoreInfo {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  cache_enabled: boolean;
  // Cash on delivery availability at checkout (off by default).
  cod_enabled?: boolean;
  store_type?: 'MARKETPLACE' | 'INDEPENDENT';
  // Presentment currency. Null means the platform default; only independent
  // stores may set it (they charge on their own connected account).
  currency?: string | null;
}

// Editable subset of GET /taxes/my/settings (the PUT body).
type TaxSettingsForm = Pick<
  MyTaxSettings,
  'pricing_mode' | 'basis' | 'tax_country' | 'oss_registered' | 'use_platform_tax_rates' | 'shipping_tax_class_id' | 'display_prices_incl_tax'
>;

function pickTaxForm(s: MyTaxSettings): TaxSettingsForm {
  return {
    pricing_mode: s.pricing_mode === 'EXCLUSIVE' ? 'EXCLUSIVE' : 'INCLUSIVE',
    basis: s.basis === 'BILLING' || s.basis === 'STORE' ? s.basis : 'SHIPPING',
    tax_country: s.tax_country || null,
    oss_registered: !!s.oss_registered,
    use_platform_tax_rates: s.use_platform_tax_rates !== false,
    shipping_tax_class_id: s.shipping_tax_class_id || null,
    display_prices_incl_tax: s.display_prices_incl_tax !== false,
  };
}

interface StripeConnectStatus {
  connected: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarding_completed: boolean;
  account_type?: 'express' | 'standard' | null;
  // True when an independent store still points at a legacy Express account;
  // the next connect click replaces it with a Standard account.
  requires_relink?: boolean;
}

type KustomEnvironment = 'playground' | 'production';

// Mirrors the API contract: the shared secret is never returned, only whether
// one is stored.
interface KustomSettings {
  supported: boolean;
  enabled: boolean;
  merchant_id: string | null;
  secret_configured: boolean;
  environment: KustomEnvironment;
  /** Store presentment currency and whether Kustom can process it. */
  currency?: string;
  currency_supported?: boolean;
  ready: boolean;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreatorSettingsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const t = useTranslations('creator');
  const tc = useTranslations('common');
  const locale = useLocale();
  const taxCountryOpts = useMemo(() => taxCountryOptions(locale), [locale]);
  const { upload, uploading } = useImageUpload(token ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // User profile state
  const [user, setUser] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Store state
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);

  // Manual storefront cache flush
  const [flushing, setFlushing] = useState(false);
  const [flushMsg, setFlushMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Storefront caching on/off toggle
  const [cacheSaving, setCacheSaving] = useState(false);

  // Cash-on-delivery on/off toggle
  const [codSaving, setCodSaving] = useState(false);
  const [codMsg, setCodMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Store currency (independent stores only)
  const [currencySaving, setCurrencySaving] = useState(false);
  const [currencyMsg, setCurrencyMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Taxes (GET/PUT /taxes/my/settings). Marketplace stores are platform-managed
  // (registrant PLATFORM) and only see a note; independent stores edit the
  // store fields and save them explicitly.
  const [taxSettings, setTaxSettings] = useState<MyTaxSettings | null>(null);
  const [taxForm, setTaxForm] = useState<TaxSettingsForm | null>(null);
  const [taxLoading, setTaxLoading] = useState(true);
  const [taxLoadError, setTaxLoadError] = useState(false);
  const [taxSaving, setTaxSaving] = useState(false);
  const [taxMsg, setTaxMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Number of the store's own rate rows (independent stores) for the Kustom hint.
  const [ownTaxRatesCount, setOwnTaxRatesCount] = useState<number | null>(null);

  // Stripe disconnect (two-step confirm)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Stripe Connect (payout account) state
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus | null>(null);
  const [stripeLoading, setStripeLoading] = useState(true);
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeError, setStripeError] = useState('');

  // Kustom Checkout (independent stores only)
  const [kustom, setKustom] = useState<KustomSettings | null>(null);
  const [kustomLoading, setKustomLoading] = useState(false);
  const [kustomLoadError, setKustomLoadError] = useState(false);
  const [kustomMerchantId, setKustomMerchantId] = useState('');
  const [kustomSecret, setKustomSecret] = useState('');
  const [kustomEnvironment, setKustomEnvironment] = useState<KustomEnvironment>('playground');
  const [kustomEnabled, setKustomEnabled] = useState(false);
  const [kustomSaving, setKustomSaving] = useState(false);
  const [kustomTesting, setKustomTesting] = useState(false);
  const [kustomMsg, setKustomMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmKustomRemove, setConfirmKustomRemove] = useState(false);
  const [kustomRemoving, setKustomRemoving] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load profile
  useEffect(() => {
    if (!token) return;
    api<UserProfile>('/auth/me', { token })
      .then((u) => {
        setUser(u);
        setDisplayName(u.creator?.display_name || '');
        setAvatarUrl(u.avatar_url || '');
      })
      .catch((err) => console.error('Failed to load profile:', err));
  }, [token]);

  // Load store
  useEffect(() => {
    if (!token) return;
    setStoreLoading(true);
    api<StoreInfo>('/stores/my/store', { token })
      .then((s) => setStore(s))
      .catch(() => setStore(null))
      .finally(() => setStoreLoading(false));
  }, [token]);

  // Load tax settings once the store is known.
  const storeId = store?.id;
  useEffect(() => {
    if (!token || !storeId) return;
    setTaxLoading(true);
    setTaxLoadError(false);
    api<MyTaxSettings>('/taxes/my/settings', { token })
      .then((s) => {
        setTaxSettings(s);
        setTaxForm(pickTaxForm(s));
      })
      .catch(() => setTaxLoadError(true))
      .finally(() => setTaxLoading(false));
  }, [token, storeId]);

  // Own rate rows count, used by the Kustom "no tax rate" hint and the
  // platform-rates toggle. The settings response carries it; an older API
  // without `store_rates_count` is asked for the rate list instead.
  const taxRegistrant = taxSettings?.registrant;
  const settingsRatesCount = taxSettings?.store_rates_count;
  useEffect(() => {
    if (!token || taxRegistrant !== 'STORE') return;
    if (typeof settingsRatesCount === 'number') {
      setOwnTaxRatesCount(settingsRatesCount);
      return;
    }
    api<unknown[]>('/taxes/my/rates', { token })
      .then((rows) => setOwnTaxRatesCount(Array.isArray(rows) ? rows.length : 0))
      .catch(() => setOwnTaxRatesCount(null));
  }, [token, taxRegistrant, settingsRatesCount]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setProfileSaving(true);
    setProfileMsg(null);

    try {
      await api('/creators/me', {
        method: 'PUT',
        token,
        body: JSON.stringify({
          display_name: displayName,
          avatar_url: avatarUrl || '',
        }),
      });
      setProfileMsg({ type: 'success', text: t('settings.profileSaved') });
    } catch (err) {
      console.error('Failed to save profile:', err);
      setProfileMsg({ type: 'error', text: (err instanceof Error && err.message) || t('settings.profileSaveFailed') });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAvatarFile = async (file: File) => {
    setProfileMsg(null);
    const result = await upload(file, 'avatars');
    if (result?.url) {
      setAvatarUrl(result.url);
    } else {
      setProfileMsg({ type: 'error', text: t('settings.avatarUploadFailed') });
    }
  };

  const handleFlushCache = async () => {
    if (!token || flushing) return;
    setFlushing(true);
    setFlushMsg(null);
    try {
      await api('/stores/my/cache/flush', { method: 'POST', token });
      setFlushMsg({ type: 'success', text: t('settings.cacheCleared') });
    } catch (err) {
      setFlushMsg({ type: 'error', text: (err instanceof Error && err.message) || t('settings.cacheClearFailed') });
    } finally {
      setFlushing(false);
    }
  };

  const handleToggleCache = async () => {
    if (!token || !store || cacheSaving) return;
    const next = !store.cache_enabled;
    setCacheSaving(true);
    setFlushMsg(null);
    // Optimistic update — revert on failure.
    setStore({ ...store, cache_enabled: next });
    try {
      await api('/stores/my/store', {
        method: 'PUT',
        token,
        body: JSON.stringify({ cache_enabled: next }),
      });
    } catch (err) {
      setStore({ ...store, cache_enabled: !next });
      setFlushMsg({ type: 'error', text: (err instanceof Error && err.message) || t('settings.cachingUpdateFailed') });
    } finally {
      setCacheSaving(false);
    }
  };

  const handleToggleCod = async () => {
    if (!token || !store || codSaving) return;
    const next = !store.cod_enabled;
    setCodSaving(true);
    setCodMsg(null);
    // Optimistic update — revert on failure.
    setStore({ ...store, cod_enabled: next });
    try {
      await api('/stores/my/store', {
        method: 'PUT',
        token,
        body: JSON.stringify({ cod_enabled: next }),
      });
    } catch (err) {
      setStore({ ...store, cod_enabled: !next });
      setCodMsg({ type: 'error', text: (err instanceof Error && err.message) || t('settings.codUpdateFailed') });
    } finally {
      setCodSaving(false);
    }
  };

  const handleChangeCurrency = async (next: string) => {
    if (!token || !store || currencySaving) return;
    const previous = store.currency ?? '';
    if (next === previous) return;
    setCurrencySaving(true);
    setCurrencyMsg(null);
    setStore({ ...store, currency: next || null });
    try {
      await api('/stores/my/store', {
        method: 'PUT',
        token,
        body: JSON.stringify({ currency: next }),
      });
      clearCurrencyCache();
      setCurrencyMsg({ type: 'success', text: t('settings.currencyUpdated') });
    } catch (err) {
      setStore({ ...store, currency: previous || null });
      setCurrencyMsg({ type: 'error', text: (err instanceof Error && err.message) || t('settings.currencyUpdateFailed') });
    } finally {
      setCurrencySaving(false);
    }
  };

  // Tax settings form helpers. Dirty = differs from the last server state.
  const taxDirty =
    !!taxSettings && !!taxForm && JSON.stringify(pickTaxForm(taxSettings)) !== JSON.stringify(taxForm);

  const setTaxField = <K extends keyof TaxSettingsForm>(key: K, value: TaxSettingsForm[K]) => {
    setTaxForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  // The store has no rate rows of its own, so with platform rates off every
  // sale would be taxed at 0 %. Turning the toggle off is blocked meanwhile.
  const noOwnTaxRates = taxSettings?.registrant === 'STORE' && ownTaxRatesCount === 0;
  const platformRatesOffWithoutRates = noOwnTaxRates && taxSettings?.use_platform_tax_rates === false;

  // PUT /taxes/my/settings with only the fields that changed (the API treats
  // absent fields as "keep", so an untouched null `tax_country` never
  // overwrites anything). The response may only carry the store fields, so it
  // is merged over the previous settings (classes, registrant, counts stay).
  const handleSaveTaxSettings = async () => {
    if (!token || !taxForm || !taxSettings || taxSaving) return;
    const loaded = pickTaxForm(taxSettings);
    const changes: Partial<TaxSettingsForm> = {};
    (Object.keys(taxForm) as (keyof TaxSettingsForm)[]).forEach((key) => {
      if (taxForm[key] !== loaded[key]) (changes as Record<string, unknown>)[key] = taxForm[key];
    });
    if (Object.keys(changes).length === 0) return;
    setTaxSaving(true);
    setTaxMsg(null);
    try {
      const updated = await api<Partial<MyTaxSettings>>('/taxes/my/settings', {
        method: 'PUT',
        token,
        body: JSON.stringify(changes),
      });
      const merged: MyTaxSettings = { ...taxSettings, ...taxForm, ...(updated && typeof updated === 'object' ? updated : {}) };
      setTaxSettings(merged);
      setTaxForm(pickTaxForm(merged));
      setTaxMsg({ type: 'success', text: t('settings.taxSettingsSaved') });
    } catch (err: unknown) {
      setTaxMsg({ type: 'error', text: (err instanceof Error && err.message) || t('settings.taxSettingsSaveFailed') });
    } finally {
      setTaxSaving(false);
    }
  };

  const handleDisconnectStripe = async () => {
    if (!token || disconnecting) return;
    setDisconnecting(true);
    setStripeError('');
    try {
      await api('/payments/connect/disconnect', { method: 'POST', token });
      const fresh = await api<StripeConnectStatus>('/payments/connect/status', { token });
      setStripeStatus(fresh);
      setConfirmDisconnect(false);
    } catch (err) {
      setStripeError((err instanceof Error && err.message) || t('settings.disconnectFailed'));
    } finally {
      setDisconnecting(false);
    }
  };

  // Load Stripe Connect status (and refresh after returning from onboarding).
  useEffect(() => {
    if (!token) return;
    setStripeLoading(true);
    api<StripeConnectStatus>('/payments/connect/status', { token })
      .then((s) => setStripeStatus(s))
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
      setStripeError((err instanceof Error && err.message) || t('settings.stripeConnectError'));
      setStripeConnecting(false);
    }
  };

  // Sync the Kustom form fields from a settings response. The secret input is
  // always cleared: blank means "keep the stored secret".
  const applyKustomSettings = useCallback((s: KustomSettings) => {
    setKustom(s);
    setKustomMerchantId(s.merchant_id || '');
    setKustomSecret('');
    setKustomEnvironment(s.environment || 'playground');
    setKustomEnabled(!!s.enabled);
  }, []);

  // Load Kustom settings once we know the store is independent.
  useEffect(() => {
    if (!token || store?.store_type !== 'INDEPENDENT') return;
    setKustomLoading(true);
    setKustomLoadError(false);
    api<KustomSettings>('/payments/kustom/settings', { token })
      .then((s) => applyKustomSettings(s))
      .catch(() => setKustomLoadError(true))
      .finally(() => setKustomLoading(false));
  }, [token, store?.store_type, applyKustomSettings]);

  const handleSaveKustom = async () => {
    if (!token || !kustom || kustomSaving) return;
    // Send only what changed. A blank merchant id or secret is ignored here —
    // clearing credentials goes through the explicit "remove" action below.
    const body: Record<string, string | boolean> = {};
    const merchantId = kustomMerchantId.trim();
    if (merchantId && merchantId !== (kustom.merchant_id || '')) body.merchant_id = merchantId;
    if (kustomSecret.trim()) body.shared_secret = kustomSecret.trim();
    if (kustomEnvironment !== kustom.environment) body.environment = kustomEnvironment;
    if (kustomEnabled !== kustom.enabled) body.enabled = kustomEnabled;
    if (Object.keys(body).length === 0) return;
    setKustomSaving(true);
    setKustomMsg(null);
    try {
      const updated = await api<KustomSettings>('/payments/kustom/settings', {
        method: 'PUT',
        token,
        body: JSON.stringify(body),
      });
      applyKustomSettings(updated);
      setKustomMsg({ type: 'success', text: t('settings.kustomSaved') });
    } catch (err) {
      setKustomMsg({ type: 'error', text: (err instanceof Error && err.message) || t('settings.kustomSaveFailed') });
    } finally {
      setKustomSaving(false);
    }
  };

  // Verifies the *stored* credentials against the selected Kustom environment.
  const handleTestKustom = async () => {
    if (!token || kustomTesting) return;
    setKustomTesting(true);
    setKustomMsg(null);
    try {
      const res = await api<{ ok: boolean; message: string }>('/payments/kustom/settings/test', {
        method: 'POST',
        token,
      });
      setKustomMsg({ type: res.ok ? 'success' : 'error', text: res.message });
    } catch (err) {
      setKustomMsg({ type: 'error', text: (err instanceof Error && err.message) || t('settings.kustomTestFailed') });
    } finally {
      setKustomTesting(false);
    }
  };

  // Clears merchant id + secret and disables Kustom (two-step confirm).
  const handleRemoveKustom = async () => {
    if (!token || kustomRemoving) return;
    setKustomRemoving(true);
    setKustomMsg(null);
    try {
      const updated = await api<KustomSettings>('/payments/kustom/settings', {
        method: 'PUT',
        token,
        body: JSON.stringify({ merchant_id: '', shared_secret: '', enabled: false }),
      });
      applyKustomSettings(updated);
      setConfirmKustomRemove(false);
    } catch (err) {
      setKustomMsg({ type: 'error', text: (err instanceof Error && err.message) || t('settings.kustomRemoveFailed') });
    } finally {
      setKustomRemoving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (!newPassword || !currentPassword) {
      setPasswordMsg({ type: 'error', text: t('settings.passwordFillAll') });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: t('settings.passwordMismatch') });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: t('settings.passwordTooShort') });
      return;
    }
    if (!token) return;

    setPasswordSaving(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        token,
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg({ type: 'success', text: t('settings.passwordChanged') });
    } catch (err) {
      setPasswordMsg({ type: 'error', text: (err instanceof Error && err.message) || t('settings.passwordChangeFailed') });
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* Account Info card */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t('settings.accountInfo')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Email (read-only) */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t('settings.email')}</Label>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="h-8"
                  placeholder={tc('loading')}
                />
              </div>

              {/* Display Name */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t('settings.displayName')}</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('settings.displayNamePlaceholder')}
                  className="h-8"
                />
              </div>

              {/* Avatar */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t('settings.avatar')}</Label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-zinc-200 bg-zinc-50 transition hover:border-zinc-400 disabled:opacity-50"
                    aria-label={t('settings.uploadAvatar')}
                  >
                    {uploading ? (
                      <div className="flex h-full w-full items-center justify-center">
                        <Loader2 className="size-5 animate-spin text-zinc-400" />
                      </div>
                    ) : avatarUrl ? (
                      <>
                        <img
                          src={resolveAvatarUrl(avatarUrl)}
                          alt={t('settings.avatarPreview')}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                          <Camera className="size-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-zinc-400">
                        <UserIcon className="size-6" />
                        <span className="text-[9px]">{t('settings.upload')}</span>
                      </div>
                    )}
                  </button>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        <Camera className="size-3.5" />
                        {avatarUrl ? t('settings.change') : t('settings.upload')}
                      </Button>
                      {avatarUrl && !uploading && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setAvatarUrl('')}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                          {tc('remove')}
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {t('settings.avatarHint')}
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleAvatarFile(f);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>

              {/* Feedback */}
              {profileMsg && (
                <div
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
                    profileMsg.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-destructive/30 bg-destructive/5 text-destructive'
                  }`}
                >
                  {profileMsg.type === 'success' ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  )}
                  {profileMsg.text}
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={profileSaving || !user}>
                  {profileSaving ? tc('saving') : t('settings.saveProfile')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Store Status card */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t('settings.storeStatus')}</CardTitle>
          </CardHeader>
          <CardContent>
            {storeLoading ? (
              <div className="space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-zinc-100" />
                <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
              </div>
            ) : store ? (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{store.name}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">/{store.slug}</p>
                  <span
                    className={`mt-1 inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-medium ${
                      store.is_active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-zinc-200 bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {store.is_active ? t('settings.active') : t('settings.inactive')}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push('/creator/store')}
                >
                  {t('settings.manageStore')}
                  <ExternalLink className="size-3.5" />
                </Button>
              </div>
            ) : null}

            {/* Storefront caching controls — toggle caching on/off and, while
                on, force an immediate refresh. */}
            {store && (
              <div className="mt-4 space-y-3 border-t pt-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{t('settings.storefrontCaching')}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {store.cache_enabled
                        ? t('settings.cachingOn')
                        : t('settings.cachingOff')}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={store.cache_enabled}
                    onClick={handleToggleCache}
                    disabled={cacheSaving}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                      store.cache_enabled ? 'bg-emerald-500' : 'bg-zinc-300'
                    }`}
                  >
                    <span
                      className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                        store.cache_enabled ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0.5 rtl:-translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {store.cache_enabled && (
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">
                      {t('settings.forceRefreshHint')}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleFlushCache}
                      disabled={flushing}
                    >
                      {flushing ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                      {t('settings.clearCache')}
                    </Button>
                  </div>
                )}

                {flushMsg && (
                  <p
                    className={`text-[11px] ${
                      flushMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {flushMsg.text}
                  </p>
                )}

                {/* Cash on delivery — opt-in per store, off by default. */}
                <div className="flex items-center justify-between border-t pt-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{t('settings.codPayment')}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {store.cod_enabled ? t('settings.codOn') : t('settings.codOff')}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!store.cod_enabled}
                    onClick={handleToggleCod}
                    disabled={codSaving}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                      store.cod_enabled ? 'bg-emerald-500' : 'bg-zinc-300'
                    }`}
                  >
                    <span
                      className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                        store.cod_enabled ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0.5 rtl:-translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
                {codMsg && (
                  <p
                    className={`text-[11px] ${
                      codMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {codMsg.text}
                  </p>
                )}

                {/* Store currency — independent stores charge on their own
                    connected account, so they pick the currency customers pay
                    in. Marketplace stores are charged on the platform account
                    and stay on the platform currency. */}
                {store.store_type === 'INDEPENDENT' && (
                  <div className="border-t pt-3 space-y-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{t('settings.storeCurrency')}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t('settings.storeCurrencyHint')}
                      </p>
                    </div>
                    <div className="max-w-xs flex items-center gap-2">
                      <SearchableSelect
                        value={store.currency ?? ''}
                        onChange={handleChangeCurrency}
                        options={[
                          { value: '', label: t('settings.currencyPlatformDefault') },
                          ...CURRENCIES,
                        ]}
                        placeholder={t('settings.currencyPlatformDefault')}
                      />
                      {currencySaving && (
                        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-[11px] text-amber-600">
                      {t('settings.storeCurrencyWarning')}
                    </p>
                    {currencyMsg && (
                      <p
                        className={`text-[11px] ${
                          currencyMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {currencyMsg.text}
                      </p>
                    )}
                  </div>
                )}

              </div>
            )}

            {!storeLoading && !store && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-[10px] font-medium text-amber-700">
                    {t('settings.storeNotCreated')}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.setUpToSell')}
                  </p>
                </div>
                <Button size="sm" onClick={() => router.push('/creator/store')}>
                  {t('settings.setUpStore')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Taxes card — GET/PUT /taxes/my/settings. Marketplace stores are
            taxed by the platform (registrant PLATFORM) and only see a note;
            independent stores configure their own tax setup here and manage
            rates on /creator/taxes. */}
        {store && (
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t('settings.taxesTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {taxLoading ? (
                <div className="space-y-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-zinc-100" />
                  <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
                </div>
              ) : taxLoadError || !taxSettings || !taxForm ? (
                <p className="text-[11px] text-destructive">{t('settings.taxesLoadFailed')}</p>
              ) : taxSettings.registrant === 'PLATFORM' ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    {taxSettings.effective_tax_country ?? taxSettings.tax_country
                      ? t('settings.taxesPlatformManaged', {
                          country: countryName(taxSettings.effective_tax_country ?? taxSettings.tax_country ?? '', locale),
                        })
                      : t('settings.taxesPlatformManagedNoCountry')}
                  </p>
                  <Link href="/creator/taxes" className="inline-block text-xs text-primary hover:underline">
                    {t('settings.taxesReportLink')}
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Pricing mode */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{t('settings.taxPricingMode')}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(['INCLUSIVE', 'EXCLUSIVE'] as TaxPricingMode[]).map((mode) => (
                        <label
                          key={mode}
                          className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors ${
                            taxForm.pricing_mode === mode ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:bg-zinc-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="store-tax-pricing-mode"
                            className="mt-0.5 accent-zinc-900"
                            checked={taxForm.pricing_mode === mode}
                            onChange={() => setTaxField('pricing_mode', mode)}
                          />
                          <span className="space-y-0.5">
                            <span className="block text-sm font-medium">
                              {mode === 'INCLUSIVE' ? t('settings.taxPricingInclusive') : t('settings.taxPricingExclusive')}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              {mode === 'INCLUSIVE' ? t('settings.taxPricingInclusiveHint') : t('settings.taxPricingExclusiveHint')}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Destination basis */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('settings.taxBasis')}</Label>
                      <SearchableSelect
                        value={taxForm.basis}
                        onChange={(v) => setTaxField('basis', (v || 'SHIPPING') as TaxBasis)}
                        options={[
                          { value: 'SHIPPING', label: t('settings.taxBasisShipping') },
                          { value: 'BILLING', label: t('settings.taxBasisBilling') },
                          { value: 'STORE', label: t('settings.taxBasisStore') },
                        ]}
                      />
                      <p className="text-[10px] text-muted-foreground">{t('settings.taxBasisHint')}</p>
                    </div>
                    {/* Registration country. A null stored value means "use the
                        platform country"; the option names that country from
                        `effective_tax_country` but the form keeps null so the
                        effective value is never written back as the store's own. */}
                    {(() => {
                      const platformDefaultLabel =
                        !taxSettings.tax_country && taxSettings.effective_tax_country
                          ? t('settings.taxCountryPlatformDefaultWith', {
                              country: countryName(taxSettings.effective_tax_country, locale),
                            })
                          : t('settings.taxCountryPlatformDefault');
                      return (
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t('settings.taxCountry')}</Label>
                          <SearchableSelect
                            value={taxForm.tax_country || ''}
                            onChange={(v) => setTaxField('tax_country', v || null)}
                            options={[{ value: '', label: platformDefaultLabel }, ...taxCountryOpts]}
                            placeholder={platformDefaultLabel}
                          />
                          <p className="text-[10px] text-muted-foreground">{t('settings.taxCountryHint')}</p>
                        </div>
                      );
                    })()}
                    {/* Shipping tax class */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('settings.taxShippingClass')}</Label>
                      <SearchableSelect
                        value={taxForm.shipping_tax_class_id || ''}
                        onChange={(v) => setTaxField('shipping_tax_class_id', v || null)}
                        options={[
                          { value: '', label: t('settings.taxShippingClassHighest') },
                          ...(taxSettings.classes || []).map((c) => ({
                            value: c.id,
                            label: localizedTaxText(c.name, locale, c.key),
                            description: c.key,
                          })),
                        ]}
                        placeholder={t('settings.taxShippingClassHighest')}
                      />
                      <p className="text-[10px] text-muted-foreground">{t('settings.taxShippingClassHint')}</p>
                    </div>
                  </div>

                  <div className="space-y-3 border-t pt-3">
                    {/* OSS */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{t('settings.taxOss')}</p>
                        <p className="text-[11px] text-muted-foreground">{t('settings.taxOssHint')}</p>
                      </div>
                      <ToggleSwitch
                        checked={taxForm.oss_registered}
                        onChange={(v) => setTaxField('oss_registered', v)}
                        disabled={taxSaving}
                        label={t('settings.taxOss')}
                      />
                    </div>
                    {/* Use platform rates */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{t('settings.taxUsePlatformRates')}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {t('settings.taxUsePlatformRatesHint', { count: taxSettings.platform_rates_count ?? 0 })}
                        </p>
                        {ownTaxRatesCount !== null && (
                          <p className="text-[11px] text-muted-foreground">
                            {t('settings.taxOwnRatesCount', { count: ownTaxRatesCount })}
                          </p>
                        )}
                        {noOwnTaxRates && taxForm.use_platform_tax_rates && (
                          <p className="text-[10px] text-muted-foreground">{t('settings.taxUsePlatformRatesLocked')}</p>
                        )}
                      </div>
                      <ToggleSwitch
                        checked={taxForm.use_platform_tax_rates}
                        onChange={(v) => setTaxField('use_platform_tax_rates', v)}
                        // Without own rates the toggle can only be turned on.
                        disabled={taxSaving || (noOwnTaxRates && taxForm.use_platform_tax_rates)}
                        label={t('settings.taxUsePlatformRates')}
                      />
                    </div>
                    {platformRatesOffWithoutRates && (
                      <p className="text-[11px] rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                        {t('settings.taxNoOwnRatesWarning')}{' '}
                        <Link href="/creator/taxes" className="font-medium underline">
                          {t('settings.taxRatesLink')}
                        </Link>
                      </p>
                    )}
                    {/* Display prices incl. tax */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{t('settings.taxDisplayIncl')}</p>
                        <p className="text-[11px] text-muted-foreground">{t('settings.taxDisplayInclHint')}</p>
                      </div>
                      <ToggleSwitch
                        checked={taxForm.display_prices_incl_tax}
                        onChange={(v) => setTaxField('display_prices_incl_tax', v)}
                        disabled={taxSaving}
                        label={t('settings.taxDisplayIncl')}
                      />
                    </div>
                  </div>

                  {taxMsg && (
                    <p className={`text-[11px] ${taxMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {taxMsg.text}
                    </p>
                  )}

                  <div className="flex items-center justify-between border-t pt-3">
                    <Link href="/creator/taxes" className="text-xs text-primary hover:underline">
                      {t('settings.taxRatesLink')}
                    </Link>
                    <Button size="sm" onClick={handleSaveTaxSettings} disabled={taxSaving || !taxDirty}>
                      {taxSaving && <Loader2 className="size-3.5 animate-spin" />}
                      {taxSaving ? tc('saving') : tc('save')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stripe card — Express payouts for marketplace stores, the creator's
            own Standard account (direct charges) for independent stores. */}
        {(() => {
          const isIndependent = store?.store_type === 'INDEPENDENT';
          const requiresRelink = !!stripeStatus?.requires_relink;
          // Independent stores are ready when they can take charges directly on
          // a Standard account; marketplace stores when payouts are enabled.
          const stripeReady = isIndependent
            ? !!stripeStatus?.charges_enabled && !requiresRelink
            : !!stripeStatus?.payouts_enabled;
          return (
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  {isIndependent ? t('settings.stripeAccountTitle') : t('settings.stripeConnect')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stripeLoading || storeLoading ? (
                  <div className="space-y-2">
                    <div className="h-4 w-40 animate-pulse rounded bg-zinc-100" />
                    <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        {stripeReady ? (
                          <span className="inline-flex h-5 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-medium text-emerald-700">
                            <CheckCircle2 className="size-3" />
                            {isIndependent ? t('settings.paymentsEnabled') : t('settings.payoutsEnabled')}
                          </span>
                        ) : stripeStatus?.connected ? (
                          <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-[10px] font-medium text-amber-700">
                            {requiresRelink
                              ? t('settings.stripeRelinkRequired')
                              : t('settings.onboardingPending')}
                          </span>
                        ) : (
                          <span className="inline-flex h-5 items-center rounded-full border border-zinc-200 bg-zinc-100 px-2 text-[10px] font-medium text-zinc-600">
                            {t('settings.notConnected')}
                          </span>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {isIndependent ? t('settings.stripeAccountDesc') : t('settings.stripeConnectDesc')}
                        </p>
                        {stripeError && <p className="text-[11px] text-destructive">{stripeError}</p>}
                      </div>
                      {!stripeReady && (
                        <Button size="sm" onClick={handleConnectStripe} disabled={stripeConnecting}>
                          {stripeConnecting ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : requiresRelink ? (
                            t('settings.reconnectStripe')
                          ) : stripeStatus?.connected ? (
                            t('settings.completeStripeSetup')
                          ) : (
                            t('settings.connectStripe')
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Independent stores manage refunds and disputes in their
                        own Stripe dashboard. */}
                    {isIndependent && stripeStatus?.connected && (
                      <div className="flex items-center justify-between gap-3 border-t pt-3">
                        <p className="text-[11px] text-muted-foreground">
                          {t('settings.stripeAccountRefundsHint')}
                        </p>
                        <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline">
                            {t('settings.openStripeDashboard')}
                            <ExternalLink className="size-3.5" />
                          </Button>
                        </a>
                      </div>
                    )}

                    {/* Disconnect — unlinks the account and stops card payments
                        until a new account is connected (two-step confirm). */}
                    {stripeStatus?.connected && (
                      <div className="flex items-center justify-between gap-3 border-t pt-3">
                        <p className="text-[11px] text-muted-foreground">
                          {t('settings.disconnectStripeHint')}
                        </p>
                        {confirmDisconnect ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmDisconnect(false)}
                              disabled={disconnecting}
                            >
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
                              {t('settings.disconnectConfirm')}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                            onClick={() => setConfirmDisconnect(true)}
                          >
                            {t('settings.disconnectStripe')}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Kustom Checkout card — the creator's own Kustom (ex Klarna Checkout)
            merchant account, independent stores only. */}
        {store?.store_type === 'INDEPENDENT' && (() => {
          const savedCredentials = !!kustom?.merchant_id && !!kustom?.secret_configured;
          // The toggle unlocks as soon as both credentials are present, either
          // already stored or typed into the form.
          const credentialsPresent =
            !!(kustom?.merchant_id || kustomMerchantId.trim()) &&
            !!(kustom?.secret_configured || kustomSecret.trim());
          const kustomDirty =
            !!kustom &&
            ((kustomMerchantId.trim() !== '' && kustomMerchantId.trim() !== (kustom.merchant_id || '')) ||
              kustomSecret.trim() !== '' ||
              kustomEnvironment !== kustom.environment ||
              kustomEnabled !== kustom.enabled);
          return (
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t('settings.kustomTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                {kustomLoading ? (
                  <div className="space-y-2">
                    <div className="h-4 w-40 animate-pulse rounded bg-zinc-100" />
                    <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
                  </div>
                ) : kustomLoadError || !kustom ? (
                  <p className="text-[11px] text-destructive">{t('settings.kustomLoadFailed')}</p>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      {kustom.ready ? (
                        <span className="inline-flex h-5 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-medium text-emerald-700">
                          <CheckCircle2 className="size-3" />
                          {t('settings.kustomReady')}
                        </span>
                      ) : savedCredentials ? (
                        <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-[10px] font-medium text-amber-700">
                          {t('settings.kustomConfiguredDisabled')}
                        </span>
                      ) : (
                        <span className="inline-flex h-5 items-center rounded-full border border-zinc-200 bg-zinc-100 px-2 text-[10px] font-medium text-zinc-600">
                          {t('settings.kustomNotConfigured')}
                        </span>
                      )}
                      <p className="text-[11px] text-muted-foreground">{t('settings.kustomDesc')}</p>
                      {kustom.currency_supported === false && (
                        <p className="text-[11px] rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                          {t('settings.kustomCurrencyUnsupported', { currency: kustom.currency || '' })}
                        </p>
                      )}
                      {/* Kustom is on but no tax rate can match: the store has
                          no own rates and either ignores platform rates or the
                          platform has none. Every line would go out at 0 % VAT. */}
                      {kustom.enabled &&
                        taxSettings?.registrant === 'STORE' &&
                        ownTaxRatesCount === 0 &&
                        (!taxSettings.use_platform_tax_rates || (taxSettings.platform_rates_count ?? 0) === 0) && (
                          <p className="text-[11px] rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                            {t('settings.kustomNoTaxHint')}
                          </p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('settings.kustomMerchantId')}</Label>
                      <Input
                        value={kustomMerchantId}
                        onChange={(e) => setKustomMerchantId(e.target.value)}
                        placeholder={t('settings.kustomMerchantIdPlaceholder')}
                        className="h-8 font-mono"
                        autoComplete="off"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('settings.kustomSharedSecret')}</Label>
                      <Input
                        type="password"
                        value={kustomSecret}
                        onChange={(e) => setKustomSecret(e.target.value)}
                        placeholder={
                          kustom.secret_configured
                            ? t('settings.kustomSecretConfiguredPlaceholder')
                            : t('settings.kustomSharedSecretPlaceholder')
                        }
                        className="h-8 font-mono"
                        autoComplete="new-password"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('settings.kustomEnvironment')}</Label>
                      <div className="max-w-xs">
                        <SearchableSelect
                          value={kustomEnvironment}
                          onChange={(v) => setKustomEnvironment(v === 'production' ? 'production' : 'playground')}
                          options={[
                            { value: 'playground', label: t('settings.kustomEnvPlayground') },
                            { value: 'production', label: t('settings.kustomEnvProduction') },
                          ]}
                        />
                      </div>
                      <p className="text-[11px] text-amber-600">{t('settings.kustomEnvHint')}</p>
                    </div>

                    {/* Enable at checkout — locked until both credentials exist. */}
                    <div className="flex items-center justify-between gap-3 border-t pt-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{t('settings.kustomEnabled')}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {credentialsPresent
                            ? t('settings.kustomEnabledHint')
                            : t('settings.kustomEnabledLockedHint')}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={kustomEnabled}
                        onClick={() => setKustomEnabled((v) => !v)}
                        disabled={!credentialsPresent || kustomSaving}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                          kustomEnabled ? 'bg-emerald-500' : 'bg-zinc-300'
                        }`}
                      >
                        <span
                          className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                            kustomEnabled ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0.5 rtl:-translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    {kustomMsg && (
                      <div
                        className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
                          kustomMsg.type === 'success'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-destructive/30 bg-destructive/5 text-destructive'
                        }`}
                      >
                        {kustomMsg.type === 'success' ? (
                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                        ) : (
                          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                        )}
                        {kustomMsg.text}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleTestKustom}
                        disabled={kustomTesting || !savedCredentials}
                      >
                        {kustomTesting ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5" />
                        )}
                        {t('settings.kustomTestConnection')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveKustom}
                        disabled={kustomSaving || !kustomDirty}
                      >
                        {kustomSaving ? tc('saving') : tc('save')}
                      </Button>
                    </div>

                    {/* Remove credentials — clears both values and disables
                        Kustom at checkout (two-step confirm). */}
                    {(kustom.merchant_id || kustom.secret_configured) && (
                      <div className="flex items-center justify-between gap-3 border-t pt-3">
                        <p className="text-[11px] text-muted-foreground">
                          {t('settings.kustomRemoveHint')}
                        </p>
                        {confirmKustomRemove ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmKustomRemove(false)}
                              disabled={kustomRemoving}
                            >
                              {tc('cancel')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                              onClick={handleRemoveKustom}
                              disabled={kustomRemoving}
                            >
                              {kustomRemoving && <Loader2 className="size-3.5 animate-spin" />}
                              {t('settings.kustomRemoveConfirm')}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                            onClick={() => setConfirmKustomRemove(true)}
                          >
                            {t('settings.kustomRemove')}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Change Password card */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t('settings.changePassword')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('settings.currentPassword')}</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t('settings.currentPasswordPlaceholder')}
                  className="h-8"
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('settings.newPassword')}</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('settings.newPasswordPlaceholder')}
                  className="h-8"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('settings.confirmNewPassword')}</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('settings.confirmPasswordPlaceholder')}
                  className="h-8"
                  autoComplete="new-password"
                />
              </div>

              {/* Feedback */}
              {passwordMsg && (
                <div
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
                    passwordMsg.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-destructive/30 bg-destructive/5 text-destructive'
                  }`}
                >
                  {passwordMsg.type === 'success' ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  )}
                  {passwordMsg.text}
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={passwordSaving}>
                  {passwordSaving ? t('settings.changing') : t('settings.changePassword')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
