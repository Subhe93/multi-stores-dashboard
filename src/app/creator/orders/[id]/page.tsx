'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ArrowLeft, Clock, Package, Info, Tag } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';

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

type Translator = ReturnType<typeof useTranslations>;

function statusLabels(t: Translator): Record<string, string> {
  return {
    PENDING: t('orderStatus.PENDING'),
    CONFIRMED: t('orderStatus.CONFIRMED'),
    PROCESSING: t('orderStatus.PROCESSING'),
    MANUFACTURING: t('orderStatus.MANUFACTURING'),
    QUALITY_CHECK: t('orderStatus.QUALITY_CHECK'),
    SHIPPED: t('orderStatus.SHIPPED'),
    DELIVERED: t('orderStatus.DELIVERED'),
    RETURNED: t('orderStatus.RETURNED'),
    CANCELLED: t('orderStatus.CANCELLED'),
    REFUNDED: t('orderStatus.REFUNDED'),
  };
}

// Order lifecycle flow; QUALITY_CHECK is an optional middle step.
const STATUS_FLOW = ['PENDING', 'CONFIRMED', 'PROCESSING', 'MANUFACTURING', 'QUALITY_CHECK', 'SHIPPED', 'DELIVERED'];

// FulfillmentStatus is a smaller enum (no CONFIRMED/QC). Map onto STATUS_FLOW for comparison.
const FULFILLMENT_TO_FLOW: Record<string, string> = {
  PENDING:       'PENDING',
  PROCESSING:    'PROCESSING',
  MANUFACTURING: 'MANUFACTURING',
  SHIPPED:       'SHIPPED',
  DELIVERED:     'DELIVERED',
};

// If the order has progressed past the item's recorded fulfillment_status (legacy orders
// from before the API cascade fix), display the order status so the badge isn't stale.
function effectiveItemStatus(orderStatus: string, itemStatus?: string | null): string {
  if (['CANCELLED', 'REFUNDED', 'RETURNED'].includes(orderStatus)) return orderStatus;
  if (!itemStatus) return orderStatus;
  const orderIdx = STATUS_FLOW.indexOf(orderStatus);
  const mapped = FULFILLMENT_TO_FLOW[itemStatus] ?? itemStatus;
  const itemIdx = STATUS_FLOW.indexOf(mapped);
  if (orderIdx === -1 || itemIdx === -1) return itemStatus;
  return orderIdx > itemIdx ? orderStatus : itemStatus;
}

function statusOptions(t: Translator) {
  return [
    { value: 'CONFIRMED', label: t('orderStatus.CONFIRMED') },
    { value: 'PROCESSING', label: t('orderStatus.PROCESSING') },
    { value: 'MANUFACTURING', label: t('orderStatus.MANUFACTURING') },
    { value: 'SHIPPED', label: t('orderStatus.SHIPPED') },
    { value: 'DELIVERED', label: t('orderStatus.DELIVERED') },
    { value: 'CANCELLED', label: t('orderStatus.CANCELLED') },
  ];
}

