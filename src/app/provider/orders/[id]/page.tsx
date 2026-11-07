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
  ArrowLeft, Truck, CheckCircle2,
  XCircle, ExternalLink, Package, Info, AlertCircle, Pencil,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api, ApiError, API_ORIGIN } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';
import { OrderTaxLines } from '@/components/common/OrderTaxLines';
import { countryFlag } from '@/components/common/CountryMultiSelect';
import type { TaxLine, TaxPricingMode } from '@/lib/taxRate';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { GroupedOrderFieldValues } from '@/components/apps/personalization/GroupedOrderFieldValues';
import type { OrderFieldValueRow } from '@/lib/customFields';
import { paymentTimelineLabel } from '@/lib/orderTimeline';

type Translator = ReturnType<typeof useTranslations>;

// ---------------------------------------------------------------------------
// API shapes (GET /orders/:id) — only the fields this page reads.
// ---------------------------------------------------------------------------

interface LocalizedTitle {
  locale?: string;
  title?: string | null;
}

interface ProductRef {
  id?: string;
  name?: string | null;
  translations?: LocalizedTitle[] | null;
  images?: { url: string }[] | null;
}

interface OrderItem {
  id: string;
  product_id: string;
  fulfiller_type?: string;
  fulfiller_id?: string;
  fulfillment_status?: string | null;
  quantity: number;
  unit_price: number;
  total_price?: number | string | null;
  image_url?: string | null;
  design_notes?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  product?: ProductRef | null;
  variant?: { options?: Record<string, string> | null; product?: ProductRef | null } | null;
  custom_product?: {
    translations?: LocalizedTitle[] | null;
    mockup_images?: { url: string }[] | null;
    product?: ProductRef | null;
  } | null;
  // Snapshot rows (M4.0): labels survive renames and deleted fields.
  custom_field_values?: OrderFieldValueRow[] | null;
}

interface TimelineEntry {
  id?: string;
  status: string;
  note?: string | null;
  created_at: string;
}

interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  currency?: string | null;
  // Customer's storefront locale; second choice for personalization labels.
  locale?: string | null;
  subtotal: number | string;
  shipping_cost: number | string;
  shipping_method_name?: string | null;
  shipping_method_type?: string | null;
  discount_amount?: number | string | null;
  total: number | string;
  payment_status?: string | null;
  tax_lines?: TaxLine[] | null;
  tax_rate_bp?: number | null;
  tax_amount?: number | string | null;
  tax_pricing_mode?: TaxPricingMode | null;
  items: OrderItem[];
  timeline: TimelineEntry[];
  commission?: {
    platform_amount: number | string;
    creator_amount: number | string;
    provider_amount: number | string;
    /** Marketplace VAT kept by the platform as seller (null on older orders). */
    vat_amount?: number | string | null;
  } | null;
  /** This provider's own part of provider_amount (null without a commission row). */
  my_share?: number | null;
  /** Shipping excl. VAT, kept by the platform (not part of any share). */
  net_shipping?: number | null;
  payouts?: { status: string }[] | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  address?: {
    full_name?: string | null;
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    postal_code?: string | null;
    country_code?: string | null;
  } | null;
}

const API_BASE = API_ORIGIN;
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

const STATUS_LABEL_KEYS: Record<string, string> = {
  PENDING:        'orderStatus.pending',
  CONFIRMED:      'orderStatus.confirmed',
  PROCESSING:     'orderStatus.processing',
  MANUFACTURING:  'orderStatus.manufacturing',
  QUALITY_CHECK:  'orderStatus.qualityCheck',
  SHIPPED:        'orderStatus.shipped',
  DELIVERED:      'orderStatus.delivered',
  RETURNED:       'orderStatus.returned',
  CANCELLED:      'orderStatus.cancelled',
  REFUNDED:       'orderStatus.refunded',
};

function statusLabel(t: Translator, status: string): string {
  const key = STATUS_LABEL_KEYS[status];
  return key ? t(key) : status;
}

// Standard flow — Quality Check is optional but tracked
const STATUS_FLOW = ['PENDING', 'CONFIRMED', 'PROCESSING', 'MANUFACTURING', 'QUALITY_CHECK', 'SHIPPED', 'DELIVERED'];

