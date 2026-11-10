'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FlaskConical, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import {
  deletableBlocker,
  testFlagErrorKey,
  trashErrorKey,
  type DeletableOrderFields,
} from '@/lib/orderTrash';

/** Order fields the trash controls read (detail payload subset). */
export interface TrashControlOrder extends DeletableOrderFields {
  id: string;
  order_number: string;
  deleted_at?: string | null;
}

interface DeleteOrderButtonProps {
  order: TrashControlOrder;
  token: string | null | undefined;
  /** Called with the fresh order after the soft delete succeeded. */
  onDeleted: () => void;
  className?: string;
}

/**
 * "Delete order" (soft delete, DELETE /orders/:id) with a destructive confirm
 * dialog that names the order and takes an optional reason. The button is
 * disabled with a hint when the client-side rule says the order was paid;
 * the API remains the authority and its 409 codes are shown as messages.
 */
export function DeleteOrderButton({ order, token, onDeleted, className }: DeleteOrderButtonProps) {
  const t = useTranslations('orders.trash');
  const describeError = useApiError();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Pre-check only drives the disabled hint; the API's 409 is the authority.
  const blocker = deletableBlocker(order);
  const deletable = blocker === null;
  const hint = blocker ? t('notDeletableReasonHint', { reason: t(`reason_${blocker}`) }) : undefined;

  const confirm = async () => {
    if (!token || busy) return;
    setBusy(true);
    setError('');
    try {
      const trimmed = reason.trim();
      await api(`/orders/${order.id}`, {
        method: 'DELETE',
        token,
        body: JSON.stringify(trimmed ? { reason: trimmed.slice(0, 500) } : {}),
      });
      setOpen(false);
      setReason('');
      onDeleted();
    } catch (err) {
      const key = trashErrorKey(err);
      setError(key ? t(key) : describeError(err) || t('failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <span title={hint} className={className}>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs text-red-600 hover:text-red-700 disabled:text-muted-foreground"
          disabled={!deletable || !token}
          onClick={() => {
            setError('');
            setOpen(true);
          }}
        >
          <Trash2 className="size-3.5" />
          {t('delete')}
        </Button>
      </span>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => {
          if (!busy) setOpen(o);
        }}
        title={t('deleteTitle', { number: order.order_number })}
        description={t('deleteDescription')}
        confirmLabel={t('confirmDelete')}
        destructive
        busy={busy}
        busyLabel={t('deleting')}
        error={error || undefined}
        onConfirm={() => void confirm()}
      >
        <div className="space-y-1.5">
          <label htmlFor="order-delete-reason" className="text-xs font-medium">
            {t('reasonLabel')}
          </label>
          <Textarea
            id="order-delete-reason"
            value={reason}
            maxLength={500}
            rows={2}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('reasonPlaceholder')}
            className="text-sm"
            disabled={busy}
          />
        </div>
      </ConfirmDialog>
    </>
  );
}

interface DeletedOrderBannerProps {
  order: TrashControlOrder;
  token: string | null | undefined;
  /** Called after POST /orders/:id/restore succeeded (reload the order). */
  onRestored: () => void;
}

/**
 * Grey banner on the detail page of a soft-deleted order: "This order was
 * deleted on <date>. [Restore]". Renders nothing while `deleted_at` is null.
 */
export function DeletedOrderBanner({ order, token, onRestored }: DeletedOrderBannerProps) {
  const t = useTranslations('orders.trash');
  const describeError = useApiError();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!order.deleted_at) return null;
  const date = new Date(order.deleted_at);
  const when = Number.isNaN(date.getTime()) ? order.deleted_at : date.toLocaleString();

  const restore = async () => {
    if (!token || busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/orders/${order.id}/restore`, { method: 'POST', token });
      onRestored();
    } catch (err) {
      const key = trashErrorKey(err);
      setError(key ? t(key) : describeError(err) || t('failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm text-zinc-700"
    >
      <span className="inline-flex items-center gap-2">
        <Trash2 className="size-4 shrink-0" aria-hidden />
        <span>
          {t('deletedBanner', { date: when })}
          {error && <span className="ms-2 text-red-600">{error}</span>}
        </span>
      </span>
      <Button variant="outline" size="sm" className="h-7 bg-background text-xs" disabled={busy || !token} onClick={() => void restore()}>
        <RotateCcw className="size-3.5" />
        {busy ? t('restoring') : t('restore')}
      </Button>
    </div>
  );
}

interface TestFlagButtonProps {
  order: TrashControlOrder;
  token: string | null | undefined;
  /** Called after PUT /orders/:id/test-flag succeeded (reload the order). */
  onChanged: () => void;
}

/**
 * Admin only: "Mark as test" / "Remove test flag" next to the Test badge,
 * behind a confirm dialog. Hidden on deleted orders (the API refuses them).
 */
export function TestFlagButton({ order, token, onChanged }: TestFlagButtonProps) {
  const t = useTranslations('orders.testFlag');
  const describeError = useApiError();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (order.deleted_at) return null;
  const isTest = order.is_test === true;

  const confirm = async () => {
    if (!token || busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/orders/${order.id}/test-flag`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ is_test: !isTest }),
      });
      setOpen(false);
      onChanged();
    } catch (err) {
      const key = testFlagErrorKey(err);
      setError(key ? t(key) : describeError(err) || t('failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        disabled={!token}
        onClick={() => {
          setError('');
          setOpen(true);
        }}
      >
        <FlaskConical className="size-3.5" />
        {isTest ? t('removeTestFlag') : t('markAsTest')}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => {
          if (!busy) setOpen(o);
        }}
        title={isTest ? t('removeTitle', { number: order.order_number }) : t('markTitle', { number: order.order_number })}
        description={isTest ? t('removeDescription') : t('markDescription')}
        confirmLabel={isTest ? t('removeTestFlag') : t('markAsTest')}
        busy={busy}
        busyLabel={t('working')}
        error={error || undefined}
        onConfirm={() => void confirm()}
      />
    </>
  );
}
