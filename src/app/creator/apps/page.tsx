'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Blocks } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { sanitizeStoreApps, setCachedStoreApps } from '@/lib/useStoreApps';
import type { MyStoreAppView, StoreAppKey } from '@/lib/storeApps.registry';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { B2bSettingsCard } from '@/components/apps/B2bSettingsCard';
import { InvoicesSettingsCard } from '@/components/apps/InvoicesSettingsCard';

export default function CreatorAppsPage() {
  const t = useTranslations('creator.apps');
  // Root translator so API error codes can be resolved under `errors.<code>`.
  const tRoot = useTranslations();
  const { token } = useAuth();

  const [apps, setApps] = useState<MyStoreAppView[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Key of the app whose PUT is in flight (one at a time keeps the optimistic
  // revert simple).
  const [saving, setSaving] = useState<StoreAppKey | null>(null);
  // Error shown under the card that failed; cleared on the next toggle.
  const [errors, setErrors] = useState<Partial<Record<StoreAppKey, string>>>({});

  const describeError = useCallback(
    (err: unknown): string => {
      if (err instanceof ApiError && err.code && tRoot.has(`errors.${err.code}`)) return tRoot(`errors.${err.code}`);
      if (err instanceof Error && err.message) return err.message;
      return t('saveFailed');
    },
    [t, tRoot],
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<MyStoreAppView[]>('/stores/my/apps', { token })
      .then((list) => {
        if (cancelled) return;
        const next = sanitizeStoreApps(list) ?? [];
        setApps(next);
        setCachedStoreApps(next);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Resolved inline so the effect only depends on the token.
        if (err instanceof ApiError && err.code && tRoot.has(`errors.${err.code}`)) setLoadError(tRoot(`errors.${err.code}`));
        else if (err instanceof Error && err.message) setLoadError(err.message);
        else setLoadError(t('saveFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- translators are stable for the mounted locale
  }, [token]);

  const handleToggle = async (app: MyStoreAppView, next: boolean) => {
    if (!token || !apps || saving) return;
    if (next && !app.can_enable) return;
    setSaving(app.key);
    setErrors((prev) => ({ ...prev, [app.key]: undefined }));
    // Optimistic update — revert on failure.
    const previous = apps;
    setApps(previous.map((a) => (a.key === app.key ? { ...a, enabled: next } : a)));
    try {
      // The API returns the full refreshed list: sibling rows' can_enable /
      // blocked_reason change when one app toggles (e.g. markets → importer).
      const result = await api<MyStoreAppView[]>(`/stores/my/apps/${app.key}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ enabled: next }),
      });
      const refreshed = sanitizeStoreApps(result) ?? previous;
      setApps(refreshed);
      setCachedStoreApps(refreshed);
    } catch (err) {
      setApps(previous);
      setErrors((prev) => ({ ...prev, [app.key]: describeError(err) }));
    } finally {
      setSaving(null);
    }
  };

  const appName = (key: StoreAppKey) => t(`items.${key}.name`);

  // The API returns every registry key; only apps the admin made available
  // are shown to the creator.
  const visibleApps = (apps ?? []).filter((a) => a.available);

  const blockedText = (app: MyStoreAppView): string | null => {
    if (app.can_enable || app.enabled) return null;
    if (app.blocked_reason === 'REQUIRES_INDEPENDENT') return t('blockedRequiresIndependent');
    if (app.blocked_reason === 'DEPENDENCY_MISSING') {
      return t('blockedDependencyMissing', { apps: app.depends_on.map(appName).join(', ') });
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i} className="shadow-none">
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-5 w-9 rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : loadError ? (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      ) : visibleApps.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Blocks className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleApps.map((app) => {
            const isSaving = saving === app.key;
            const blocked = blockedText(app);
            // Switching off is always allowed; switching on needs can_enable.
            const disabled = isSaving || saving !== null || (!app.enabled && !app.can_enable);
            const error = errors[app.key];
            return (
              <Card key={app.key} className="shadow-none">
                <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3 space-y-0">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-sm font-semibold">{t(`items.${app.key}.name`)}</CardTitle>
                    <p className="text-xs text-muted-foreground">{t(`items.${app.key}.description`)}</p>
                  </div>
                  <ToggleSwitch
                    checked={app.enabled}
                    disabled={disabled}
                    onChange={(next) => handleToggle(app, next)}
                    label={t(`items.${app.key}.name`)}
                  />
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {app.enabled ? (
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                        {t('enabled')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-zinc-50 text-zinc-600 border-zinc-200">
                        {t('disabled')}
                      </Badge>
                    )}
                    {app.requires_independent && (
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                        {t('requiresIndependent')}
                      </Badge>
                    )}
                    {app.depends_on.length > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">
                        {t('dependsOn', { apps: app.depends_on.map(appName).join(', ') })}
                      </Badge>
                    )}
                  </div>
                  {blocked && <p className="text-[11px] text-amber-700">{blocked}</p>}
                  {error && <p className="text-[11px] text-red-600">{error}</p>}
                  {/* Per-app settings live under the card while the app is on. */}
                  {app.key === 'b2b' && app.enabled && token && (
                    <B2bSettingsCard
                      app={app}
                      token={token}
                      onSaved={(refreshed) => {
                        setApps(refreshed);
                        setCachedStoreApps(refreshed);
                      }}
                    />
                  )}
                  {app.key === 'invoices' && app.enabled && token && (
                    <InvoicesSettingsCard
                      app={app}
                      token={token}
                      onSaved={(refreshed) => {
                        setApps(refreshed);
                        setCachedStoreApps(refreshed);
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
