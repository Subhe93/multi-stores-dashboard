'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { isRowClickIgnored } from '@/components/common/rowClick';
import type { RecentOrder } from './overview.api';
import type { OverviewFormat } from './format';
import { DEFAULT_STATUS_BADGE, ORDER_STATUS_BADGE } from './statusColors';

/** Compact recent-orders table; the whole row opens the order (link in the first cell for keyboard). */
export function RecentOrdersTable({ orders, fmt }: { orders: RecentOrder[]; fmt: OverviewFormat }) {
  const t = useTranslations('creator');
  const to = useTranslations('creator.overview');
  const router = useRouter();
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-xs text-muted-foreground">
          <th scope="col" className="py-2 pe-3 text-start font-medium">{to('colOrder')}</th>
          <th scope="col" className="hidden py-2 pe-3 text-start font-medium sm:table-cell">{to('colDate')}</th>
          <th scope="col" className="py-2 pe-3 text-start font-medium">{to('colStatus')}</th>
          <th scope="col" className="py-2 text-end font-medium">{to('colTotal')}</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => {
          const href = `/creator/orders/${o.id}`;
          return (
            <tr
              key={o.id}
              className="cursor-pointer border-b transition last:border-0 hover:bg-zinc-50"
              onClick={(e) => {
                if (!isRowClickIgnored(e)) router.push(href);
              }}
            >
              <td className="max-w-0 py-2.5 pe-3">
                <Link href={href} className="font-medium hover:underline">
                  #{o.order_number}
                </Link>
                <p dir="auto" className="truncate text-start text-xs text-muted-foreground">
                  {o.customer_name || t('overview.guest')}
                </p>
              </td>
              <td className="hidden whitespace-nowrap py-2.5 pe-3 text-xs text-muted-foreground sm:table-cell">
                {fmt.date(o.created_at)}
              </td>
              <td className="py-2.5 pe-3">
                <span
                  className={cn(
                    'inline-flex whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
                    ORDER_STATUS_BADGE[o.status] ?? DEFAULT_STATUS_BADGE,
                  )}
                >
                  {t.has(`orderStatus.${o.status}`) ? t(`orderStatus.${o.status}`) : o.status}
                </span>
              </td>
              <td className="whitespace-nowrap py-2.5 text-end font-medium tabular-nums">
                <bdi>{fmt.money(o.total, o.currency)}</bdi>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
