'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, Info, Loader2, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDateFormatter } from '@/components/customers/shared';
import { ReviewStatusBadge } from '@/components/reviews/ReviewStatusBadge';
import { useReviewError } from '@/components/reviews/useReviewError';
import { isOrderNotEligible, type ReviewLink } from '@/lib/reviews';
import { createReviewLinks } from '@/lib/reviews.api';

/**
 * "Review links" card of the order view (store app `reviews`, M171): creates
 * one buyer link per product of the order, to copy and send to the buyer.
 * The links are write credentials of the buyer: they live in the memory of
 * this component only (never in the URL, storage or a log) and are not
 * printed on screen. An order that is not a real, paid purchase gets an
 * inline explanation instead of an error.
 */
export function OrderReviewLinks({ orderId, token }: { orderId: string; token: string }) {
  const t = useTranslations('creator.orders.reviewLinks');
  const fmtDate = useDateFormatter();
  const describeError = useReviewError();
  const [links, setLinks] = useState<ReviewLink[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [notEligible, setNotEligible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const create = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    setNotEligible(false);
    try {
      setLinks(await createReviewLinks(token, orderId));
    } catch (err) {
      if (isOrderNotEligible(err)) setNotEligible(true);
      else setError(describeError(err));
    } finally {
      setCreating(false);
    }
  };

  const copy = async (link: ReviewLink) => {
    setError(null);
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedId(link.order_item_id);
      setTimeout(() => setCopiedId((id) => (id === link.order_item_id ? null : id)), 2000);
    } catch {
      setError(t('copyFailed'));
    }
  };

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Star aria-hidden className="size-4 text-muted-foreground" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <p className="text-muted-foreground">{t('description')}</p>
        <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-amber-900">
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>{t('buyerOnlyNote')}</span>
        </p>

        {notEligible ? (
          <p className="rounded-md border bg-zinc-50 px-2.5 py-2 text-muted-foreground">{t('notEligible')}</p>
        ) : links === null ? (
          <Button type="button" variant="outline" size="sm" className="h-8 w-full text-xs" disabled={creating} onClick={() => void create()}>
            {creating ? <Loader2 className="animate-spin" /> : null}
            {t('create')}
          </Button>
        ) : links.length === 0 ? (
          <p className="text-muted-foreground">{t('none')}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {links.map((link) => {
              const copied = copiedId === link.order_item_id;
              return (
                <li key={link.order_item_id} className="flex items-center justify-between gap-2 px-2.5 py-2">
                  <div className="min-w-0 space-y-1">
                    <p dir="auto" className="truncate font-medium text-foreground">{link.product_title || '—'}</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      {link.review_status && (
                        <>
                          <span>{t('alreadyReviewed')}</span>
                          <ReviewStatusBadge status={link.review_status} />
                        </>
                      )}
                      {link.expires_at && <span>{t('validUntil', { date: fmtDate(link.expires_at) })}</span>}
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 gap-1 text-xs" onClick={() => void copy(link)}>
                    {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    <span aria-live="polite">{copied ? t('copied') : t('copy')}</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {error && <p role="alert" className="text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
