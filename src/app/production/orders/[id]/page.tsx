'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, StickyNote, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProductionChecklist } from '@/components/production/ProductionChecklist';
import { ProductionRouteGuard } from '@/components/production/ProductionRouteGuard';
import type { ProductionWorkspace } from '@/components/production/production.api';

/**
 * Full-screen production workspace of one order (M4.3 §5.6): a mobile-first
 * workshop view without the creator sidebar. Big tap targets, the order's
 * notes and shipping method on top, then the checklist per line.
 */
export default function ProductionWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  return <ProductionRouteGuard>{(token) => <Workspace orderId={id} token={token} />}</ProductionRouteGuard>;
}

function Workspace({ orderId, token }: { orderId: string; token: string }) {
  const t = useTranslations('creator.production');
  const tc = useTranslations('creator');
  const locale = useLocale();
  const [ws, setWs] = useState<ProductionWorkspace | null>(null);
  const status = ws?.order.status;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            href={`/creator/orders/${orderId}`}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
            aria-label={t('backToOrder')}
            title={t('backToOrder')}
          >
            <ArrowLeft className="size-5 rtl:rotate-180" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-base font-semibold">{ws?.order.order_number ?? '…'}</p>
            <p className="truncate text-xs text-muted-foreground">
              {ws?.order.customer_name || '—'}
              {ws?.order.created_at ? ` · ${new Date(ws.order.created_at).toLocaleDateString(locale)}` : ''}
            </p>
          </div>
          {status && (
            <Badge variant="outline" className="shrink-0 text-xs font-semibold">
              {tc.has(`orderStatus.${status}`) ? tc(`orderStatus.${status}`) : status}
            </Badge>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 px-4 py-4">
        {ws && (ws.order.notes || ws.order.shipping_method_name) && (
          <div className="space-y-1.5 rounded-xl border bg-white p-3 text-sm">
            {ws.order.shipping_method_name && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Truck className="size-4 shrink-0" />
                {ws.order.shipping_method_name}
              </p>
            )}
            {ws.order.notes && (
              <p className="flex items-start gap-2 whitespace-pre-line">
                <StickyNote className="mt-0.5 size-4 shrink-0 text-amber-600" />
                {ws.order.notes}
              </p>
            )}
          </div>
        )}
        <ProductionChecklist
          orderId={orderId}
          token={token}
          mode="workspace"
          onLoaded={setWs}
          onOrderStatusChanged={(s) => setWs((prev) => (prev ? { ...prev, order: { ...prev.order, status: s } } : prev))}
        />
      </main>
    </div>
  );
}
