'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertCircle, Camera, CheckCircle2, ExternalLink, Loader2, RefreshCw, Trash2, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useImageUpload } from '@/lib/useImageUpload';
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
}

interface StripeConnectStatus {
  connected: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarding_completed: boolean;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreatorSettingsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const t = useTranslations('creator');
  const tc = useTranslations('common');
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

  // Stripe Connect (payout account) state
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus | null>(null);
  const [stripeLoading, setStripeLoading] = useState(true);
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeError, setStripeError] = useState('');

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
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      setProfileMsg({ type: 'error', text: err?.message || t('settings.profileSaveFailed') });
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
    } catch (err: any) {
      setFlushMsg({ type: 'error', text: err?.message || t('settings.cacheClearFailed') });
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
    } catch (err: any) {
      setStore({ ...store, cache_enabled: !next });
      setFlushMsg({ type: 'error', text: err?.message || t('settings.cachingUpdateFailed') });
    } finally {
      setCacheSaving(false);
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
    } catch (err: any) {
      setStripeError(err?.message || t('settings.stripeConnectError'));
      setStripeConnecting(false);
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
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err?.message || t('settings.passwordChangeFailed') });
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

        {/* Stripe Connect card */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t('settings.stripeConnect')}</CardTitle>
          </CardHeader>
          <CardContent>
            {stripeLoading ? (
              <div className="space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-zinc-100" />
                <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  {stripeStatus?.payouts_enabled ? (
                    <span className="inline-flex h-5 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-medium text-emerald-700">
                      <CheckCircle2 className="size-3" />
                      {t('settings.payoutsEnabled')}
                    </span>
                  ) : stripeStatus?.connected ? (
                    <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-[10px] font-medium text-amber-700">
                      {t('settings.onboardingPending')}
                    </span>
                  ) : (
                    <span className="inline-flex h-5 items-center rounded-full border border-zinc-200 bg-zinc-100 px-2 text-[10px] font-medium text-zinc-600">
                      {t('settings.notConnected')}
                    </span>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {t('settings.stripeConnectDesc')}
                  </p>
                  {stripeError && <p className="text-[11px] text-destructive">{stripeError}</p>}
                </div>
                {!stripeStatus?.payouts_enabled && (
                  <Button size="sm" onClick={handleConnectStripe} disabled={stripeConnecting}>
                    {stripeConnecting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : stripeStatus?.connected ? (
                      t('settings.completeStripeSetup')
                    ) : (
                      t('settings.connectStripe')
                    )}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

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
