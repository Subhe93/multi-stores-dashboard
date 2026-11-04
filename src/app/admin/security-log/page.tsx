'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';

interface SecurityEvent {
  id: string;
  created_at: string;
  action: string;
  actor_email: string | null;
  actor_role: string | null;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  fields: string[];
  ip: string | null;
  user_agent: string | null;
}

interface SecurityEventsResponse {
  items: SecurityEvent[];
  total: number;
  page: number;
  limit: number;
}

// Action keys from the API contract, in filter order.
const ACTIONS = [
  'payment_keys.platform.updated',
  'payment_keys.kustom.updated',
  'payment_keys.stripe_connect.disconnected',
  'two_factor.enabled',
  'two_factor.disabled',
  'two_factor.recovery_regenerated',
  'two_factor.recovery_used',
  'two_factor.login_failed',
  'two_factor.locked',
  'two_factor.reset_by_admin',
  'reauth.failed',
  'reauth.granted',
  'user.created_staff',
  'user.email_changed_by_admin',
  'user.password_reset_by_admin',
  'user.status_changed',
  'user.deleted_by_admin',
  'store.status_changed',
  'backup.created',
  'backup.downloaded',
  'backup.restored',
  'backup.deleted',
] as const;

const KNOWN_ACTIONS = new Set<string>(ACTIONS);

// Colour per kind of event: payment-key changes stand out, failures warn.
function actionTone(action: string): string {
  if (action.startsWith('payment_keys.')) return 'border-violet-200 bg-violet-50 text-violet-700';
  if (action === 'two_factor.disabled' || action.endsWith('.failed') || action.endsWith('_failed') || action.endsWith('.locked')) {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  if (action === 'two_factor.enabled') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-zinc-200 bg-zinc-100 text-zinc-700';
}

// Translation keys can't contain dots inside one segment, so map them.
const actionKey = (action: string) => action.replace(/\./g, '_');

const PAGE_SIZE = 25;

// Append-only audit trail of payment-key and two-factor changes. Secret
// values are never recorded — only which fields changed.
export default function AdminSecurityLogPage() {
  const t = useTranslations('security.log');
  const locale = useLocale();
  const apiError = useApiError();
  const { token } = useAuth();
  const [data, setData] = useState<SecurityEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (action) params.set('action', action);
      setData(await api<SecurityEventsResponse>(`/admin/security-events?${params.toString()}`, { token }));
    } catch (err) {
      setError(apiError(err) || t('loadFailed'));
    } finally {
      setLoading(false);
    }
    // apiError is a fresh function each render; leaving it out avoids a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, action, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const label = (a: string) => (KNOWN_ACTIONS.has(a) ? t(`actions.${actionKey(a)}` as never) : a);
  const roleLabel = (r: string | null) =>
    r && ['ADMIN', 'CREATOR', 'PROVIDER', 'CUSTOMER'].includes(r) ? t(`roles.${r}` as never) : r || '';
  const targetLabel = (row: SecurityEvent) => {
    if (row.target_label) return row.target_label;
    if (row.target_type === 'platform') return t('targetPlatform');
    return row.target_type || '—';
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-72 max-w-full">
          <SearchableSelect
            value={action}
            onChange={(v) => {
              setAction(v);
              setPage(1);
            }}
            options={[{ value: '', label: t('allActions') }, ...ACTIONS.map((a) => ({ value: a, label: label(a) }))]}
          />
        </div>
        <Button size="sm" variant="outline" className="h-8 ms-auto" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          <span className="ms-1.5">{t('refresh')}</span>
        </Button>
      </div>

      <Card className="shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('time')}</TableHead>
                <TableHead>{t('action')}</TableHead>
                <TableHead>{t('actor')}</TableHead>
                <TableHead>{t('target')}</TableHead>
                <TableHead>{t('fields')}</TableHead>
                <TableHead>{t('ip')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {error ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-destructive">{error}</TableCell>
                </TableRow>
              ) : loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center">
                    <Loader2 className="size-4 animate-spin inline text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString(locale)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${actionTone(row.action)}`}>
                        {label(row.action)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <p className="font-mono" dir="ltr">{row.actor_email || '—'}</p>
                      {row.actor_role && <p className="text-[11px] text-muted-foreground">{roleLabel(row.actor_role)}</p>}
                    </TableCell>
                    <TableCell className="text-xs">{targetLabel(row)}</TableCell>
                    <TableCell className="text-xs">
                      {row.fields.length ? (
                        <div className="flex max-w-56 flex-wrap gap-1" dir="ltr">
                          {row.fields.map((f) => (
                            <code key={f} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{f}</code>
                          ))}
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap" dir="ltr" title={row.user_agent || undefined}>
                      {row.ip || '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">{t('note')}</p>

      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('pageOf', { page, pages, total })}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              {t('previous')}
            </Button>
            <Button size="sm" variant="outline" className="h-7" disabled={page >= pages || loading} onClick={() => setPage((p) => p + 1)}>
              {t('next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
