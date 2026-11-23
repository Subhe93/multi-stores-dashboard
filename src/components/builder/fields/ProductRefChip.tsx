'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, Loader2, Pencil, X } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/media';
import { useProductRef } from '@/lib/productRefs';
import { productRefTitle } from '@/lib/productRefsBatch';

/**
 * Picked product of a link (M165): thumbnail, title in the content locale and
 * a status badge (Draft / Archived). A product that no longer exists (or is
 * not the owner's) shows an amber warning; a failed lookup shows a retry
 * link and never claims the product was deleted. The image is never mirrored.
 */
export function ProductRefChip({
  id,
  token,
  contentLocale,
  onChange,
  onRemove,
  missingTitle,
  missingBody,
  missingActions,
  notPublishedText,
}: {
  id: string;
  token: string;
  contentLocale: string;
  onChange?: () => void;
  onRemove?: () => void;
  /** Texts of the missing-product warning (callers word it for their surface). */
  missingTitle: string;
  missingBody?: string;
  missingActions?: React.ReactNode;
  /** Caption under a Draft / Archived product (default: the link field wording). */
  notPublishedText?: string;
}) {
  const t = useTranslations('builder.linkField');
  const { result, loading, retry } = useProductRef(id, token);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 ps-2 pe-2 py-1.5 text-[11.5px] text-zinc-500" role="status">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        {t('loading')}
      </div>
    );
  }

  if (!result || result.state === 'error') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 ps-2 pe-2 py-1.5 text-[11.5px] text-zinc-600">
        <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-zinc-400" dir="ltr">{id}</span>
        <span className="shrink-0">{t('loadFailed')}</span>
        <button type="button" onClick={retry} className="shrink-0 font-medium text-indigo-600 hover:underline">
          {t('retry')}
        </button>
      </div>
    );
  }

  if (result.state === 'missing') {
    return (
      <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 ps-2.5 pe-2.5 py-2 text-[11.5px] text-amber-900 space-y-1.5">
        <p className="flex items-start gap-1.5 font-medium text-start">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" aria-hidden />
          {missingTitle}
        </p>
        {missingBody && <p className="text-[10.5px] leading-relaxed text-amber-800 text-start">{missingBody}</p>}
        {missingActions && <div className="flex flex-wrap gap-2">{missingActions}</div>}
      </div>
    );
  }

  const product = result.product;
  const title = productRefTitle(product, contentLocale) || product.slug || product.id;
  const image = resolveMediaUrl(product.images?.[0]?.url);
  const status = product.status === 'DRAFT' ? t('statusDraft') : product.status === 'ARCHIVED' ? t('statusArchived') : null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 ps-2 pe-1 py-1.5">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="rounded-md object-cover size-8 shrink-0 bg-zinc-100" />
        ) : (
          <span className="rounded-md size-8 shrink-0 bg-zinc-200" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-zinc-800 text-start">{title}</span>
        {status && (
          <span className="shrink-0 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">{status}</span>
        )}
        {onChange && (
          <button
            type="button"
            onClick={onChange}
            aria-label={t('change')}
            title={t('change')}
            className="ms-auto shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
          >
            <Pencil className="size-3.5" aria-hidden />
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={t('remove')}
            title={t('remove')}
            className="shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-red-600"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      {status && <p className="text-[10.5px] text-amber-700 leading-relaxed">{notPublishedText ?? t('notPublished')}</p>}
    </div>
  );
}
