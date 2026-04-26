'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ArrowLeft, Clock, Package } from 'lucide-react';
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
  SHIPPED: 'bg-sky-50 text-sky-700 border-sky-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  REFUNDED: 'bg-zinc-100 text-zinc-700 border-zinc-200',
};

const itemStatusColors: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  PROCESSING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  FULFILLED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_OPTIONS = [
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function CreatorOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const { fmt } = useCurrency();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [nextStatus, setNextStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

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
      <p className="text-center py-12 text-muted-foreground text-sm">Order not found</p>
    );
  }

  // Earnings: sum creator_amount from commission entries
  const totalEarnings = Array.isArray(order.commission)
    ? order.commission.reduce(
        (acc: number, c: any) => acc + Number(c.creator_amount ?? 0),
        0,
      )
    : Number(order.commission?.creator_amount ?? 0);

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
          {order.status}
        </Badge>
      </div>

      {/* 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column (main) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Order items */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {order.items?.length > 0 ? (
                  order.items.map((item: any) => {
                    // Title: custom product → base product → fallback
                    const title =
                      item.custom_product?.translations?.find((t: any) => t.locale === 'en')?.title ??
                      item.custom_product?.translations?.[0]?.title ??
                      item.product?.translations?.find((t: any) => t.locale === 'en')?.title ??
                      item.product?.translations?.[0]?.title ??
                      '—';

                    // Image: custom product mockup → base product image
                    const imgUrl =
                      item.custom_product?.mockup_images?.[0]?.url ??
                      item.custom_product?.product?.images?.[0]?.url ??
                      item.product?.images?.[0]?.url;

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
                          value: fv.value || (fv.file_url ? 'File uploaded' : '—'),
                        });
                      }
                    }

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
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-semibold shrink-0 ${
                                  itemStatusColors[item.fulfillment_status] ?? 'bg-zinc-100 text-zinc-600'
                                }`}
                              >
                                {item.fulfillment_status ?? '—'}
                              </Badge>
                            </div>

                            {/* Variant */}
                            {variantLabel && (
                              <p className="text-xs text-muted-foreground mt-0.5">{variantLabel}</p>
                            )}

                            {/* Qty & Price */}
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
                          <p className="ml-17 text-xs text-muted-foreground italic">Note: {item.design_notes}</p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-8">No items</p>
                )}
              </div>
              <Separator className="my-3" />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{fmt(Number(order.subtotal ?? order.total))}</span>
                </div>
                {Number(order.shipping_cost ?? 0) > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Shipping</span>
                    <span>{fmt(Number(order.shipping_cost))}</span>
                  </div>
                )}
                {Number(order.discount_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span>-{fmt(Number(order.discount_amount))}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold text-base pt-1">
                  <span>Total</span>
                  <span>{fmt(Number(order.total))}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {order.timeline?.length > 0 ? (
                <div className="space-y-3">
                  {order.timeline.map((entry: any, idx: number) => (
                    <div key={entry.id ?? idx} className="flex items-start gap-3">
                      <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{entry.status}</p>
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
                    <p className="text-sm font-medium">Order created</p>
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
          {/* Status update */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Update Status</CardTitle>
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
                placeholder="Select new status…"
                searchPlaceholder="Search statuses…"
              />
              <input
                type="text"
                placeholder="Notes (optional)"
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
                {updatingStatus ? 'Updating…' : 'Update Status'}
              </Button>
            </CardContent>
          </Card>

          {/* Customer */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Customer</CardTitle>
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
              <CardTitle className="text-sm font-semibold">Shipping Address</CardTitle>
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
                <p className="text-muted-foreground">No address on file</p>
              )}
            </CardContent>
          </Card>

          {/* Commission / Earnings */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Your Earnings</CardTitle>
            </CardHeader>
            <CardContent className="text-xs">
              <p className="text-2xl font-semibold text-emerald-700">
                {fmt(totalEarnings)}
              </p>
              <p className="text-muted-foreground mt-1">
                Creator commission for this order
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
