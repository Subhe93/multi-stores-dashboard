'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RotateCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { TraderDetails } from '@/lib/storeStatus';
import { LegalDetailsFormCard } from '@/components/creator/TraderDetailsForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/** GET / PUT /providers/me/legal-details. */
export interface ProviderLegalDetailsResponse {
  legal_details: TraderDetails | null;
  complete: boolean;
}

/** Anchor of the card on /provider/settings (linked from the overview hint). */
export const PROVIDER_LEGAL_DETAILS_ANCHOR = 'legal-details';

/**
 * The supplier's legal company identity (needed for invoices and payouts).
 * Same form and rules as the store trader details, saved on the provider.
 */
export function ProviderLegalDetailsCard({ onSaved }: { onSaved?: (complete: boolean) => void }) {
  const { token } = useAuth();
  const t = useTranslations('provider.legalDetails');
  const tc = useTranslations('common');
  const [data, setData] = useState<ProviderLegalDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!token) return null;
    try {
      const res = await api<ProviderLegalDetailsResponse>('/providers/me/legal-details', { token });
      setData(res);
      setFailed(false);
      return res;
    } catch {
      setFailed(true);
      return null;
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = () => {
    setLoading(true);
    setFailed(false);
    void load();
  };

  // Never show an empty, editable form when the stored record could not be
  // read: saving it would overwrite the real details with blanks.
  if (failed && !data) {
    return (
      <Card id={PROVIDER_LEGAL_DETAILS_ANCHOR} className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-red-600" role="alert">
            {t('loadError')}
          </p>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={retry}>
            <RotateCw className="w-3.5 h-3.5" /> {tc('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <LegalDetailsFormCard
      id={PROVIDER_LEGAL_DETAILS_ANCHOR}
      details={data?.legal_details}
      loading={loading}
      complete={!!data?.complete}
      saveEndpoint="/providers/me/legal-details"
      onSaved={() => {
        void load().then((res) => onSaved?.(!!res?.complete));
      }}
      texts={{
        title: t('title'),
        subtitle: t('subtitle'),
        saved: t('saved'),
        supportEmailHint: t('supportEmailHint'),
      }}
    />
  );
}