export default function CreatorOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const router = useRouter();
  const { fmt } = useCurrency();
  const t = useTranslations('creator');
  const tp = useTranslations('payments');
  const STATUS_LABELS = statusLabels(t);
  const STATUS_OPTIONS = statusOptions(t);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [nextStatus, setNextStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [primaryLocale, setPrimaryLocale] = useState('en');

  useEffect(() => {
    if (!token) return;
    api<{ primary_locale: string }>('/translations/overview', { token })
      .then((res) => setPrimaryLocale(res?.primary_locale || 'en'))
      .catch(() => {});
  }, [token]);

  const fetchOrder = () => {
    if (!token || !id) return;
    api<any>(`/orders/${id}`, { token })
      .then((data) => {
        setOrder(data);
        setNextStatus('');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrder();
  }, [token, id]);

  const handleStatusUpdate = async () => {
    if (!token || !nextStatus) return;
    setUpdatingStatus(true);
    try {
      await api(`/orders/${id}/status`, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          status: nextStatus,
          ...(statusNotes.trim() ? { notes: statusNotes } : {}),
        }),
      });
      setStatusNotes('');
      fetchOrder();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <p className="text-center py-12 text-muted-foreground text-sm">{t('orderDetail.notFound')}</p>
    );
  }

  // Earnings: sum creator_amount from commission entries
  const totalEarnings = Array.isArray(order.commission)
    ? order.commission.reduce(
        (acc: number, c: any) => acc + Number(c.creator_amount ?? 0),
        0,
      )
    : Number(order.commission?.creator_amount ?? 0);

  // A creator can advance the order when they fulfill ANY of its items — the
  // status update applies only to their own items, and the overall order status
  // is re-derived (slowest item wins). Provider items are advanced by the provider.
  const creatorId = user?.creator?.id as string | undefined;
  const items = (order.items ?? []) as Array<{ fulfiller_type?: string; fulfiller_id?: string }>;
  const canUpdateStatus =
    !!creatorId &&
    items.some((it) => it.fulfiller_type === 'CREATOR' && it.fulfiller_id === creatorId);
  const hasProviderItems = items.some((it) => it.fulfiller_type === 'PROVIDER');

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight font-mono">
              {order.order_number}
            </h1>
            <p className="text-sm text-muted-foreground">
              {order.created_at ? new Date(order.created_at).toLocaleString() : '—'}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={`text-xs font-semibold ${statusColors[order.status] ?? ''}`}
        >
          {STATUS_LABELS[order.status] || order.status}
        </Badge>
      </div>

      {/* 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column (main) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Order items */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t('orderDetail.orderItems')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {order.items?.length > 0 ? (
                  order.items.map((item: any) => {
                    // Title chain: custom product's own title → custom product's
                    // base product title → direct product → variant's product
                    // (when the order item references only a variant) → fallback.
                    const title =
                      item.custom_product?.translations?.find((t: any) => t.locale === 'en')?.title ??
                      item.custom_product?.translations?.[0]?.title ??
                      item.custom_product?.product?.translations?.find((t: any) => t.locale === 'en')?.title ??
                      item.custom_product?.product?.translations?.[0]?.title ??
                      item.product?.translations?.find((t: any) => t.locale === 'en')?.title ??
                      item.product?.translations?.[0]?.title ??
                      item.variant?.product?.translations?.find((t: any) => t.locale === 'en')?.title ??
                      item.variant?.product?.translations?.[0]?.title ??
                      '—';

                    // Image: custom product mockup → base product → variant's product.
                    const imgUrl =
                      item.custom_product?.mockup_images?.[0]?.url ??
                      item.custom_product?.product?.images?.[0]?.url ??
                      item.product?.images?.[0]?.url ??
                      item.variant?.product?.images?.[0]?.url;

                    // Variant options
                    const variantOpts = item.variant?.options as Record<string, string> | undefined;
                    const variantLabel = variantOpts
                      ? Object.entries(variantOpts).map(([k, v]) => `${k}: ${v}`).join(' · ')
                      : null;

                    // Custom field values
                    const fieldValues: { label: string; value: string }[] = [];
                    if (item.custom_field_values?.length) {
                      for (const fv of item.custom_field_values) {
                        const label =
                          fv.custom_field?.translations?.find((t: any) => t.locale === 'en')?.label ??
                          fv.custom_field?.translations?.[0]?.label ??
                          fv.custom_field?.name ?? '—';
                        fieldValues.push({
                          label,
                          value: fv.value || (fv.file_url ? t('orderDetail.fileUploaded') : '—'),
                        });
                      }
                    }

                    const bundleOffer = item.bundle_offer ?? null;
                    const bundleTr =
                      bundleOffer?.translations?.find((tr: any) => tr.locale === primaryLocale) ??
                      bundleOffer?.translations?.[0];
                    const bundleNameTr =
                      bundleOffer?.bundle?.translations?.find((tr: any) => tr.locale === primaryLocale) ??
                      bundleOffer?.bundle?.translations?.[0];
                    const unitPrice = Number(item.unit_price ?? 0);
                    const originalUnitPrice =
                      item.original_unit_price != null ? Number(item.original_unit_price) : null;
                    const lineTotal = Number(item.total_price ?? unitPrice * item.quantity);
                    const originalLineTotal =
                      originalUnitPrice !== null ? originalUnitPrice * item.quantity : null;

                    return (
                      <div key={item.id} className="py-3 space-y-2">
                        <div className="flex items-start gap-3">
                          {/* Image */}
                          {imgUrl ? (
                            <img src={resolveUrl(imgUrl)} alt={title} className="w-14 h-14 rounded-lg object-cover border shrink-0" />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium leading-snug">{title}</p>
                              {(() => {
                                const itemStatus = effectiveItemStatus(order.status, item.fulfillment_status);
                                return (
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] font-semibold shrink-0 ${
                                      statusColors[itemStatus] ?? 'bg-zinc-100 text-zinc-600'
                                    }`}
                                  >
                                    {STATUS_LABELS[itemStatus] || itemStatus}
                                  </Badge>
                                );
                              })()}
                            </div>

                            {/* Variant */}
                            {variantLabel && (
                              <p className="text-xs text-muted-foreground mt-0.5">{variantLabel}</p>
                            )}

                            {/* Bundle badge */}
                            {bundleOffer && (
                              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                <Tag className="w-3 h-3" />
                                <span>
                                  {bundleNameTr?.name ? `${bundleNameTr.name} · ` : ''}
                                  {bundleTr?.title || t('orderDetail.buyQuantity', { count: bundleOffer.quantity })}
                                  {bundleTr?.label ? ` · ${bundleTr.label}` : ''}
                                </span>
                              </div>
                            )}

                            {/* Qty & Price */}
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>{t('orderDetail.qty', { count: item.quantity })}</span>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                {t('orderDetail.each', { price: fmt(unitPrice) })}
                                {originalUnitPrice !== null && originalUnitPrice > unitPrice && (
                                  <span className="line-through text-muted-foreground/70 tabular-nums">
                                    {fmt(originalUnitPrice)}
                                  </span>
                                )}
                              </span>
                              <span className="ml-auto flex flex-col items-end">
                                <span className="font-semibold text-foreground text-sm">
                                  {fmt(lineTotal)}
                                </span>
                                {originalLineTotal !== null && originalLineTotal > lineTotal && (
                                  <span className="text-[10px] line-through text-muted-foreground/70 tabular-nums">
                                    {fmt(originalLineTotal)}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Custom field values */}
                        {fieldValues.length > 0 && (
                          <div className="ml-17 pl-3 border-l-2 border-muted space-y-0.5">
                            {fieldValues.map((fv, i) => (
                              <p key={i} className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">{fv.label}:</span>{' '}{fv.value}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Design notes */}
                        {item.design_notes && (
                          <p className="ml-17 text-xs text-muted-foreground italic">{t('orderDetail.note')}: {item.design_notes}</p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-8">{t('orderDetail.noItems')}</p>
                )}
              </div>
              <Separator className="my-3" />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t('orderDetail.subtotal')}</span>
                  <span>{fmt(Number(order.subtotal ?? order.total))}</span>
                </div>
                {Number(order.shipping_cost ?? 0) > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t('orderDetail.shipping')}</span>
                    <span>{fmt(Number(order.shipping_cost))}</span>
                  </div>
                )}
                {Number(order.discount_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>{t('orderDetail.discount')}</span>
                    <span>-{fmt(Number(order.discount_amount))}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold text-base pt-1">
                  <span>{t('orderDetail.total')}</span>
                  <span>{fmt(Number(order.total))}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t('orderDetail.timeline')}</CardTitle>
            </CardHeader>
            <CardContent>
              {order.timeline?.length > 0 ? (
                <div className="space-y-3">
                  {order.timeline.map((entry: any, idx: number) => (
                    <div key={entry.id ?? idx} className="flex items-start gap-3">
                      <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{STATUS_LABELS[entry.status] || entry.status}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {entry.created_at
                            ? new Date(entry.created_at).toLocaleString()
                            : '—'}
                          {entry.note ? ` — ${entry.note}` : ''}
                          {entry.notes ? ` — ${entry.notes}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Fallback: show created_at as the first event
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t('orderDetail.orderCreated')}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {order.created_at ? new Date(order.created_at).toLocaleString() : '—'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column (sidebar) */}
        <div className="space-y-4">
          {/* Status — editable only when the order is entirely creator-fulfilled */}
          {canUpdateStatus ? (
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{t('orderDetail.updateStatus')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold ${statusColors[order.status] ?? ''}`}
                >
                  {order.status}
                </Badge>
                <SearchableSelect
                  options={STATUS_OPTIONS}
                  value={nextStatus}
                  onChange={setNextStatus}
                  placeholder={t('orderDetail.selectNewStatus')}
                  searchPlaceholder={t('orderDetail.searchStatuses')}
                />
                <input
                  type="text"
                  placeholder={t('orderDetail.notesOptional')}
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  className="w-full h-8 px-3 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleStatusUpdate}
                  disabled={!nextStatus || updatingStatus}
                >
                  {updatingStatus ? t('orderDetail.updating') : t('orderDetail.updateStatus')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-none border-blue-100 bg-blue-50/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600" />
                  {t('orderDetail.orderStatus')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold ${statusColors[order.status] ?? ''}`}
                >
                  {order.status}
                </Badge>
                <p className="text-xs text-blue-700 leading-relaxed">
                  {hasProviderItems
                    ? t('orderDetail.providerFulfilledNotice')
                    : t('orderDetail.notFulfilledNotice')}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Customer */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t('orderDetail.customer')}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <p className="font-medium">
                {order.customer?.first_name} {order.customer?.last_name}
              </p>
              <p className="text-muted-foreground">{order.customer?.email ?? '—'}</p>
            </CardContent>
          </Card>

          {/* Address */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t('orderDetail.shippingAddress')}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-0.5">
              {order.address ? (
                <>
                  <p>{order.address.street ?? order.address.line1 ?? '—'}</p>
                  {(order.address.line2 || order.address.apartment) && (
                    <p>{order.address.line2 ?? order.address.apartment}</p>
                  )}
                  <p>
                    {order.address.city}
                    {order.address.zip || order.address.postal_code
                      ? `, ${order.address.zip ?? order.address.postal_code}`
                      : ''}
                  </p>
                  <p>{order.address.country ?? order.address.country_code ?? '—'}</p>
                </>
              ) : (
                <p className="text-muted-foreground">{t('orderDetail.noAddress')}</p>
              )}
            </CardContent>
          </Card>

          {/* Commission / Earnings */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t('orderDetail.yourEarnings')}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs">
              <p className="text-2xl font-semibold text-emerald-700">
                {fmt(totalEarnings)}
              </p>
              <p className="text-muted-foreground mt-1">
                {t('orderDetail.creatorCommission')}
              </p>
              {(() => {
                const myPayout = Array.isArray(order.payouts) ? order.payouts[0] : null;
                return (
                  <div className="mt-3 space-y-1 border-t pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{tp('yourPayout')}</span>
                      {myPayout ? (
                        <Badge variant="outline" className={`text-[9px] ${myPayout.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {myPayout.status === 'paid' ? tp('statusPaid') : tp('statusFailed')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] bg-zinc-100 text-zinc-600 border-zinc-200">
                          {order.payment_status === 'paid' ? tp('statusPending') : tp('statusAwaiting')}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
