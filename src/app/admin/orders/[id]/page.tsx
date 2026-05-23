'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Clock, Package, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';
import Link from 'next/link';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '');
function resolveUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  MANUFACTURING: 'bg-purple-50 text-purple-700 border-purple-200',
  QUALITY_CHECK: 'bg-orange-50 text-orange-700 border-orange-200',
  SHIPPED: 'bg-sky-50 text-sky-700 border-sky-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RETURNED: 'bg-rose-50 text-rose-700 border-rose-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  REFUNDED: 'bg-zinc-100 text-zinc-700 border-zinc-200',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  MANUFACTURING: 'Manufacturing',
  QUALITY_CHECK: 'Quality Check',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  RETURNED: 'Returned',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

const statusFlow = ['PENDING', 'CONFIRMED', 'PROCESSING', 'MANUFACTURING', 'QUALITY_CHECK', 'SHIPPED', 'DELIVERED'];

// FulfillmentStatus is a smaller enum; map onto statusFlow so we can compare progress.
const FULFILLMENT_TO_FLOW: Record<string, string> = {
  PENDING:       'PENDING',
  PROCESSING:    'PROCESSING',
  MANUFACTURING: 'MANUFACTURING',
  SHIPPED:       'SHIPPED',
  DELIVERED:     'DELIVERED',
};

// If the order has advanced past the item's recorded fulfillment_status (legacy orders
// from before the API cascade fix), display the order status instead.
function effectiveItemStatus(orderStatus: string, itemStatus?: string | null): string {
  if (['CANCELLED', 'REFUNDED', 'RETURNED'].includes(orderStatus)) return orderStatus;
  if (!itemStatus) return orderStatus;
  const orderIdx = statusFlow.indexOf(orderStatus);
  const mapped = FULFILLMENT_TO_FLOW[itemStatus] ?? itemStatus;
  const itemIdx = statusFlow.indexOf(mapped);
  if (orderIdx === -1 || itemIdx === -1) return itemStatus;
  return orderIdx > itemIdx ? orderStatus : itemStatus;
}

