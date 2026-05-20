'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  ArrowLeft, Clock, Truck, CheckCircle2,
  XCircle, FileImage, ExternalLink, Package, Info,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';
import { countryFlag } from '@/components/common/CountryMultiSelect';
import Link from 'next/link';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '');
function resolveUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:        'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED:      'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING:     'bg-indigo-50 text-indigo-700 border-indigo-200',
  MANUFACTURING:  'bg-purple-50 text-purple-700 border-purple-200',
  QUALITY_CHECK:  'bg-orange-50 text-orange-700 border-orange-200',
  SHIPPED:        'bg-sky-50 text-sky-700 border-sky-200',
  DELIVERED:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  RETURNED:       'bg-rose-50 text-rose-700 border-rose-200',
  CANCELLED:      'bg-zinc-100 text-zinc-500 border-zinc-200',
  REFUNDED:       'bg-zinc-100 text-zinc-500 border-zinc-200',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING:        'Pending',
  CONFIRMED:      'Confirmed',
  PROCESSING:     'Processing',
  MANUFACTURING:  'Manufacturing',
  QUALITY_CHECK:  'Quality Check',
  SHIPPED:        'Shipped',
  DELIVERED:      'Delivered',
  RETURNED:       'Returned',
  CANCELLED:      'Cancelled',
  REFUNDED:       'Refunded',
};

// Standard flow — Quality Check is optional but tracked
const STATUS_FLOW = ['PENDING', 'CONFIRMED', 'PROCESSING', 'MANUFACTURING', 'QUALITY_CHECK', 'SHIPPED', 'DELIVERED'];

// Per-item FulfillmentStatus is a subset; map onto STATUS_FLOW so we can compare progress.
const FULFILLMENT_TO_FLOW: Record<string, string> = {
  PENDING:       'PENDING',
  PROCESSING:    'PROCESSING',
  MANUFACTURING: 'MANUFACTURING',
  SHIPPED:       'SHIPPED',
  DELIVERED:     'DELIVERED',
};

// If the order has already progressed past the item's recorded fulfillment_status
// (e.g. legacy orders that pre-date the cascade fix), display the order status instead
// so the badge doesn't lie. Terminal states like CANCELLED/REFUNDED/RETURNED bypass
// the flow and always win.
function effectiveItemStatus(orderStatus: string, itemStatus?: string | null): string {
  if (['CANCELLED', 'REFUNDED', 'RETURNED'].includes(orderStatus)) return orderStatus;
  if (!itemStatus) return orderStatus;
  const orderIdx = STATUS_FLOW.indexOf(orderStatus);
  const mapped = FULFILLMENT_TO_FLOW[itemStatus] ?? itemStatus;
  const itemIdx = STATUS_FLOW.indexOf(mapped);
  if (orderIdx === -1 || itemIdx === -1) return itemStatus;
  return orderIdx > itemIdx ? orderStatus : itemStatus;
}

