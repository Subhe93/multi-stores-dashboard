'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { BadgeCheck, Check, Lock, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useDateFormatter } from '@/components/customers/shared';
import {
  REVIEW_REPLY_MAX,
  isReplyValid,
  replyLength,
  reviewProductHref,
  reviewSourceKey,
  type OwnerReview,
} from '@/lib/reviews';
import { ReviewStars } from './ReviewStars';
import { ReviewStatusBadge } from './ReviewStatusBadge';

/** What the owner may do with a review. Each resolves to an error text, or null on success. */
export interface ReviewActions {
  setStatus: (review: OwnerReview, status: 'APPROVED' | 'REJECTED') => Promise<string | null>;
  saveReply: (review: OwnerReview, body: string) => Promise<string | null>;
  removeReply: (review: OwnerReview) => Promise<string | null>;
  remove: (review: OwnerReview) => Promise<string | null>;
}

interface ReviewDialogProps {
  review: OwnerReview | null;
  actions: ReviewActions;
  onClose: () => void;
}

/**
 * Large dialog of one review: the full text (read-only), where it came from,
 * and the moderation actions (approve, reject, delete, reply). The customer's
 * text is rendered as plain text only.
 */
export function ReviewDialog({ review, actions, onClose }: ReviewDialogProps) {
  const t = useTranslations('creator.reviews');
  return (
    <Dialog open={!!review} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('dialog.title')}</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <Lock aria-hidden className="size-3.5 shrink-0" />
            {t('dialog.readOnlyHint')}
          </DialogDescription>
        </DialogHeader>
        {/* Keyed so the reply box is re-seeded when another review (or a new reply) is shown. */}
        {review && <ReviewDialogBody key={`${review.id}:${review.reply?.body ?? ''}`} review={review} actions={actions} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialogBody({ review, actions, onClose }: { review: OwnerReview; actions: ReviewActions; onClose: () => void }) {
  const t = useTranslations('creator.reviews');
  const fmtDate = useDateFormatter();
  const [reply, setReply] = useState(review.reply?.body ?? '');
  const [busy, setBusy] = useState<'status' | 'reply' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (kind: 'status' | 'reply' | 'delete', fn: () => Promise<string | null>): Promise<boolean> => {
    if (busy) return false;
    setBusy(kind);
    setError(null);
    const failure = await fn();
    setBusy(null);
    if (failure) setError(failure);
    return !failure;
  };

  const sourceKey = reviewSourceKey(review.source);
  const length = replyLength(reply);
  const replyChanged = reply.trim() !== (review.reply?.body ?? '');
  const product = review.product;

  return (
    <div className="space-y-5">
      {/* The review itself: read-only. */}
      <div className="space-y-2 rounded-lg border bg-zinc-50/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ReviewStars rating={review.rating} />
          <ReviewStatusBadge status={review.status} />
          {review.verified && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <BadgeCheck aria-hidden className="size-3.5" />
              {t('verified')}
            </span>
          )}
        </div>
        {/* `dir="auto"`: the review keeps the direction of its own language. */}
        <div dir="auto" lang={review.locale || undefined} className="space-y-1">
          {review.title && <p className="text-sm font-semibold">{review.title}</p>}
          <p className="whitespace-pre-wrap break-words text-sm">{review.body}</p>
        </div>
        <p dir="auto" className="text-xs text-muted-foreground">{review.display_name}</p>
      </div>

      <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
        <Detail label={t('columns.product')}>
          {product ? (
            <Link href={reviewProductHref(product)} className="font-medium hover:underline">
              {product.title || product.slug || '—'}
            </Link>
          ) : (
            '—'
          )}
        </Detail>
        <Detail label={t('dialog.order')}>
          {review.order ? (
            <Link href={`/creator/orders/${encodeURIComponent(review.order.id)}`} className="font-medium hover:underline" dir="ltr">
              {review.order.order_number || '—'}
            </Link>
          ) : (
            '—'
          )}
        </Detail>
        <Detail label={t('dialog.customer')}>
          {review.customer ? (
            <Link href={`/creator/customers/${encodeURIComponent(review.customer.id)}`} className="font-medium hover:underline">
              {review.customer.name || review.display_name || '—'}
            </Link>
          ) : (
            '—'
          )}
        </Detail>
        <Detail label={t('columns.source')}>{sourceKey ? t(`source.${sourceKey}`) : review.source || '—'}</Detail>
        <Detail label={t('columns.language')}>
          <span className="uppercase" dir="ltr">{review.locale || '—'}</span>
        </Detail>
        <Detail label={t('dialog.written')}>{fmtDate(review.created_at)}</Detail>
        <Detail label={t('dialog.published')}>{fmtDate(review.published_at)}</Detail>
      </dl>

      {/* Owner reply: plain text, shown publicly under the review. */}
      <div className="space-y-1.5">
        <label htmlFor="review-reply" className="block text-sm font-medium">{t('reply.label')}</label>
        <Textarea
          id="review-reply"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder={t('reply.placeholder')}
          rows={4}
          dir="auto"
          disabled={busy !== null}
          aria-invalid={length > REVIEW_REPLY_MAX}
          aria-describedby="review-reply-counter"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            id="review-reply-counter"
            className={`text-[11px] tabular-nums ${length > REVIEW_REPLY_MAX ? 'text-red-600' : 'text-muted-foreground'}`}
          >
            {t('reply.counter', { count: length, max: REVIEW_REPLY_MAX })}
          </span>
          <div className="flex items-center gap-2">
            {review.reply && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-red-600 hover:text-red-700"
                disabled={busy !== null}
                onClick={() => void run('reply', () => actions.removeReply(review))}
              >
                {t('actions.removeReply')}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              disabled={busy !== null || !replyChanged || !isReplyValid(reply)}
              onClick={() => void run('reply', () => actions.saveReply(review, reply.trim()))}
            >
              {t('actions.saveReply')}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs text-red-600 hover:text-red-700"
          disabled={busy !== null}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="size-3.5" />
          {t('actions.delete')}
        </Button>
        <div className="flex items-center gap-2">
          {review.status !== 'REJECTED' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              disabled={busy !== null}
              onClick={() => void run('status', () => actions.setStatus(review, 'REJECTED'))}
            >
              <X className="size-3.5" />
              {t('actions.reject')}
            </Button>
          )}
          {review.status !== 'APPROVED' && (
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1 text-xs"
              disabled={busy !== null}
              onClick={() => void run('status', () => actions.setStatus(review, 'APPROVED'))}
            >
              <Check className="size-3.5" />
              {t('actions.approve')}
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('confirmDelete.title')}
        description={t('confirmDelete.text')}
        confirmLabel={t('confirmDelete.confirm')}
        destructive
        busy={busy === 'delete'}
        error={confirmDelete ? error : null}
        onConfirm={() => {
          void run('delete', () => actions.remove(review)).then((ok) => {
            if (ok) {
              setConfirmDelete(false);
              onClose();
            }
          });
        }}
      />
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 sm:block">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-end text-foreground sm:text-start">{children}</dd>
    </div>
  );
}
