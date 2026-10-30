'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useBulkAction } from '@/components/common/useBulkAction';

interface Creator {
  id: string;
  display_name: string;
  bio?: string;
  phone?: string;
  verified: boolean;
  created_at: string;
  user: { email: string; status: string };
}

export default function AdminCreators() {
  const t = useTranslations('admin');
  const tb = useTranslations('bulk');
  const bulk = useBulkAction();
  const { token } = useAuth();
  const router = useRouter();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCreators = async () => {
    if (!token) return;
    try {
      const res = await api<{ data: Creator[] }>('/creators', { token });
      setCreators(res?.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCreators(); }, [token]);

  const handleVerify = async (id: string) => {
    if (!token) return;
    await api(`/creators/${id}/verify`, { method: 'PUT', token });
    fetchCreators();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('creators')}</h1>
        <p className="text-sm text-muted-foreground">{t('creatorsSubtitle')}</p>
      </div>

      {bulk.notice}

      <DataTable
        columns={[
          { key: 'name', label: t('creator'), render: (item: Creator) => (
            <div>
              <Link href={`/admin/creators/${item.id}`} className="text-sm font-medium hover:underline">{item.display_name}</Link>
              <p className="text-[10px] text-muted-foreground">{item.user.email}</p>
            </div>
          )},
          { key: 'bio', label: t('bio'), render: (item: Creator) => (
            <span className="text-xs text-muted-foreground line-clamp-1">{item.bio || '—'}</span>
          )},
          { key: 'verified', label: t('status'), render: (item: Creator) => (
            item.verified
              ? <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">{t('verified')}</Badge>
              : <Badge variant="outline" className="text-[10px] font-semibold bg-amber-50 text-amber-700 border-amber-200">{t('pending')}</Badge>
          )},
          { key: 'created_at', label: t('joined'), render: (item: Creator) => (
            <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
          )},
          { key: 'actions', label: '', render: (item: Creator) => (
            <div className="flex gap-1">
              {!item.verified && (
                <Button size="sm" className="h-6 text-[10px]" onClick={() => handleVerify(item.id)}>{t('verify')}</Button>
              )}
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => router.push(`/admin/creators/${item.id}`)}>{t('view')}</Button>
            </div>
          )},
        ]}
        data={creators}
        selectable
        rowHref={(item: Creator) => `/admin/creators/${item.id}`}
        bulkActions={(rows, clear) => {
          const pending = rows.filter((r) => !r.verified);
          return (
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={bulk.busy || pending.length === 0}
              onClick={() => bulk.run({
                rows: pending,
                fn: (r) => api(`/creators/${r.id}/verify`, { method: 'PUT', token: token ?? undefined }),
                done: (count) => tb('verifiedCount', { count }),
                clear,
                after: fetchCreators,
              })}
            >
              {bulk.busy ? tb('working') : tb('verifyCount', { count: pending.length })}
            </Button>
          );
        }}
        searchPlaceholder={t('searchCreators')}
        onSearch={(q) => {
          if (!token) return;
          api<{ data: Creator[] }>(`/creators?search=${q}`, { token }).then((res) => setCreators(res?.data || []));
        }}
        emptyMessage={loading ? t('loading') : t('noCreatorsFound')}
      />
    </div>
  );
}
