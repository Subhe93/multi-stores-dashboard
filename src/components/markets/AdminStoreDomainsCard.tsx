'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { DOMAIN_STATUS_CLASS } from '@/components/markets/DomainsPanel';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/useApiError';
import { adminListStoreDomains, adminSetDomainStatus, type DomainView, type StoreDomainStatus } from '@/lib/markets.api';

const STATUSES: StoreDomainStatus[] = ['PENDING', 'VERIFIED', 'ACTIVE'];

interface AdminStoreDomainsCardProps {
  creatorId: string;
}

/**
 * Admin view of a store's market domains with the status control (L6): the
 * creator verifies DNS (VERIFIED), the admin sets ACTIVE after the Cloudflare
 * step. Only ACTIVE hosts are served.
 */
export function AdminStoreDomainsCard({ creatorId }: AdminStoreDomainsCardProps) {
  const t = useTranslations('admin.domains');
  const locale = useLocale();
  const { token } = useAuth();
  const describeError = useApiError();
  const [domains, setDomains] = useState<DomainView[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!token || !creatorId) return;
    let cancelled = false;
    adminListStoreDomains(token, creatorId)
      .then((list) => { if (!cancelled) setDomains(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancelled) { setDomains([]); setLoadFailed(true); } });
    return () => { cancelled = true; };
  }, [token, creatorId]);

  const handleStatus = async (d: DomainView, status: StoreDomainStatus) => {
    if (!token || saving || status === d.status || !domains) return;
    setSaving(d.id);
    setMessage(null);
    try {
      const updated = await adminSetDomainStatus(token, d.id, status);
      setDomains(domains.map((x) => (x.id === d.id ? updated : x)));
      setMessage({ kind: 'ok', text: t('updated') });
    } catch (err) {
      setMessage({ kind: 'err', text: describeError(err) });
    } finally {
      setSaving(null);
    }
  };

  // Stores without the app (or any domain rows) show nothing extra.
  if (!domains || (domains.length === 0 && !loadFailed)) return null;

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
        <p className="text-[11px] text-muted-foreground">{t('subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {domains.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0">
            <div className="min-w-0 space-y-0.5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <code className="font-mono" dir="ltr">{d.hostname}</code>
                <Badge variant="outline" className={`text-[10px] ${DOMAIN_STATUS_CLASS[d.status]}`}>{t(`status.${d.status}`)}</Badge>
              </p>
              <p className="text-[11px] text-muted-foreground" dir="ltr">
                CNAME → {d.dns?.expected_cname ?? '—'}
                {d.redirect_to ? ` · 301 → ${d.redirect_to}` : ''}
                {d.verified_at ? ` · ${t('verifiedAt', { date: new Date(d.verified_at).toLocaleString(locale) })}` : ''}
              </p>
            </div>
            <div className="w-44 shrink-0">
              <SearchableSelect
                value={d.status}
                onChange={(v) => handleStatus(d, v as StoreDomainStatus)}
                options={STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
              />
            </div>
          </div>
        ))}
        {loadFailed && <p className="text-[11px] text-red-600">{t('loadFailed')}</p>}
        {message && <p className={`text-[11px] ${message.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>}
      </CardContent>
    </Card>
  );
}