// Per-item FulfillmentStatus is a subset; map onto STATUS_FLOW so we can compare progress.
const FULFILLMENT_TO_FLOW: Record<string, string> = {
  PENDING:       'PENDING',
  PROCESSING:    'PROCESSING',
  MANUFACTURING: 'MANUFACTURING',
  QUALITY_CHECK: 'QUALITY_CHECK',
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

// Order status chosen on this page -> the item FulfillmentStatus it means
// (mirrors deriveFulfillmentStatus in the API).
const FLOW_TO_FULFILLMENT: Record<string, string> = {
  PENDING:       'PENDING',
  CONFIRMED:     'PROCESSING',
  PROCESSING:    'PROCESSING',
  MANUFACTURING: 'MANUFACTURING',
  QUALITY_CHECK: 'QUALITY_CHECK',
  SHIPPED:       'SHIPPED',
  DELIVERED:     'DELIVERED',
};

function itemTitle(item: OrderItem): string {
  return (
    item.custom_product?.translations?.find((t) => t.locale === 'en')?.title ??
    item.custom_product?.translations?.[0]?.title ??
    item.custom_product?.product?.translations?.find((t) => t.locale === 'en')?.title ??
    item.custom_product?.product?.translations?.[0]?.title ??
    item.product?.translations?.find((t) => t.locale === 'en')?.title ??
    item.product?.translations?.[0]?.title ??
    item.variant?.product?.translations?.find((t) => t.locale === 'en')?.title ??
    item.variant?.product?.translations?.[0]?.title ?? '—'
  );
}

/** Tracking inputs of one shipment (shared or per item). */
interface TrackingDraft {
  carrier: string;
  number: string;
  url: string;
}

const EMPTY_DRAFT: TrackingDraft = { carrier: '', number: '', url: '' };

// A tracking link must be a full http(s) URL; empty is fine (optional).
function isValidTrackingUrl(url: string): boolean {
  const v = url.trim();
  if (!v) return true;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

type Notice = { kind: 'success' | 'error'; text: string } | null;

export default function ProviderOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const { fmt, currency } = useCurrency();
  const t = useTranslations('provider');
  const tc = useTranslations('common');
  const tTimeline = useTranslations('orderTimeline');
  const tp = useTranslations('payments');
  const tt = useTranslations('provider.fulfillmentTracking');
  const te = useTranslations('errors');
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  // Page-level feedback of the status buttons and of a finished shipment.
  const [notice, setNotice] = useState<Notice>(null);
  // Tracking dialog: 'ship' = my unshipped items, 'edit' = my shipped items.
  const [trackingMode, setTrackingMode] = useState<'ship' | 'edit' | null>(null);
  const [sameForAll, setSameForAll] = useState(true);
  const [shared, setShared] = useState<TrackingDraft>(EMPTY_DRAFT);
  const [drafts, setDrafts] = useState<Record<string, TrackingDraft>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [rowSaved, setRowSaved] = useState<Record<string, boolean>>({});
  const [dialogError, setDialogError] = useState<string | null>(null);
  const uiLocale = useLocale();

  // Friendly text of a failed request: known API codes first, then a generic
  // message (raw class-validator output is never shown as is).
  const errorText = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.code === 'ORDER_NO_OWNED_ITEMS') return tt('errorNoOwnedItems');
      if (err.code && te.has(err.code)) return te(err.code);
      if (err.status === 400) return tt('errorInvalid');
    }
    return tt('errorGeneric');
  };

  const fetchOrder = async () => {
    if (!token || !id) return;
    try {
      const data = await api<OrderDetail>(`/orders/${id}`, { token });
      setOrder(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrder(); }, [token, id]);

  // Items this provider fulfils: the only ones the API lets them update.
  const providerId = user?.provider?.id as string | undefined;
  const myItems = (order?.items ?? []).filter(
    (it) => !!providerId && it.fulfiller_type === 'PROVIDER' && it.fulfiller_id === providerId,
  );
  const flowIdxOf = (it: OrderItem) =>
    STATUS_FLOW.indexOf(effectiveItemStatus(order?.status ?? '', it.fulfillment_status));
  const unshippedItems = myItems.filter(
    (it) => !['SHIPPED', 'DELIVERED'].includes(it.fulfillment_status ?? ''),
  );
  const shippedItems = myItems.filter((it) => it.fulfillment_status === 'SHIPPED');
  const dialogItems = trackingMode === 'edit' ? shippedItems : unshippedItems;

  const handleStatusUpdate = async (status: string, note?: string) => {
    if (!token || !order) return;
    setUpdating(true);
    setNotice(null);
    try {
      const targetIdx = STATUS_FLOW.indexOf(status);
      const behind = myItems.filter((it) => flowIdxOf(it) < targetIdx);
      const isReject = order.status === 'QUALITY_CHECK' && status === 'MANUFACTURING';
      if (isReject || behind.length === 0 || behind.length === myItems.length) {
        // All my items move together (or the explicit QC reject): one
        // order-level update and one timeline entry.
        await api(`/orders/${id}/status`, {
          method: 'PUT', token,
          body: JSON.stringify({ status, note: note || t('noteStatusUpdated', { status }) }),
        });
      } else {
        // Mixed stages: advance only the items that are behind, so items
        // already further along are never pulled back.
        for (const it of behind) {
          await api(`/orders/${id}/items/${it.id}/fulfillment`, {
            method: 'PUT', token,
            body: JSON.stringify({ fulfillment_status: FLOW_TO_FULFILLMENT[status] ?? status }),
          });
        }
      }
      setNotice({ kind: 'success', text: tt('statusUpdated', { status: statusLabel(t, status) }) });
    } catch (err) {
      setNotice({ kind: 'error', text: errorText(err) });
    } finally {
      await fetchOrder();
      setUpdating(false);
    }
  };

  const openTrackingDialog = (mode: 'ship' | 'edit') => {
    const list = mode === 'edit' ? shippedItems : unshippedItems;
    const next: Record<string, TrackingDraft> = {};
    for (const it of list) {
      next[it.id] = { carrier: '', number: it.tracking_number ?? '', url: it.tracking_url ?? '' };
    }
    // Start with one shared parcel unless the saved tracking already differs.
    const savedNumbers = new Set(list.map((it) => it.tracking_number ?? ''));
    const first = list[0];
    setDrafts(next);
    setShared({ carrier: '', number: first?.tracking_number ?? '', url: first?.tracking_url ?? '' });
    setSameForAll(list.length > 1 && savedNumbers.size <= 1);
    setRowErrors({});
    setRowSaved({});
    setDialogError(null);
    setNotice(null);
    setTrackingMode(mode);
  };

  const closeTrackingDialog = () => {
    if (updating) return;
    setTrackingMode(null);
  };

  const handleSaveTracking = async () => {
    if (!token || !order || !trackingMode) return;
    setDialogError(null);
    const useShared = sameForAll && dialogItems.length > 1;
    const single = dialogItems.length === 1;

    // Client-side checks first, shown next to the field they concern.
    let targets: { item: OrderItem; draft: TrackingDraft }[];
    if (useShared || single) {
      if (!shared.number.trim()) { setDialogError(tt('errorNoTracking')); return; }
      if (!isValidTrackingUrl(shared.url)) { setDialogError(tt('errorUrl')); return; }
      targets = dialogItems.map((item) => ({ item, draft: shared }));
    } else {
      targets = dialogItems
        .filter((item) => !rowSaved[item.id])
        .map((item) => ({ item, draft: drafts[item.id] ?? EMPTY_DRAFT }))
        .filter(({ draft }) => draft.number.trim() !== '');
      if (targets.length === 0) { setDialogError(tt('errorNoTracking')); return; }
      const invalid: Record<string, string> = {};
      for (const { item, draft } of targets) {
        if (!isValidTrackingUrl(draft.url)) invalid[item.id] = tt('errorUrl');
      }
      if (Object.keys(invalid).length > 0) { setRowErrors(invalid); return; }
    }

    setUpdating(true);
    setRowErrors({});
    const failed: Record<string, string> = {};
    const saved: Record<string, boolean> = { ...rowSaved };
    let sharedError: string | null = null;
    try {
      // One parcel for all my items while none is delivered yet: a single
      // order-level SHIPPED update (one timeline entry, one header recompute).
      const allMineTogether =
        (useShared || single) && trackingMode === 'ship' &&
        dialogItems.length === myItems.length;
      if (allMineTogether) {
        try {
          await api(`/orders/${id}/status`, {
            method: 'PUT', token,
            body: JSON.stringify({
              status: 'SHIPPED',
              tracking_number: shared.number.trim(),
              tracking_url: shared.url.trim() || undefined,
              carrier: shared.carrier.trim() || undefined,
            }),
          });
          targets.forEach(({ item }) => { saved[item.id] = true; });
        } catch (err) {
          sharedError = errorText(err);
        }
      } else {
        for (const { item, draft } of targets) {
          try {
            await api(`/orders/${id}/items/${item.id}/fulfillment`, {
              method: 'PUT', token,
              body: JSON.stringify({
                fulfillment_status: 'SHIPPED',
                tracking_number: draft.number.trim(),
                tracking_url: draft.url.trim() || undefined,
                carrier: draft.carrier.trim() || undefined,
              }),
            });
            saved[item.id] = true;
          } catch (err) {
            failed[item.id] = errorText(err);
          }
        }
      }
      setRowSaved(saved);
      const failedIds = Object.keys(failed);
      if (sharedError) {
        setDialogError(sharedError);
      } else if (failedIds.length > 0) {
        if (useShared || single) {
          setDialogError(failed[failedIds[0]]);
        } else {
          setRowErrors(failed);
          setDialogError(tt('errorPartial'));
        }
      } else {
        const okCount = targets.length;
        setTrackingMode(null);
        setNotice({
          kind: 'success',
          text: trackingMode === 'edit' ? tt('trackingSaved') : tt('shippedSuccess', { count: okCount }),
        });
      }
    } finally {
      await fetchOrder();
      setUpdating(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );
  if (!order) return (
    <p className="text-center py-12 text-muted-foreground">{loadError ?? t('orderNotFound')}</p>
  );

  // A provider advances only their own items; the overall order status is
  // re-derived by the API (slowest item wins). Buttons therefore follow the
  // slowest of MY items, not the order header (other fulfillers may lag).
  const orderTerminal = ['CANCELLED', 'REFUNDED', 'RETURNED'].includes(order.status);
  const canUpdateStatus = myItems.length > 0;
  const hasCreatorItems = (order.items ?? []).some((it) => it.fulfiller_type === 'CREATOR');
  const myIdxs = myItems.map(flowIdxOf).filter((i) => i >= 0);
  const currentIdx = myIdxs.length > 0 ? Math.min(...myIdxs) : STATUS_FLOW.indexOf(order.status);
  const myStage = STATUS_FLOW[currentIdx] ?? order.status;
  const isTerminal = orderTerminal || myStage === 'DELIVERED';
  const isQualityCheck = myStage === 'QUALITY_CHECK';
  const canEditTracking = !orderTerminal && shippedItems.length > 0;
  const trackedItems = myItems.filter((it) => it.tracking_number);

  // Customer files (previews, original downloads, purged notes) are shown per
  // line by GroupedOrderFieldValues; the separate gallery card was a duplicate.
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/provider/orders"
            className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition">
            <ArrowLeft className="w-4 h-4 rtl:-scale-x-100" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight font-mono">{order.order_number}</h1>
            <p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
          </div>
        </div>
        <Badge variant="outline" className={`text-xs font-semibold px-2.5 py-1 ${STATUS_COLORS[order.status] || ''}`}>
          {statusLabel(t, order.status)}
        </Badge>
      </div>

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
            notice.kind === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {notice.kind === 'error'
            ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
          <span className="flex-1">{notice.text}</span>
          <button
            type="button"
            className="opacity-70 hover:opacity-100"
            onClick={() => setNotice(null)}
            aria-label={tc('close')}
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Notice for orders that include creator-fulfilled items — provider
          cannot advance the overall status of those. */}
      {!canUpdateStatus && (
        <Card className="shadow-none border-blue-100 bg-blue-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <Info className="w-4 h-4" /> {t('statusManagedElsewhere')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-blue-700">
              {hasCreatorItems
                ? t('creatorFulfilledNotice')
                : t('noFulfillNotice')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quality Check special actions */}
      {canUpdateStatus && isQualityCheck && (
        <Card className="shadow-none border-orange-200 bg-orange-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-orange-800 flex items-center gap-2">
              <Package className="w-4 h-4" /> {t('qualityCheckRequired')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-orange-700 mb-3">{t('qualityCheckHint')}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                disabled={updating || unshippedItems.length === 0}
                onClick={() => openTrackingDialog('ship')}
              >
                <CheckCircle2 className="w-3.5 h-3.5 me-1.5" /> {t('approveShipOrder')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-red-200 text-red-700 hover:bg-red-50"
                disabled={updating}
                onClick={() => handleStatusUpdate('MANUFACTURING', t('noteBackToManufacturing'))}
              >
                <XCircle className="w-3.5 h-3.5 me-1.5" /> {t('rejectBackToManufacturing')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Standard fulfillment actions */}
      {canUpdateStatus && !orderTerminal && ((!isTerminal && !isQualityCheck) || canEditTracking) && (
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{t('updateFulfillment')}</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            {!isTerminal && !isQualityCheck && STATUS_FLOW.slice(currentIdx + 1).map(s => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={updating || (s === 'SHIPPED' && unshippedItems.length === 0)}
                onClick={() => {
                  if (s === 'SHIPPED') openTrackingDialog('ship');
                  else handleStatusUpdate(s);
                }}
              >
                {s === 'SHIPPED' ? t('shipPlusTracking') : statusLabel(t, s)}
              </Button>
            ))}
            {canEditTracking && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                disabled={updating}
                onClick={() => openTrackingDialog('edit')}
              >
                <Pencil className="w-3.5 h-3.5 me-1.5" /> {tt('editTracking')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Order Items */}
        <Card className="shadow-none col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{t('orderItems')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {order.items?.map((item) => {
                const title = itemTitle(item);
                const isMine = myItems.some((m) => m.id === item.id);
                const imgUrl =
                  item.image_url ??
                  item.custom_product?.mockup_images?.[0]?.url ??
                  item.custom_product?.product?.images?.[0]?.url ??
                  item.product?.images?.[0]?.url ??
                  item.variant?.product?.images?.[0]?.url;
                const variantOpts = item.variant?.options as Record<string, string> | undefined;
                const variantLabel = variantOpts
                  ? Object.entries(variantOpts).map(([k, v]) => `${k}: ${v}`).join(' · ')
                  : null;

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
                              <Badge variant="outline" className={`text-[11px] font-semibold shrink-0 ${
                                STATUS_COLORS[itemStatus] || 'bg-zinc-100 text-zinc-600'
                              }`}>
                                {statusLabel(t, itemStatus)}
                              </Badge>
                            );
                          })()}
                        </div>
                        {variantLabel && <p className="text-xs text-muted-foreground mt-0.5">{variantLabel}</p>}
                        {!isMine && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{tt('fulfilledByOther')}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{t('qtyLabel', { quantity: item.quantity })}</span>
                          <span>·</span>
                          <span>{t('eachPrice', { price: fmt(Number(item.unit_price)) })}</span>
                          <span className="ms-auto font-semibold text-foreground text-sm">
                            {fmt(Number(item.total_price || item.unit_price * item.quantity))}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Custom field values (order snapshot; files with original download) */}
                    <GroupedOrderFieldValues
                      values={item.custom_field_values}
                      locale={uiLocale}
                      primaryLocale={order.locale || 'en'}
                      token={token}
                    />

                    {/* Saved tracking of this line */}
                    {item.tracking_number && (
                      <div className="ms-17 flex flex-wrap items-center gap-2 text-xs">
                        <Truck className="w-3.5 h-3.5 text-sky-600" />
                        <span className="font-mono font-medium">{item.tracking_number}</span>
                        {item.tracking_url && (
                          <a href={item.tracking_url} target="_blank" rel="noreferrer"
                            className="text-sky-600 hover:underline inline-flex items-center gap-1">
                            {t('trackShipment')} <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    )}

                    {item.design_notes && (
                      <p className="ms-17 text-xs text-muted-foreground italic">{t('noteLabel', { note: item.design_notes })}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <Separator className="my-3" />
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t('subtotal')}</span>
                <span>{fmt(Number(order.subtotal))}</span>
              </div>
              {/* Shipping line names the chosen method; pickup orders get a small badge. */}
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                  {t('shipping')}
                  {order.shipping_method_name && <span>({order.shipping_method_name})</span>}
                  {order.shipping_method_type === 'PICKUP' && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[11px]">{tp('pickup')}</Badge>
                  )}
                </span>
                <span>{fmt(Number(order.shipping_cost))}</span>
              </div>
              {Number(order.discount_amount) > 0 && (
                <div className="flex justify-between text-xs text-emerald-600">
                  <span>{t('discount')}</span>
                  <span>−{fmt(Number(order.discount_amount))}</span>
                </div>
              )}
              {/* Itemised tax lines (one row per rate) in the order's own currency;
                  inclusive orders show what the total already contains. */}
              <OrderTaxLines order={order} currency={order.currency || currency} rowClassName="text-xs" />
              <Separator />
              <div className="flex justify-between font-semibold text-sm">
                <span>{t('total')}</span>
                <span>{fmt(Number(order.total))}</span>
              </div>
              {order.commission && (
                <div className="mt-2 pt-2 border-t border-dashed space-y-1">
                  {Number(order.commission.vat_amount ?? 0) > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{tp('vatToSeller')}</span>
                      <span className="text-zinc-500">−{fmt(Number(order.commission.vat_amount))}</span>
                    </div>
                  )}
                  {Number(order.net_shipping ?? 0) > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{tp('netShippingToPlatform')}</span>
                      <span className="text-zinc-500">−{fmt(Number(order.net_shipping))}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{t('platformFeeLower')}</span>
                    <span className="text-zinc-500">−{fmt(Number(order.commission.platform_amount))}</span>
                  </div>
                  {Number(order.commission.creator_amount) > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t('creatorShareLower')}</span>
                      <span className="text-zinc-500">−{fmt(Number(order.commission.creator_amount))}</span>
                    </div>
                  )}
                  {(() => {
                    // Multi-provider orders: the aggregate provider_amount is split between
                    // the providers (same split as the transfers); show only this provider's part.
                    const total = Number(order.commission.provider_amount);
                    const mine = order.my_share != null ? Number(order.my_share) : total;
                    const others = Math.round((total - mine) * 100) / 100;
                    return (
                      <>
                        {others > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{tp('otherProvidersShare')}</span>
                            <span className="text-zinc-500">−{fmt(others)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs font-semibold text-emerald-700">
                          <span>{t('yourEarningsLower')}</span>
                          <span>{fmt(mine)}</span>
                        </div>
                      </>
                    );
                  })()}
                  {(() => {
                    const myPayout = Array.isArray(order.payouts) ? order.payouts[0] : null;
                    return (
                      <div className="flex items-center justify-between text-xs border-t pt-2 mt-1">
                        <span className="text-muted-foreground">{tp('yourPayout')}</span>
                        {myPayout ? (
                          <Badge variant="outline" className={`text-[11px] ${myPayout.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            {myPayout.status === 'paid' ? tp('statusPaid') : tp('statusFailed')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px] bg-zinc-100 text-zinc-600 border-zinc-200">
                            {order.payment_status === 'paid' ? tp('statusPending') : tp('statusAwaiting')}
                          </Badge>
                        )}
                      </div>
                    );
                  })()}
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
              <CardTitle className="text-sm font-semibold">{t('customer')}</CardTitle>
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
              <CardTitle className="text-sm font-semibold">{t('shippingAddress')}</CardTitle>
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

          {/* Tracking of my shipped items, one row per line */}
          {trackedItems.length > 0 && (
            <Card className="shadow-none border-sky-100 bg-sky-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-sky-600" /> {t('tracking')}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2.5">
                {trackedItems.map((it) => (
                  <div key={it.id} className="space-y-0.5">
                    <p className="text-muted-foreground truncate">{itemTitle(it)}</p>
                    <p className="font-mono font-medium break-all">{it.tracking_number}</p>
                    {it.tracking_url && (
                      <a href={it.tracking_url} target="_blank" rel="noreferrer"
                        className="text-sky-600 hover:underline flex items-center gap-1">
                        {t('trackShipment')} <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t('timeline')}</CardTitle>
            </CardHeader>
            <CardContent>
              {order.timeline?.length > 0 ? (
                <div className="space-y-2.5">
                  {[...order.timeline].reverse().map((e, i) => (
                    <div key={e.id || i} className="flex items-start gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${i === 0 ? 'bg-zinc-800' : 'bg-zinc-300'}`} />
                      <div>
                        <p className="text-[11px] font-medium">{paymentTimelineLabel(tTimeline, e.status) ?? statusLabel(t, e.status)}</p>
                        {e.note && <p className="text-[11px] text-muted-foreground">{e.note}</p>}
                        <p className="text-[11px] text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">{t('noEntries')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tracking dialog: one parcel for all my items, or tracking per item */}
      <Dialog open={trackingMode !== null} onOpenChange={v => { if (!v) closeTrackingDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {trackingMode === 'edit' ? tt('editTracking') : t('addTrackingAndShip')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {dialogItems.length > 1 && (
              <label className="flex items-start gap-2.5 rounded-md border p-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary"
                  checked={sameForAll}
                  disabled={updating}
                  onChange={e => { setSameForAll(e.target.checked); setDialogError(null); setRowErrors({}); }}
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">{tt('applyToAll')}</span>
                  <span className="block text-xs text-muted-foreground">{tt('applyToAllHint')}</span>
                </span>
              </label>
            )}

            {sameForAll || dialogItems.length <= 1 ? (
              <div className="space-y-3">
                <ul className="text-xs text-muted-foreground list-disc ps-5 space-y-0.5">
                  {dialogItems.map((it) => (
                    <li key={it.id}>{itemTitle(it)} · {t('qtyLabel', { quantity: it.quantity })}</li>
                  ))}
                </ul>
                <TrackingFields
                  draft={shared}
                  disabled={updating}
                  onChange={setShared}
                  t={t}
                  tt={tt}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{tt('perItemHint')}</p>
                {dialogItems.map((it) => (
                  <div key={it.id} className="rounded-md border p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">
                        {itemTitle(it)}{' '}
                        <span className="text-xs text-muted-foreground font-normal">· {t('qtyLabel', { quantity: it.quantity })}</span>
                      </p>
                      {rowSaved[it.id] && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {tt('itemSaved')}
                        </span>
                      )}
                    </div>
                    <TrackingFields
                      draft={drafts[it.id] ?? EMPTY_DRAFT}
                      disabled={updating || !!rowSaved[it.id]}
                      onChange={d => setDrafts(prev => ({ ...prev, [it.id]: d }))}
                      t={t}
                      tt={tt}
                    />
                    {rowErrors[it.id] && (
                      <p role="alert" className="flex items-center gap-1.5 text-xs text-red-600">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {rowErrors[it.id]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {dialogError && (
              <p role="alert" className="flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {dialogError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" disabled={updating} onClick={closeTrackingDialog}>{tc('cancel')}</Button>
            <Button size="sm" onClick={handleSaveTracking} disabled={updating || dialogItems.length === 0}>
              <Truck className="w-3.5 h-3.5 me-1.5" />
              {updating
                ? tt('saving')
                : trackingMode === 'edit' ? tt('saveTracking') : t('markAsShipped')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Carrier + tracking number + tracking link inputs of one shipment. */
function TrackingFields({
  draft, disabled, onChange, t, tt,
}: {
  draft: TrackingDraft;
  disabled: boolean;
  onChange: (d: TrackingDraft) => void;
  t: Translator;
  tt: Translator;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label className="text-xs">{tt('carrier')}</Label>
        <Input
          className="h-9 text-sm"
          placeholder={tt('carrierPlaceholder')}
          maxLength={80}
          value={draft.carrier}
          disabled={disabled}
          onChange={e => onChange({ ...draft, carrier: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{t('trackingNumber')}</Label>
        <Input
          className="h-9 text-sm font-mono"
          placeholder={t('trackingNumberPlaceholder')}
          maxLength={120}
          value={draft.number}
          disabled={disabled}
          onChange={e => onChange({ ...draft, number: e.target.value })}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs">{t('trackingUrlOptional')}</Label>
        <Input
          className="h-9 text-sm"
          dir="ltr"
          placeholder="https://track.carrier.com/..."
          maxLength={2048}
          value={draft.url}
          disabled={disabled}
          onChange={e => onChange({ ...draft, url: e.target.value })}
        />
      </div>
    </div>
  );
}
