'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { customerDefaultsDiffer, isCompanyOrder, type CustomerB2bDefaults, type OrderB2bSnapshot } from '@/lib/b2b';

interface OrderCompanyLinesProps {
  // The order's own snapshot (what the purchase was legally made under).
  order: OrderB2bSnapshot;
  // Customer account defaults; shown muted when they differ from the snapshot.
  customer?: CustomerB2bDefaults | null;
}

/**
 * Company block for an order detail Customer card (b2b app). Renders nothing
 * for person orders, so pages without the app look exactly as before.
 */
export function OrderCompanyLines({ order, customer }: OrderCompanyLinesProps) {
  const t = useTranslations('creator.orderDetail');
  if (!isCompanyOrder(order)) return null;
  const rows: Array<{ key: string; label: string; value: string | null | undefined }> = [
    { key: 'org', label: t('orgNumber'), value: order.org_number },
    { key: 'vat', label: t('vatNumber'), value: order.vat_number },
    { key: 'ref', label: t('reference'), value: order.buyer_reference },
  ];
  const defaults = customerDefaultsDiffer(order, customer)
    ? [customer?.company_name, customer?.org_number, customer?.vat_number].filter(Boolean).join(' · ')
    : '';
  return (
    <div className="space-y-1 border-t pt-2 mt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px] font-medium bg-violet-50 text-violet-700 border-violet-200">
          {t('company')}
        </Badge>
        {order.company_name && <span className="font-medium">{order.company_name}</span>}
      </div>
      {rows
        .filter((row) => !!row.value)
        .map((row) => (
          <p key={row.key} className="flex justify-between gap-3">
            <span className="text-muted-foreground">{row.label}</span>
            <span dir="ltr" className="font-mono">{row.value}</span>
          </p>
        ))}
      {defaults && (
        <p className="text-[11px] text-muted-foreground">
          {t('customerDefaults')}: {defaults}
        </p>
      )}
    </div>
  );
}
