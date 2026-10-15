'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertCircle, ArrowUpRight, FileText, Info, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/useApiError';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';
import { useUrlTab } from '@/lib/useUrlTab';
import { getBacklog, getLegalProfile, type LegalProfileView } from '@/lib/invoices.api';
import { InvoicesListTab } from '@/components/invoices/InvoicesListTab';
import { InvoiceBacklogTab } from '@/components/invoices/InvoiceBacklogTab';
import { LegalProfileForm } from '@/components/invoices/LegalProfileForm';
import { NumberingForm } from '@/components/invoices/NumberingForm';
import { ProfileMissingNotice } from '@/components/invoices/InvoiceBits';
import { AppPageHeader } from '@/components/apps/AppPageHeader';
import { InvoicesSettingsCard } from '@/components/apps/InvoicesSettingsCard';

const TABS = ['invoices', 'backlog', 'profile', 'numbering', 'settings'] as const;
type Tab = (typeof TABS)[number];

export default function CreatorInvoicesPage() {
  const t = useTranslations('creator.invoices');
  const { token } = useAuth();
  const describeError = useApiError();
  const { apps, loading: appsLoading } = useStoreApps();
  const enabled = isAppEnabled(apps, 'invoices');
  const app = apps?.find((a) => a.key === 'invoices');
  // The EC sales list (reverse charge) lives on the B2B app page.
  const b2bOn = isAppEnabled(apps, 'b2b');

  // Active tab, mirrored in ?tab= so links (Apps catalog, order card) land on it.
  const [tab, changeTab] = useUrlTab(TABS, 'invoices');

  const [profile, setProfile] = useState<LegalProfileView | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [backlogCount, setBacklogCount] = useState<number | null>(null);
  // Bumped after issuing from the backlog so the Invoices tab remounts fresh.
  const [listVersion, setListVersion] = useState(0);
  // Bumped by "Retry" to reload the legal profile.
  const [profileAttempt, setProfileAttempt] = useState(0);

  const loadBacklogCount = useCallback(() => {
    if (!token) return;
    getBacklog(token, 1)
      .then((res) => setBacklogCount(Number(res?.count ?? 0)))
      .catch(() => setBacklogCount(null));
  }, [token]);

  useEffect(() => {
    if (!token || !enabled) return;
    let cancelled = false;
    setProfileLoaded(false);
    setProfileError(null);
    getLegalProfile(token)
      .then((view) => {
        if (!cancelled) setProfile(view);
      })
      .catch((err: unknown) => {
        if (!cancelled) setProfileError(describeError(err));
      })
      .finally(() => {
        if (!cancelled) setProfileLoaded(true);
      });
    loadBacklogCount();
    return () => {
      cancelled = true;
    };
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, enabled, loadBacklogCount, profileAttempt]);

  if (!token) return null;

  // With the app off only the read-only list remains (L1 retention).
  const activeTab: Tab = enabled ? tab : 'invoices';
  const profileIncomplete = enabled && profileLoaded && !!profile && !profile.complete;

  // The profile forms render only from a successfully loaded server copy, so a
  // failed GET can never be "saved" back as an empty profile.
  const profileGate: React.ReactNode = !profileLoaded ? (
    <div className="flex justify-center py-12">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  ) : profileError || !profile ? (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <span className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        {profileError ?? t('profileLoadFailed')}
      </span>
      <Button variant="outline" size="sm" onClick={() => setProfileAttempt((n) => n + 1)}>
        <RefreshCw /> {t('retry')}
      </Button>
    </div>
  ) : null;

  return (
    <div className="space-y-5">
      <AppPageHeader icon={FileText} title={t('title')} subtitle={t('subtitle')} />

      {!appsLoading && !enabled && (
        <Card className="shadow-none">
          <CardContent className="flex items-start gap-3 py-4">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">{t('notEnabled')}</p>
              <Link href="/creator/apps" className="font-medium text-primary underline underline-offset-2">
                {t('notEnabledLink')}
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {profileIncomplete && activeTab !== 'profile' && (
        <ProfileMissingNotice missing={profile?.missing ?? []} onOpenProfile={() => changeTab('profile')} />
      )}


      <Tabs value={activeTab} onValueChange={(v) => changeTab(String(v))}>
        <TabsList variant="line" className="border-b w-full justify-start rounded-none px-0">
          <TabsTrigger value="invoices" className="flex-none px-3">
            {t('tabs.invoices')}
          </TabsTrigger>
          {enabled && (
            <TabsTrigger value="backlog" className="flex-none px-3">
              {t('tabs.backlog')}
              {!!backlogCount && (
                <Badge variant="outline" className="ms-1 text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                  {backlogCount}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {enabled && (
            <TabsTrigger value="profile" className="flex-none px-3">
              {t('tabs.profile')}
              {profileIncomplete && <span className="ms-1 size-1.5 rounded-full bg-amber-500" aria-hidden />}
            </TabsTrigger>
          )}
          {enabled && (
            <TabsTrigger value="numbering" className="flex-none px-3">
              {t('tabs.numbering')}
            </TabsTrigger>
          )}
          {enabled && (
            <TabsTrigger value="settings" className="flex-none px-3">
              {t('tabs.settings')}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="invoices" className="pt-4">
          {appsLoading && !apps ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <InvoicesListTab key={listVersion} token={token} canWrite={enabled} />
          )}
        </TabsContent>

        {enabled && (
          <TabsContent value="backlog" className="pt-4">
            <InvoiceBacklogTab
              token={token}
              onIssued={() => {
                setListVersion((v) => v + 1);
                loadBacklogCount();
              }}
              onOpenProfile={() => changeTab('profile')}
              profileMissing={profile?.missing ?? []}
            />
          </TabsContent>
        )}

        {enabled && (
          <TabsContent value="profile" className="pt-4">
            {profileGate ?? (profile && <LegalProfileForm token={token} profile={profile} onSaved={setProfile} />)}
          </TabsContent>
        )}

        {enabled && (
          <TabsContent value="numbering" className="pt-4">
            {profileGate ??
              (profile && (
                // Remount when the sequences first appear (first profile save).
                <NumberingForm
                  key={profile.numbering ? 'numbering' : 'none'}
                  token={token}
                  profile={profile}
                  onSaved={setProfile}
                />
              ))}
          </TabsContent>
        )}

        {enabled && app && (
          <TabsContent value="settings" className="space-y-4 pt-4">
            <InvoicesSettingsCard app={app} token={token} />
            {/* The EC sales list is built from invoices but lives on the B2B page. */}
            {b2bOn && (
              <Link
                href="/creator/b2b?tab=ec-sales"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {t('ecSalesOnB2b')}
                <ArrowUpRight className="size-3.5 rtl:-scale-x-100" />
              </Link>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