// Map a backend payment_status string to a localized label + badge style.
function paymentStatusInfo(
  status: string | null | undefined,
  tp: (k: string) => string,
): { label: string; cls: string } {
  switch (status) {
    case 'paid':
      return { label: tp('statusPaid'), cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'failed':
      return { label: tp('statusFailed'), cls: 'bg-red-50 text-red-700 border-red-200' };
    case 'awaiting_payment':
      return { label: tp('statusAwaiting'), cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    default:
      return { label: tp('statusPending'), cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' };
  }
}

export default function OrderDetailPage() {
  const t = useTranslations('admin');
  const tp = useTranslations('payments');
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { fmt } = useCurrency();

  const statusLabel = (status: string) =>
    STATUS_LABELS[status] ? t(`orderStatus_${status}` as any) : status;
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrder = () => {
    if (!token || !id) return;
    api<any>(`/orders/${id}`, { token })
      .then(setOrder)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrder(); }, [token, id]);

  const [verifying, setVerifying] = useState(false);
  const handleVerifyPayment = async () => {
    if (!token || verifying) return;
    setVerifying(true);
    try {
      await api(`/payments/admin/orders/${id}/reconcile`, { method: 'POST', token });
      fetchOrder();
    } catch (err) {
      console.error(err);
    } finally {
      setVerifying(false);
    }
  };

  const handleStatusUpdate = async (status: string) => {
    if (!token) return;
    await api(`/orders/${id}/status`, {
      method: 'PUT', token,
      body: JSON.stringify({ status, note: `Status changed to ${status} by admin` }),
    });
    fetchOrder();
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!order) return <p className="text-center py-12 text-muted-foreground">{t('orderNotFound')}</p>;

  const currentIdx = statusFlow.indexOf(order.status);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/orders" className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight font-mono">{order.order_number}</h1>
            <p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
          </div>
        </div>
        <Badge variant="outline" className={`text-xs font-semibold ${statusColors[order.status] || ''}`}>{statusLabel(order.status)}</Badge>
      </div>

      {/* Status actions */}
      {!['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(order.status) && (
        <Card className="shadow-none">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('updateStatus')}</CardTitle></CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            {statusFlow.slice(currentIdx + 1).map(s => (
              <Button key={s} variant="outline" size="sm" className="text-xs" onClick={() => handleStatusUpdate(s)}>{statusLabel(s)}</Button>
            ))}
            <Separator orientation="vertical" className="h-7" />
            <Button variant="outline" size="sm" className="text-xs text-red-600" onClick={() => handleStatusUpdate('CANCELLED')}>{t('cancel')}</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Order Summary */}
        <Card className="shadow-none col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('items')}</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {order.items?.map((item: any) => {
                const title =
                  item.custom_product?.translations?.find((t: any) => t.locale === 'en')?.title ??
                  item.custom_product?.translations?.[0]?.title ??
                  item.product?.translations?.find((t: any) => t.locale === 'en')?.title ??
                  item.product?.translations?.[0]?.title ?? '—';
                const imgUrl =
                  item.custom_product?.mockup_images?.[0]?.url ??
                  item.custom_product?.product?.images?.[0]?.url ??
                  item.product?.images?.[0]?.url;
                const variantOpts = item.variant?.options as Record<string, string> | undefined;
                const variantLabel = variantOpts
                  ? Object.entries(variantOpts).map(([k, v]) => `${k}: ${v}`).join(' · ')
                  : null;
                const textFields = (item.custom_field_values || []).filter((fv: any) => !fv.file_url && fv.value);
                const fileFields = (item.custom_field_values || []).filter((fv: any) => fv.file_url);

                return (
                  <div key={item.id} className="py-3 space-y-2">
                    <div className="flex items-start gap-3">
                      {imgUrl ? (
                        <img src={resolveUrl(imgUrl)} alt={title} className="w-14 h-14 rounded-lg object-cover border shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-snug">{title}</p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {(() => {
                              const itemStatus = effectiveItemStatus(order.status, item.fulfillment_status);
                              return (
                                <Badge variant="outline" className={`text-[10px] font-semibold ${statusColors[itemStatus] || 'bg-zinc-100 text-zinc-600'}`}>
                                  {statusLabel(itemStatus)}
                                </Badge>
                              );
                            })()}
                            <Badge variant="outline" className="text-[9px]">{item.fulfiller_type}</Badge>
                          </div>
                        </div>
                        {variantLabel && <p className="text-xs text-muted-foreground mt-0.5">{variantLabel}</p>}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{t('qtyLabel', { qty: item.quantity })}</span>
                          <span>·</span>
                          <span>{t('eachPrice', { price: fmt(Number(item.unit_price)) })}</span>
                          <span className="ml-auto font-semibold text-foreground text-sm">
                            {fmt(Number(item.total_price))}
                          </span>
                        </div>
                      </div>
                    </div>

                    {textFields.length > 0 && (
                      <div className="ml-17 pl-3 border-l-2 border-muted space-y-0.5">
                        {textFields.map((fv: any) => (
                          <p key={fv.id} className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {fv.custom_field?.translations?.[0]?.label || fv.custom_field_id}:
                            </span>{' '}{fv.value}
                          </p>
                        ))}
                      </div>
                    )}

                    {fileFields.length > 0 && (
                      <div className="ml-17 flex flex-wrap gap-2">
                        {fileFields.map((fv: any) => (
                          <a key={fv.id} href={fv.file_url} target="_blank" rel="noreferrer"
                            className="block w-12 h-12 rounded border overflow-hidden bg-zinc-50 hover:opacity-80 transition"
                            title={fv.custom_field?.translations?.[0]?.label || t('file')}>
                            <img src={fv.file_url} alt="" className="w-full h-full object-contain p-0.5" />
                          </a>
                        ))}
                      </div>
                    )}

                    {item.design_notes && (
                      <p className="ml-17 text-xs text-muted-foreground italic">{t('noteLabel', { note: item.design_notes })}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <Separator className="my-3" />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t('subtotal')}</span><span>{fmt(Number(order.subtotal))}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t('shipping')}</span><span>{fmt(Number(order.shipping_cost))}</span></div>
              {Number(order.discount_amount) > 0 && <div className="flex justify-between text-xs text-emerald-600"><span>{t('discount')}</span><span>-{fmt(Number(order.discount_amount))}</span></div>}
              <Separator />
              <div className="flex justify-between font-semibold"><span>{t('total')}</span><span>{fmt(Number(order.total))}</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Side info */}
        <div className="space-y-4">
          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('customer')}</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-1">
              <p className="font-medium">{order.customer?.first_name} {order.customer?.last_name}</p>
              <p className="text-muted-foreground">{order.customer?.phone || '—'}</p>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('shippingAddress')}</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-0.5">
              <p className="font-medium">{order.address?.full_name}</p>
              <p>{order.address?.line1}</p>
              {order.address?.line2 && <p>{order.address.line2}</p>}
              <p>{order.address?.city}, {order.address?.postal_code}</p>
              <p>{order.address?.country_code}</p>
            </CardContent>
          </Card>

          {order.commission && (
            <Card className="shadow-none">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('commissionSplit')}</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">{t('provider')}</span><span>{fmt(Number(order.commission.provider_amount))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('platform')}</span><span className="font-medium">{fmt(Number(order.commission.platform_amount))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('creator')}</span><span>{fmt(Number(order.commission.creator_amount))}</span></div>
              </CardContent>
            </Card>
          )}

          {/* Payment details */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">{tp('payment')}</CardTitle>
                {(() => {
                  const info = paymentStatusInfo(order.payment_status, tp);
                  return <Badge variant="outline" className={`text-[10px] font-semibold ${info.cls}`}>{info.label}</Badge>;
                })()}
              </div>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">{tp('payment')}</span><span className="uppercase">{order.payment_method}</span></div>
              {order.card_brand && (
                <div className="flex justify-between"><span className="text-muted-foreground">{tp('card')}</span><span className="capitalize">{order.card_brand} •••• {order.card_last4}</span></div>
              )}
              {order.paid_at && (
                <div className="flex justify-between"><span className="text-muted-foreground">{tp('paidAt')}</span><span>{new Date(order.paid_at).toLocaleString()}</span></div>
              )}
              {order.payment_failure_message && (
                <div className="text-red-600">{tp('failureReason')}: {order.payment_failure_message}</div>
              )}
              {order.receipt_url && (
                <a href={order.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline pt-1">
                  {tp('viewReceipt')} <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {order.payment_method === 'STRIPE' &&
                (order.payment_status !== 'paid' ||
                  order.payouts?.some((p: any) => p.status !== 'paid')) && (
                  <Button variant="outline" size="sm" className="w-full mt-2 text-xs" onClick={handleVerifyPayment} disabled={verifying}>
                    {verifying ? '…' : tp('verifyPayment')}
                  </Button>
                )}
            </CardContent>
          </Card>

          {/* Payouts ledger */}
          {order.payouts?.length > 0 && (
            <Card className="shadow-none">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{tp('payouts')}</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-2">
                {order.payouts.map((p: any) => (
                  <div key={p.id} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{p.recipient_type === 'PROVIDER' ? tp('provider') : tp('creator')}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{fmt(Number(p.amount))}</span>
                        <Badge variant="outline" className={`text-[9px] ${p.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {p.status === 'paid' ? tp('statusPaid') : tp('statusFailed')}
                        </Badge>
                      </span>
                    </div>
                    {p.status !== 'paid' && p.error && (
                      <p className="text-[10px] text-red-600 leading-snug">{p.error}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Timeline */}
      <Card className="shadow-none">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('timeline')}</CardTitle></CardHeader>
        <CardContent>
          {order.timeline?.length > 0 ? (
            <div className="space-y-3">
              {order.timeline.map((entry: any) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{statusLabel(entry.status)}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(entry.created_at).toLocaleString()}{entry.note && ` — ${entry.note}`}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('noTimelineEntries')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
