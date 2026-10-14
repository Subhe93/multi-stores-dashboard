'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { missingFieldLabel, onlyVatMissing } from '@/lib/invoices';
import type { InvoiceKind } from '@/lib/invoices.api';

export function InvoiceKindBadge({ kind }: { kind: InvoiceKind }) {
  const t = useTranslations('creator.invoices.kind');
  return (
    <Badge
      variant="outline"
      className={`text-[10px] ${
        kind === 'CREDIT_NOTE' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-sky-50 text-sky-700 border-sky-200'
      }`}
    >
      {t(kind)}
    </Badge>
  );
}

export function InvoicePaidBadge({ paid }: { paid: boolean }) {
  const t = useTranslations('creator.invoices');
  return (
    <Badge
      variant="outline"
      className={`text-[10px] ${
        paid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
      }`}
    >
      {paid ? t('paidBadge') : t('unpaidBadge')}
    </Badge>
  );
}

/**
 * Lists the legal-profile fields still missing (from `missing[]` of the
 * profile view or the INVOICE_PROFILE_INCOMPLETE error) with a link to the
 * Seller profile tab. `onOpenProfile` switches tabs in place when the
 * notice is already rendered on the Invoices page.
 */
export function ProfileMissingNotice({
  missing,
  onOpenProfile,
  compact,
}: {
  missing: string[];
  onOpenProfile?: () => void;
  compact?: boolean;
}) {
  const t = useTranslations('creator.invoices');
  const tProfile = useTranslations('creator.invoices.profile');
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{onlyVatMissing(missing) ? t('profileVatOnly') : t('profileIncomplete')}</p>
        {missing.length > 0 && !onlyVatMissing(missing) && (
          <ul className={`list-disc ps-4 ${compact ? 'text-[11px]' : ''}`}>
            {missing.map((m) => (
              <li key={m}>{missingFieldLabel(m, tProfile)}</li>
            ))}
          </ul>
        )}
        {onOpenProfile ? (
          <button type="button" onClick={onOpenProfile} className="font-medium text-amber-900 underline underline-offset-2">
            {t('profileIncompleteLink')}
          </button>
        ) : (
          <Link href="/creator/invoices?tab=profile" className="font-medium text-amber-900 underline underline-offset-2">
            {t('profileIncompleteLink')}
          </Link>
        )}
      </div>
    </div>
  );
}
