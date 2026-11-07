'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ExternalLink, MoreHorizontal, PauseCircle, PlayCircle, Ban, MessageSquareWarning, X } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StoreStatusBadge } from '@/components/creator/StoreStatusBadge';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/useApiError';
import { STORE_STATUSES } from '@/lib/storeStatus';
import { listAdminStores, setAdminStoreStatus, type AdminSettableStatus, type AdminStoreRow } from '@/lib/adminStores.api';
import { cn } from '@/lib/utils';

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003';

function storefrontUrl(slug: string): string {
  try {
    const u = new URL(WEB_ORIGIN);
    return `${u.protocol}//${slug}.${u.host}`;
  } catch {
    return `${WEB_ORIGIN}/${slug}`;
  }
}

type Action = { kind: AdminSettableStatus; store: AdminStoreRow };

function CheckMark({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px]', ok ? 'text-emerald-700' : 'text-zinc-400')} title={label}>
      {ok ? <Check className="size-3" /> : <X className="size-3" />}
      {label}
    </span>
  );
}

/** Own Stripe key summary for INDEPENDENT stores (from the list row): mode, state, last check. */
function OwnKeyCell({ store, fmtDate }: { store: AdminStoreRow; fmtDate: (iso: string | null | undefined) => string }) {
  const t = useTranslations('admin.storesQueue.ownKey');
  if (store.store_type !== 'INDEPENDENT') return <span className="text-[11px] text-muted-foreground">{t('marketplace')}</span>;
  const k = store.stripe_own_key;
  if (!k) return <span className="text-[11px] text-zinc-400">{t('none')}</span>;
  const tone =
    k.status === 'ACTIVE'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : k.status === 'NEEDS_RECONNECT'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-zinc-200 bg-zinc-100 text-zinc-600';
  return (
    <div className="space-y-0.5">
      <div className="flex flex-wrap items-center gap-1">
        <span
          className={cn(
            'inline-flex h-5 items-center rounded-full border px-1.5 text-[10px] font-bold',
            k.livemode ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800',
          )}
        >
          {k.livemode ? t('live') : t('test')}
        </span>
        <span className={cn('inline-flex h-5 items-center rounded-full border px-1.5 text-[10px] font-medium', tone)}>
          {t(`state.${k.status}`)}
        </span>
      </div>
      <span className="block text-[11px] text-muted-foreground">{t('lastCheck', { date: fmtDate(k.last_check_at) })}</span>
    </div>
  );
}

