'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface Provider {
  id: string;
  company_name: string;
  description?: string;
  country: string;
  phone?: string;
  verified: boolean;
  created_at: string;
  user: { email: string; status: string };
}

export default function AdminProviders() {
  const t = useTranslations('admin');
  const { token } = useAuth();
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProviders = async () => {
    if (!token) return;
    try {
      const res = await api<any>('/providers', { token });
      setProviders(res?.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProviders(); }, [token]);

  const handleVerify = async (id: string) => {
    if (!token) return;
    await api(`/providers/${id}/verify`, { method: 'PUT', token });
    fetchProviders();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('providers')}</h1>
        <p className="text-sm text-muted-foreground">{t('providersSubtitle')}</p>
      </div>

      <DataTable
        columns={[
          { key: 'company', label: t('company'), render: (item: Provider) => (
            <div>
              <p className="text-sm font-medium">{item.company_name}</p>
              <p className="text-[10px] text-muted-foreground">{item.user.email}</p>
            </div>
          )},
          { key: 'country', label: t('country'), render: (item: Provider) => (
            <span className="text-sm">{item.country}</span>
          )},
          { key: 'phone', label: t('phone'), render: (item: Provider) => (
            <span className="text-xs text-muted-foreground">{item.phone || '—'}</span>
          )},
          { key: 'verified', label: t('status'), render: (item: Provider) => (
            item.verified
              ? <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">{t('verified')}</Badge>
              : <Badge variant="outline" className="text-[10px] font-semibold bg-amber-50 text-amber-700 border-amber-200">{t('pending')}</Badge>
          )},
          { key: 'created_at', label: t('joined'), render: (item: Provider) => (
            <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
          )},
          { key: 'actions', label: '', render: (item: Provider) => (
            <div className="flex gap-1">
              {!item.verified && (
                <Button size="sm" className="h-6 text-[10px]" onClick={() => handleVerify(item.id)}>{t('verify')}</Button>
              )}
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => router.push(`/admin/providers/${item.id}`)}>{t('view')}</Button>
            </div>
          )},
        ]}
        data={providers}
        searchPlaceholder={t('searchProviders')}
        onSearch={(q) => {
          if (!token) return;
          api<any>(`/providers?search=${q}`, { token }).then((res) => setProviders(res?.data || []));
        }}
        emptyMessage={loading ? t('loading') : t('noProvidersFound')}
      />
    </div>
  );
}
