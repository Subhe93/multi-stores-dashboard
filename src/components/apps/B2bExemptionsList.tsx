'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApiError } from '@/lib/useApiError';
import type { TaxExemptionView } from '@/lib/b2b';
import { listTaxExemptions, revokeTaxExemption } from '@/lib/b2bTax.api';

interface B2bExemptionsListProps {
  token: string;
}

/**
 * "Tax-exempt customers" section under the b2b app card (D4/L7): the store's
 * active customer exemptions with a remove (soft revoke) action. Exemptions
 * are created from an order's Customer card.
 */
export function B2bExemptionsList({ token }: B2bExemptionsListProps) {
  const t = useTranslations('creator.apps.b2b.settings.exemptions');
  const tx = useTranslations('creator.orderDetail.taxExemption');
  const locale = useLocale();
  const describeError = useApiError();
  const [rows, setRows] = useState<TaxExemptionView[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listTaxExemptions(token)
      .then((list) => setRows((Array.isArray(list) ? list : []).filter((r) => !r.revoked_at)))
      .catch((err: unknown) => setError(describeError(err)))
      .finally(() => setLoading(false));
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRemove = async (id: string) => {
    if (removingId) return;
    setRemovingId(id);
    setError(null);
    try {
      await revokeTaxExemption(token, id);
      setRows((prev) => (prev ?? []).filter((r) => r.id !== id));
      setConfirmId(null);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setRemovingId(null);
    }
  };

  const customerName = (row: TaxExemptionView) =>
    [row.customer.first_name, row.customer.last_name].filter(Boolean).join(' ') || row.customer.email || '—';

  return (
    <div className="space-y-2 border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">{t('title')}</p>
        <Button size="icon-xs" variant="ghost" onClick={load} disabled={loading} aria-label={t('refresh')}>
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">{t('hint')}</p>

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      {rows && rows.length === 0 && !loading && (
        <p className="rounded-md border border-dashed p-3 text-center text-[11px] text-muted-foreground">{t('empty')}</p>
      )}

      {rows && rows.length > 0 && (
        <ul className="divide-y rounded-md border">
          {rows.map((row) => (
            <li key={row.id} className="space-y-1 p-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-medium">{customerName(row)}</p>
                  {row.customer.email && (
                    <p dir="ltr" className="truncate text-start text-[11px] text-muted-foreground">
                      {row.customer.email}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px] bg-teal-50 text-teal-700 border-teal-200">
                  {row.kind === 'FULL' ? tx('kindFull') : tx('kindReverseCharge')}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>
                  {row.vat_number && (
                    <span dir="ltr" className="me-2 font-mono text-foreground">
                      {row.vat_number}
                    </span>
                  )}
                  {new Date(row.created_at).toLocaleDateString(locale)}
                  {row.note ? ` — ${row.note}` : ''}
                </span>
                {confirmId === row.id ? (
                  <span className="flex items-center gap-1.5">
                    <Button
                      size="xs"
                      variant="destructive"
                      disabled={removingId === row.id}
                      onClick={() => handleRemove(row.id)}
                    >
                      {removingId === row.id ? <Loader2 className="animate-spin" /> : null}
                      {tx('remove')}
                    </Button>
                    <Button size="xs" variant="ghost" disabled={removingId === row.id} onClick={() => setConfirmId(null)}>
                      {tx('cancel')}
                    </Button>
                  </span>
                ) : (
                  <Button size="xs" variant="ghost" onClick={() => setConfirmId(row.id)}>
                    <X /> {tx('remove')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