function AdminStoresInner() {
  const t = useTranslations('admin.storesQueue');
  const tc = useTranslations('common');
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const describe = useApiError();

  const status = searchParams.get('status') ?? '';
  const q = searchParams.get('q') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const [rows, setRows] = useState<AdminStoreRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  // Row action dialog (approve / request changes / suspend / pause / resume).
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const updateParams = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      const s = params.toString();
      router.replace(s ? `/admin/stores?${s}` : '/admin/stores', { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    if (!token) return;
    const ac = new AbortController();
    setLoading(true);
    Promise.all([
      listAdminStores(token, { status, q, page, limit: 25 }, ac.signal),
      listAdminStores(token, { status: 'PENDING_REVIEW', limit: 1 }, ac.signal).then((r) => r.total).catch(() => null),
    ])
      .then(([res, pending]) => {
        if (ac.signal.aborted) return;
        setRows(res.items);
        setTotal(res.total);
        setLimit(res.limit);
        setPendingCount(pending);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!ac.signal.aborted) setError(describe(err));
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
    // `describe` is stable per locale; excluded to avoid refetch on re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status, q, page, nonce]);

  const fmtDate = (iso: string | null | undefined) =>
    iso ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso)) : '—';

  const openAction = (kind: AdminSettableStatus, store: AdminStoreRow) => {
    setAction({ kind, store });
    setReason('');
    setActionError(null);
  };

  const needsReason = action?.kind === 'CHANGES_REQUESTED' || action?.kind === 'SUSPENDED';

  const confirmAction = async () => {
    if (!token || !action || busy) return;
    if (needsReason && !reason.trim()) {
      setActionError(t('reasonRequired'));
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await setAdminStoreStatus(token, action.store.id, action.kind, needsReason ? reason.trim() : undefined);
      setAction(null);
      setNonce((n) => n + 1);
    } catch (err) {
      setActionError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const statusOptions = [
    { value: '', label: t('allStatuses') },
    ...STORE_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })),
  ];

  const columns = [
    {
      key: 'name',
      label: t('cols.store'),
      render: (s: AdminStoreRow) => (
        <div className="min-w-0">
          <Link href={`/admin/creators/${s.owner.creator_id}`} className="block truncate text-sm font-medium hover:underline">
            {s.name}
          </Link>
          <span className="block truncate font-mono text-[11px] text-muted-foreground" dir="ltr">
            {s.slug}
          </span>
        </div>
      ),
    },
    {
      key: 'owner',
      label: t('cols.owner'),
      render: (s: AdminStoreRow) => (
        <div className="min-w-0">
          <span className="block truncate text-xs">{s.owner.display_name}</span>
          <span className="block truncate text-[11px] text-muted-foreground" dir="ltr">
            {s.owner.email}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      label: tc('status'),
      render: (s: AdminStoreRow) => (
        <div className="space-y-1">
          <StoreStatusBadge status={s.status} />
          {s.status_reason && (s.status === 'CHANGES_REQUESTED' || s.status === 'SUSPENDED') && (
            <p className="max-w-56 truncate text-[11px] text-muted-foreground" title={s.status_reason}>
              {s.status_reason}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'checklist',
      label: t('cols.checklist'),
      render: (s: AdminStoreRow) => (
        <div className="flex flex-col gap-0.5">
          <CheckMark ok={s.owner.email_verified} label={t('check.verified')} />
          <CheckMark ok={s.checklist?.trader_details_complete} label={t('check.trader')} />
          <CheckMark ok={s.checklist?.has_published_product} label={t('check.product')} />
        </div>
      ),
    },
    {
      key: 'payments',
      label: t('cols.payments'),
      render: (s: AdminStoreRow) => <OwnKeyCell store={s} fmtDate={fmtDate} />,
    },
    {
      key: 'created_at',
      label: t('cols.created'),
      render: (s: AdminStoreRow) => <span className="text-xs text-muted-foreground">{fmtDate(s.created_at)}</span>,
    },
    {
      key: 'golive_requested_at',
      label: t('cols.requested'),
      render: (s: AdminStoreRow) => <span className="text-xs text-muted-foreground">{fmtDate(s.golive_requested_at)}</span>,
    },
    {
      key: 'actions',
      label: tc('actions'),
      className: 'text-end',
      render: (s: AdminStoreRow) => (
        <div className="flex items-center justify-end gap-1" data-row-click-ignore>
          {(s.status === 'PENDING_REVIEW' || s.status === 'DRAFT' || s.status === 'CHANGES_REQUESTED') && (
            <Button size="xs" onClick={() => openAction('LIVE', s)}>
              <Check className="size-3" /> {t('actions.approve')}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={tc('actions')}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {s.status !== 'LIVE' && s.status !== 'SUSPENDED' && (
                <DropdownMenuItem onClick={() => openAction('LIVE', s)}>
                  <Check className="size-3.5" /> {t('actions.approve')}
                </DropdownMenuItem>
              )}
              {s.status !== 'CHANGES_REQUESTED' && s.status !== 'LIVE' && (
                <DropdownMenuItem onClick={() => openAction('CHANGES_REQUESTED', s)}>
                  <MessageSquareWarning className="size-3.5" /> {t('actions.requestChanges')}
                </DropdownMenuItem>
              )}
              {s.status === 'LIVE' && (
                <DropdownMenuItem onClick={() => openAction('PAUSED', s)}>
                  <PauseCircle className="size-3.5" /> {t('actions.pause')}
                </DropdownMenuItem>
              )}
              {s.status === 'PAUSED' && (
                <DropdownMenuItem onClick={() => openAction('LIVE', s)}>
                  <PlayCircle className="size-3.5" /> {t('actions.resume')}
                </DropdownMenuItem>
              )}
              {s.status !== 'SUSPENDED' && (
                <DropdownMenuItem variant="destructive" onClick={() => openAction('SUSPENDED', s)}>
                  <Ban className="size-3.5" /> {t('actions.suspend')}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(`/admin/creators/${s.owner.creator_id}`)}>
                {t('actions.openCreator')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(storefrontUrl(s.slug), '_blank', 'noopener')}>
                <ExternalLink className="size-3.5" /> {t('actions.openStorefront')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const actionCopy = action
    ? {
        LIVE: { title: action.store.status === 'PAUSED' ? t('dialog.resumeTitle') : t('dialog.approveTitle'), body: t('dialog.approveBody', { store: action.store.name }) },
        CHANGES_REQUESTED: { title: t('dialog.changesTitle'), body: t('dialog.changesBody', { store: action.store.name }) },
        SUSPENDED: { title: t('dialog.suspendTitle'), body: t('dialog.suspendBody', { store: action.store.name }) },
        PAUSED: { title: t('dialog.pauseTitle'), body: t('dialog.pauseBody', { store: action.store.name }) },
      }[action.kind]
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={status === 'PENDING_REVIEW' ? 'default' : 'outline'}
          onClick={() => updateParams({ status: status === 'PENDING_REVIEW' ? '' : 'PENDING_REVIEW', page: '' })}
        >
          {t('pendingReview')}
          {pendingCount != null && (
            <Badge variant={status === 'PENDING_REVIEW' ? 'secondary' : 'destructive'} className="ms-1 text-[10px]">
              {pendingCount}
            </Badge>
          )}
        </Button>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => setNonce((n) => n + 1)}>
            {t('retry')}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder={t('searchPlaceholder')}
          onSearch={(value) => updateParams({ q: value, page: '' })}
          actions={
            <div className="w-48">
              <SearchableSelect value={status} onChange={(v) => updateParams({ status: v, page: '' })} options={statusOptions} />
            </div>
          }
          emptyMessage={loading ? tc('loading') : status === 'PENDING_REVIEW' ? t('emptyPending') : t('empty')}
          pagination={{ total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) }}
          onPageChange={(p) => updateParams({ page: p > 1 ? String(p) : '' })}
          rowHref={(s: AdminStoreRow) => `/admin/creators/${s.owner.creator_id}`}
        />
      )}

      <Dialog open={!!action} onOpenChange={(o) => { if (!busy && !o) setAction(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{actionCopy?.title}</DialogTitle>
            <DialogDescription>{actionCopy?.body}</DialogDescription>
          </DialogHeader>
          {needsReason && (
            <div className="space-y-1.5">
              <Label htmlFor="store-action-reason" className="text-xs">
                {t('reason')} <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="store-action-reason"
                rows={4}
                className="text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={action?.kind === 'SUSPENDED' ? t('reasonPlaceholderSuspend') : t('reasonPlaceholderChanges')}
              />
              <p className="text-[11px] text-muted-foreground">{t('reasonHint')}</p>
            </div>
          )}
          {actionError && <p className="text-xs text-red-600" role="alert">{actionError}</p>}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setAction(null)} disabled={busy}>
              {tc('cancel')}
            </Button>
            <Button size="sm" variant={action?.kind === 'SUSPENDED' ? 'destructive' : 'default'} onClick={confirmAction} disabled={busy}>
              {busy ? tc('saving') : action ? t(`confirm.${action.kind}`) : tc('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminStoresPage() {
  return (
    <Suspense fallback={null}>
      <AdminStoresInner />
    </Suspense>
  );
}