export default function ProviderOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const { fmt } = useCurrency();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const fetchOrder = () => {
    if (!token || !id) return;
    api<any>(`/orders/${id}`, { token })
      .then(setOrder)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrder(); }, [token, id]);

  const handleStatusUpdate = async (status: string, note?: string) => {
    if (!token) return;
    setUpdating(true);
    try {
      await api(`/orders/${id}/status`, {
        method: 'PUT', token,
        body: JSON.stringify({ status, note: note || `Status updated to ${status}` }),
      });
      fetchOrder();
    } catch (err) { console.error(err); }
    finally { setUpdating(false); }
  };

  const handleAddTracking = async () => {
    if (!token || !order?.items?.[0]) return;
    setUpdating(true);
    try {
      await api(`/orders/${id}/items/${order.items[0].id}/fulfillment`, {
        method: 'PUT', token,
        body: JSON.stringify({
          fulfillment_status: 'SHIPPED',
          tracking_number: trackingNumber,
          tracking_url: trackingUrl || undefined,
        }),
      });
      setShowTracking(false);
      await handleStatusUpdate('SHIPPED', `Shipped with tracking: ${trackingNumber}`);
    } catch (err) { console.error(err); }
    finally { setUpdating(false); }
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );
  if (!order) return <p className="text-center py-12 text-muted-foreground">Order not found</p>;

  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const isTerminal = ['DELIVERED', 'CANCELLED', 'REFUNDED', 'RETURNED'].includes(order.status);
  const isQualityCheck = order.status === 'QUALITY_CHECK';

  // Mirror the API rule: a provider can change OrderStatus only when EVERY
  // item in the order is fulfilled by them. Mixed orders (with creator-only
  // items) cannot be advanced from this dashboard.
  const providerId = user?.provider?.id as string | undefined;
  const items = (order.items ?? []) as Array<{ fulfiller_type?: string; fulfiller_id?: string }>;
  const canUpdateStatus =
    !!providerId &&
    items.length > 0 &&
    items.every((it) => it.fulfiller_type === 'PROVIDER' && it.fulfiller_id === providerId);
  const hasCreatorItems = items.some((it) => it.fulfiller_type === 'CREATOR');

  // Collect all design/image files from custom field values
  const designFiles: { label: string; url: string; itemTitle: string }[] = [];
  order.items?.forEach((item: any) => {
    const title = item.product?.translations?.[0]?.title || item.product?.name || item.product_id;
    item.custom_field_values?.forEach((fv: any) => {
      if (fv.file_url) {
        designFiles.push({
          label: fv.custom_field?.translations?.[0]?.label || fv.custom_field_id || 'File',
          url: fv.file_url,
          itemTitle: title,
        });
      }
    });
  });

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/provider/orders"
            className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight font-mono">{order.order_number}</h1>
            <p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
          </div>
        </div>
        <Badge variant="outline" className={`text-xs font-semibold px-2.5 py-1 ${STATUS_COLORS[order.status] || ''}`}>
          {STATUS_LABELS[order.status] || order.status}
        </Badge>
      </div>

      {/* Notice for orders that include creator-fulfilled items — provider
          cannot advance the overall status of those. */}
      {!canUpdateStatus && (
        <Card className="shadow-none border-blue-100 bg-blue-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <Info className="w-4 h-4" /> Order Status Managed Elsewhere
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-blue-700">
              {hasCreatorItems
                ? 'This order contains creator-fulfilled items. The creator manages shipping and status updates for them.'
                : 'You don\'t fulfill items in this order, so its status is managed elsewhere.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quality Check special actions */}
      {canUpdateStatus && isQualityCheck && (
        <Card className="shadow-none border-orange-200 bg-orange-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-orange-800 flex items-center gap-2">
              <Package className="w-4 h-4" /> Quality Check Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-orange-700 mb-3">Review the order and either approve it for shipping or send it back to manufacturing.</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                disabled={updating}
                onClick={() => setShowTracking(true)}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve — Ship Order
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-red-200 text-red-700 hover:bg-red-50"
                disabled={updating}
                onClick={() => handleStatusUpdate('MANUFACTURING', 'Returned to manufacturing after quality check')}
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject — Back to Manufacturing
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Standard fulfillment actions */}
      {canUpdateStatus && !isTerminal && !isQualityCheck && (
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Update Fulfillment</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            {STATUS_FLOW.slice(currentIdx + 1).map(s => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={updating}
                onClick={() => {
                  if (s === 'SHIPPED') setShowTracking(true);
                  else handleStatusUpdate(s);
                }}
              >
                {s === 'SHIPPED' ? '🚚 Ship + Tracking' : STATUS_LABELS[s]}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Design / File Previews */}
      {designFiles.length > 0 && (
        <Card className="shadow-none border-blue-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileImage className="w-4 h-4 text-blue-500" /> Customer Design Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {designFiles.map((f, i) => (
                <div key={i} className="space-y-1">
                  <button
                    onClick={() => setLightboxImg(f.url)}
                    className="w-full aspect-square rounded-lg border overflow-hidden bg-zinc-50 hover:opacity-90 transition relative group"
                  >
                    <img src={f.url} alt={f.label} className="w-full h-full object-contain p-1" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center">
                      <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition" />
                    </div>
                  </button>
                  <p className="text-[10px] text-center text-muted-foreground truncate">{f.label}</p>
                  <a
                    href={f.url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="block text-center text-[10px] text-blue-600 hover:underline"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Order Items */}
        <Card className="shadow-none col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {order.items?.map((item: any) => {
                const title =
                  item.custom_product?.translations?.find((t: any) => t.locale === 'en')?.title ??
                  item.custom_product?.translations?.[0]?.title ??
                  item.custom_product?.product?.translations?.find((t: any) => t.locale === 'en')?.title ??
                  item.custom_product?.product?.translations?.[0]?.title ??
                  item.product?.translations?.find((t: any) => t.locale === 'en')?.title ??
                  item.product?.translations?.[0]?.title ??
                  item.variant?.product?.translations?.find((t: any) => t.locale === 'en')?.title ??
                  item.variant?.product?.translations?.[0]?.title ?? '—';
                const imgUrl =
                  item.custom_product?.mockup_images?.[0]?.url ??
                  item.custom_product?.product?.images?.[0]?.url ??
                  item.product?.images?.[0]?.url ??
                  item.variant?.product?.images?.[0]?.url;
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
                          {(() => {
                            const itemStatus = effectiveItemStatus(order.status, item.fulfillment_status);
                            return (
                              <Badge variant="outline" className={`text-[10px] font-semibold shrink-0 ${
                                STATUS_COLORS[itemStatus] || 'bg-zinc-100 text-zinc-600'
                              }`}>
                                {STATUS_LABELS[itemStatus] || itemStatus}
                              </Badge>
                            );
                          })()}
                        </div>
                        {variantLabel && <p className="text-xs text-muted-foreground mt-0.5">{variantLabel}</p>}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>Qty: {item.quantity}</span>
                          <span>·</span>
                          <span>{fmt(Number(item.unit_price))} each</span>
                          <span className="ml-auto font-semibold text-foreground text-sm">
                            {fmt(Number(item.total_price || item.unit_price * item.quantity))}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Inline custom field text values */}
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

                    {/* Inline file thumbnails */}
                    {fileFields.length > 0 && (
                      <div className="ml-17 flex flex-wrap gap-2">
                        {fileFields.map((fv: any) => (
                          <a key={fv.id} href={fv.file_url} target="_blank" rel="noreferrer"
                            className="block w-12 h-12 rounded border overflow-hidden bg-zinc-50 hover:opacity-80 transition"
                            title={fv.custom_field?.translations?.[0]?.label || 'File'}>
                            <img src={fv.file_url} alt="" className="w-full h-full object-contain p-0.5" />
                          </a>
                        ))}
                      </div>
                    )}

                    {item.design_notes && (
                      <p className="ml-17 text-xs text-muted-foreground italic">Note: {item.design_notes}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <Separator className="my-3" />
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{fmt(Number(order.subtotal))}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Shipping</span>
                <span>{fmt(Number(order.shipping_cost))}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-xs text-emerald-600">
                  <span>Discount</span>
                  <span>−{fmt(Number(order.discount_amount))}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold text-sm">
                <span>Total</span>
                <span>{fmt(Number(order.total))}</span>
              </div>
              {order.commission && (
                <div className="mt-2 pt-2 border-t border-dashed space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Platform fee</span>
                    <span className="text-zinc-500">−{fmt(Number(order.commission.platform_amount))}</span>
                  </div>
                  {Number(order.commission.creator_amount) > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Creator share</span>
                      <span className="text-zinc-500">−{fmt(Number(order.commission.creator_amount))}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-semibold text-emerald-700">
                    <span>Your earnings</span>
                    <span>{fmt(Number(order.commission.provider_amount))}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-4">
          {/* Customer */}
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Customer</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-0.5">
              <p className="font-medium">{order.customer?.first_name} {order.customer?.last_name}</p>
              {order.customer?.email && <p className="text-muted-foreground">{order.customer.email}</p>}
              {order.customer?.phone && <p className="text-muted-foreground">{order.customer.phone}</p>}
            </CardContent>
          </Card>

          {/* Shipping address */}
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Shipping Address</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-0.5">
              <p className="font-medium">{order.address?.full_name}</p>
              <p>{order.address?.line1}</p>
              {order.address?.line2 && <p>{order.address.line2}</p>}
              <p>{order.address?.city}{order.address?.postal_code ? `, ${order.address.postal_code}` : ''}</p>
              {order.address?.country_code && (
                <p className="flex items-center gap-1">
                  <span>{countryFlag(order.address.country_code)}</span>
                  <span>{order.address.country_code}</span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Tracking info (if shipped) */}
          {order.items?.[0]?.tracking_number && (
            <Card className="shadow-none border-sky-100 bg-sky-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-sky-600" /> Tracking
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <p className="font-mono font-medium">{order.items[0].tracking_number}</p>
                {order.items[0].tracking_url && (
                  <a href={order.items[0].tracking_url} target="_blank" rel="noreferrer"
                    className="text-sky-600 hover:underline flex items-center gap-1">
                    Track shipment <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {order.timeline?.length > 0 ? (
                <div className="space-y-2.5">
                  {[...order.timeline].reverse().map((e: any, i: number) => (
                    <div key={e.id || i} className="flex items-start gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${i === 0 ? 'bg-zinc-800' : 'bg-zinc-300'}`} />
                      <div>
                        <p className="text-[11px] font-medium">{STATUS_LABELS[e.status] || e.status}</p>
                        {e.note && <p className="text-[10px] text-muted-foreground">{e.note}</p>}
                        <p className="text-[9px] text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">No entries</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Tracking Dialog */}
      <Dialog open={showTracking} onOpenChange={v => { if (!v) setShowTracking(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Tracking & Ship</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tracking Number *</Label>
              <Input
                className="h-9 text-sm font-mono"
                placeholder="e.g. 1Z999AA10123456784"
                value={trackingNumber}
                onChange={e => setTrackingNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tracking URL (optional)</Label>
              <Input
                className="h-9 text-sm"
                placeholder="https://track.carrier.com/..."
                value={trackingUrl}
                onChange={e => setTrackingUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowTracking(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddTracking} disabled={!trackingNumber || updating}>
              <Truck className="w-3.5 h-3.5 mr-1.5" />
              {updating ? 'Shipping...' : 'Mark as Shipped'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image lightbox */}
      <Dialog open={!!lightboxImg} onOpenChange={() => setLightboxImg(null)}>
        <DialogContent className="max-w-2xl p-2 bg-black/95 border-zinc-700">
          {lightboxImg && (
            <img src={lightboxImg} alt="Design preview" className="w-full max-h-[80vh] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
