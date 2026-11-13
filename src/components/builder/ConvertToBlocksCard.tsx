'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Blocks } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

interface ConvertToBlocksCardProps {
  sectionId: string;
  /** Runs the conversion; rejects with the API error when it is refused. */
  onConvert: (sectionId: string) => Promise<void>;
}

/**
 * Inspector card on a product-page section: "Convert to blocks" rebuilds the
 * product page as separate product blocks inside layout containers. The
 * confirm dialog explains that it is a draft change and that the old block is
 * only hidden, so the owner can preview before publishing or go back.
 */
export function ConvertToBlocksCard({ sectionId, onConvert }: ConvertToBlocksCardProps) {
  const t = useTranslations('builder.convertBlocks');
  const tRoot = useTranslations();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errorText = (err: unknown): string => {
    if (err instanceof ApiError && err.code && tRoot.has(`errors.${err.code}`)) {
      return tRoot(`errors.${err.code}`);
    }
    return t('failed');
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConvert(sectionId);
      setOpen(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-4 mt-4 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
      <div className="flex items-start gap-2.5">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-indigo-200 bg-white text-indigo-600">
          <Blocks className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-zinc-900">{t('title')}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-zinc-600">{t('hint')}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
          >
            {t('button')}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('confirmTitle')}
        description={
          <span className="block space-y-2">
            <span className="block">{t('confirmBody')}</span>
            <span className="block">{t('confirmDraft')}</span>
          </span>
        }
        confirmLabel={t('confirm')}
        busy={busy}
        busyLabel={t('converting')}
        error={error}
        onConfirm={() => void confirm()}
      />
    </div>
  );
}
