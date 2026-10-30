'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { useBulkAction } from '@/components/common/useBulkAction';
import { api } from '@/lib/api';
import { datedCsvFilename, downloadCsv } from '@/lib/csv';
import { useCurrency } from '@/lib/useCurrency';

/** Fields of a GET /orders row the bulk actions and the CSV export read. */
export interface BulkOrderRow {
  id: string;
  order_number: string;
  status: string;
  total: number | string;
  created_at?: string | null;
  currency?: string | null;
  payment_status?: string | null;
  market?: { currency?: string | null } | null;
  email?: string | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    user?: { email?: string | null } | null;
  } | null;
  items?: unknown[] | null;
}

/** Forward order lifecycle, as on the order detail pages. */
export const ORDER_STATUS_FLOW = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'MANUFACTURING',
  'QUALITY_CHECK',
  'SHIPPED',
  'DELIVERED',
];

/** Statuses after which no forward status change is offered. */
export const ORDER_TERMINAL_STATUSES = ['DELIVERED', 'CANCELLED', 'REFUNDED', 'RETURNED'];

interface OwnedItem {
  fulfiller_type?: string | null;
  fulfiller_id?: string | null;
  fulfillment_status?: string | null;
}

/**
 * Flow index of the slowest item the fulfiller owns in this order (an item
 * never counts as behind the order header, as on the detail pages), or null
 * when the fulfiller owns no item. A fulfiller's status update moves only
 * their own items, so a target is a forward step only past this index.
 */
export function ownItemsProgress(
  row: { status: string; items?: unknown[] | null },
  fulfillerType: 'CREATOR' | 'PROVIDER',
  fulfillerId: string | undefined,
): number | null {
  if (!fulfillerId) return null;
  const owned = ((row.items ?? []) as OwnedItem[]).filter(
    (it) => it.fulfiller_type === fulfillerType && it.fulfiller_id === fulfillerId,
  );
  if (owned.length === 0) return null;
  const headerIdx = ORDER_STATUS_FLOW.indexOf(row.status);
  return Math.min(
    ...owned.map((it) =>
      Math.max(headerIdx, ORDER_STATUS_FLOW.indexOf(it.fulfillment_status ?? 'PENDING')),
    ),
  );
}

export interface OrderStatusTarget {
  value: string;
  label: string;
  /** Shown in red; always asks for confirmation (e.g. cancel). */
  destructive?: boolean;
}

// Targets with customer-facing or payment side effects (status emails,
// Kustom capture on shipment, invoices) are confirmed before running.
const CONFIRM_TARGETS = ['SHIPPED', 'DELIVERED', 'CANCELLED'];

interface OrderBulkActionsProps<T extends BulkOrderRow> {
  rows: T[];
  clear: () => void;
  bulk: ReturnType<typeof useBulkAction>;
  token: string | null | undefined;
  targets: OrderStatusTarget[];
  /** Whether this row may move to `target` from its current state. */
  canApply: (row: T, target: string) => boolean;
  /** Timeline note sent with the update (mirrors the role's detail page). */
  note?: (target: string) => string | undefined;
  /** Localized order status label (CSV export). */
  statusLabel: (status: string) => string;
  /** Refreshes the list after a bulk run. */
  after: () => void;
  /** Extra hint rendered at the bottom of the status menu. */
  menuHint?: ReactNode;
}

/**
 * Bulk bar for the order lists: "Change status" menu (one PUT
 * /orders/:id/status per order, sequential because each update may send an
 * email) and a CSV export of the selected rows.
 */
