'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth, type ProviderProfile } from '@/lib/auth';

/**
 * Supplier dashboard notice (SPEC §4): while the platform requires provider
 * approval and this provider is not verified yet, its products are hidden
 * from the creators' catalog. Reads `GET /providers/me`.
 */
export function ProviderUnverifiedBanner() {
  const { token, user } = useAuth();
  const t = useTranslations('provider.unverified');
  const [me, setMe] = useState<ProviderProfile | null>(null);

  useEffect(() => {
    if (!token || user?.role !== 'PROVIDER') return;
    let alive = true;
    api<ProviderProfile>('/providers/me', { token })
      .then((p) => { if (alive) setMe(p); })
      .catch(() => { if (alive) setMe(null); });
    return () => { alive = false; };
  }, [token, user?.role]);

  if (!me || !me.approval_required || me.verified) return null;

  return (
    <div role="status" className="mb-4 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
      <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-medium">{t('title')}</p>
        <p className="mt-0.5 text-xs opacity-80">{t('body')}</p>
      </div>
    </div>
  );
}