export function OrderBulkActions<T extends BulkOrderRow>({
  rows,
  clear,
  bulk,
  token,
  targets,
  canApply,
  note,
  statusLabel,
  after,
  menuHint,
}: OrderBulkActionsProps<T>) {
  const tb = useTranslations('bulk');
  const tp = useTranslations('payments');
  const { currency: storeCurrency } = useCurrency();

  const changeStatus = (target: OrderStatusTarget) => {
    const eligible = rows.filter((r) => canApply(r, target.value));
    const skipped = rows.length - eligible.length;
    if (eligible.length === 0) return;
    const body = (value: string) => {
      const n = note?.(value);
      return JSON.stringify({ status: value, ...(n ? { note: n } : {}) });
    };
    const opts = {
      rows: eligible,
      fn: (r: T) =>
        api(`/orders/${r.id}/status`, { method: 'PUT', token: token ?? undefined, body: body(target.value) }),
      done: (count: number) =>
        skipped > 0
          ? `${tb('updatedCount', { count })} · ${tb('skippedCount', { count: skipped })}`
          : tb('updatedCount', { count }),
      clear,
      after,
      concurrency: 1,
    };
    if (!target.destructive && !CONFIRM_TARGETS.includes(target.value)) {
      void bulk.run(opts);
      return;
    }
    const warning =
      target.value === 'SHIPPED'
        ? tb('ordersShippedWarning')
        : target.value === 'DELIVERED'
          ? tb('ordersDeliveredWarning')
          : target.value === 'CANCELLED'
            ? tb('ordersCancelWarning')
            : null;
    bulk.ask({
      ...opts,
      title: target.destructive
        ? tb('ordersCancelTitle', { count: eligible.length })
        : tb('ordersStatusTitle', { count: eligible.length, status: target.label }),
      description: (
        <>
          {warning}
          {skipped > 0 && (
            <span className="mt-2 block">{tb('ordersSkippedNote', { count: skipped })}</span>
          )}
        </>
      ),
      confirmLabel: target.destructive ? tb('cancelOrders') : tb('changeStatus'),
      destructive: target.destructive,
    });
  };

  const paymentLabel = (s: string | null | undefined) => {
    switch (s) {
      case 'paid': return tp('statusPaid');
      case 'refunded': return tp('statusRefunded');
      case 'failed': return tp('statusFailed');
      case 'pending': return tp('statusPending');
      case null:
      case undefined:
      case '': return '';
      default: return s;
    }
  };

  const exportCsv = () => {
    const emailOf = (r: T) => r.customer?.email ?? r.customer?.user?.email ?? r.email ?? '';
    const withEmail = rows.some((r) => !!emailOf(r));
    const withPayment = rows.some((r) => !!r.payment_status);
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateOf = (iso?: string | null) => {
      if (!iso) return '';
      const d = new Date(iso);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const header = [
      tb('csv.order'),
      tb('csv.date'),
      tb('csv.customer'),
      ...(withEmail ? [tb('csv.email')] : []),
      tb('csv.status'),
      ...(withPayment ? [tb('csv.payment')] : []),
      tb('csv.total'),
      tb('csv.currency'),
      tb('csv.items'),
    ];
    const body = rows.map((r) => [
      r.order_number,
      dateOf(r.created_at),
      r.customer ? `${r.customer.first_name ?? ''} ${r.customer.last_name ?? ''}`.trim() : '',
      ...(withEmail ? [emailOf(r)] : []),
      statusLabel(r.status),
      ...(withPayment ? [paymentLabel(r.payment_status)] : []),
      Number(r.total ?? 0),
      r.market?.currency ?? r.currency ?? storeCurrency ?? '',
      r.items?.length ?? 0,
    ]);
    downloadCsv(datedCsvFilename('orders'), [header, ...body]);
  };

  const regular = targets.filter((tg) => !tg.destructive);
  const destructive = targets.filter((tg) => tg.destructive);
  const countFor = (value: string) => rows.filter((r) => canApply(r, value)).length;

  return (
    <>
      {targets.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={bulk.busy}
            className="inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {bulk.busy ? tb('working') : tb('changeStatus')}
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-52">
            {regular.map((tg) => {
              const count = countFor(tg.value);
              return (
                <DropdownMenuItem key={tg.value} disabled={count === 0} onClick={() => changeStatus(tg)}>
                  <span className="flex-1">{tg.label}</span>
                  <span className="ms-4 text-xs text-muted-foreground tabular-nums">{count}</span>
                </DropdownMenuItem>
              );
            })}
            {destructive.length > 0 && <DropdownMenuSeparator />}
            {destructive.map((tg) => {
              const count = countFor(tg.value);
              return (
                <DropdownMenuItem
                  key={tg.value}
                  variant="destructive"
                  disabled={count === 0}
                  onClick={() => changeStatus(tg)}
                >
                  <span className="flex-1">{tg.label}</span>
                  <span className="ms-4 text-xs tabular-nums">{count}</span>
                </DropdownMenuItem>
              );
            })}
            {menuHint && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="max-w-60 font-normal">{menuHint}</DropdownMenuLabel>
                </DropdownMenuGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Button variant="outline" size="sm" className="h-7 text-xs" disabled={bulk.busy} onClick={exportCsv}>
        <Download className="size-3.5" />
        {tb('exportCsvCount', { count: rows.length })}
      </Button>
    </>
  );
}
