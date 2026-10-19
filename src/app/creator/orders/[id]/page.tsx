'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ArrowLeft, Clock, Package, Info, Tag, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';
import { OrderTaxLines } from '@/components/common/OrderTaxLines';
import { OrderCompanyLines } from '@/components/common/OrderCompanyLines';
import { useStoreType } from '@/lib/useStoreType';
import { KustomPaymentPanel, type KustomOrderFields } from '@/components/common/KustomPaymentPanel';
import { deriveNetTotals, formatAmountIn, type TaxLine, type TaxPricingMode } from '@/lib/taxRate';
import { normalizeB2bSettings, type CustomerB2bDefaults, type OrderB2bSnapshot, type OrderTaxExemptionFields } from '@/lib/b2b';
import { OrderTaxExemptBadge, OrderTaxExemptionCard } from '@/components/common/OrderTaxExemptionCard';
import { CustomerTaxExemption } from '@/components/apps/CustomerTaxExemption';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';
import { OrderInvoiceCard } from '@/components/invoices/OrderInvoiceCard';
import { GroupedOrderFieldValues } from '@/components/apps/personalization/GroupedOrderFieldValues';
import dynamic from 'next/dynamic';
import { useApiError } from '@/lib/useApiError';
import type { OrderFieldValueRow } from '@/lib/customFields';

// E14: the production checklist and the designer card (renderer mirror,
// canvas preview) load on demand, only when their app is available.
const ProductionChecklist = dynamic(
  () => import('@/components/production/ProductionChecklist').then((m) => m.ProductionChecklist),
  { ssr: false },
);
const OrderDesignCard = dynamic(() => import('@/components/designer/OrderDesignCard').then((m) => m.OrderDesignCard), {
  ssr: false,
});

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

// ── Order payload types (only the fields this page reads) ──────────────

interface LocalizedTitle { locale: string; title?: string | null }

interface ProductSummary {
  translations?: LocalizedTitle[] | null;
  images?: { url?: string | null }[] | null;
}

interface OrderItemBundleOffer {
  quantity: number;
  translations?: { locale: string; title?: string | null; label?: string | null }[] | null;
  bundle?: { translations?: { locale: string; name?: string | null }[] | null } | null;
}

interface OrderItem {
  id: string;
  quantity: number;
  unit_price?: number | string | null;
  original_unit_price?: number | string | null;
  total_price?: number | string | null;
  fulfillment_status?: string | null;
  fulfiller_type?: string;
  fulfiller_id?: string;
  image_url?: string | null;
  design_notes?: string | null;
  custom_product?:
    | (ProductSummary & {
        mockup_images?: { url?: string | null }[] | null;
        product?: ProductSummary | null;
      })
    | null;
  product?: ProductSummary | null;
  variant?: { options?: Record<string, string> | null; product?: ProductSummary | null } | null;
  // Snapshot rows (M4.0): labels survive renames and deleted fields.
  custom_field_values?: OrderFieldValueRow[] | null;
  bundle_offer?: OrderItemBundleOffer | null;
}

interface OrderTimelineEntry {
  id?: string;
  status: string;
  created_at?: string | null;
  note?: string | null;
  notes?: string | null;
}

interface OrderCommission { creator_amount?: number | string | null }

interface OrderAddress {
  street?: string | null;
  line1?: string | null;
  line2?: string | null;
  apartment?: string | null;
  city?: string | null;
  zip?: string | null;
  postal_code?: string | null;
  country?: string | null;
  country_code?: string | null;
}

// OrderB2bSnapshot: the five company columns written by the b2b app;
// OrderTaxExemptionFields: reverse charge / exemption snapshot (M2.5).
interface Order extends KustomOrderFields, OrderB2bSnapshot, OrderTaxExemptionFields {
  id: string;
  customer_id?: string | null;
  order_number: string;
  status: string;
  created_at?: string | null;
  subtotal?: number | string | null;
  total: number | string;
  shipping_cost?: number | string | null;
  shipping_method_name?: string | null;
  shipping_method_type?: string | null;
  discount_amount?: number | string | null;
  currency?: string | null;
  // Markets app: set when the order was placed through a market (M1).
  market?: { key: string; name: string; currency: string } | null;
  hostname?: string | null;
  locale?: string | null;
  fx_rate_snapshot?: number | string | null;
  tax_lines?: TaxLine[] | null;
  tax_rate_bp?: number | null;
  tax_amount?: number | string | null;
  shipping_tax_amount?: number | string | null;
  tax_pricing_mode?: TaxPricingMode | null;
  items?: OrderItem[] | null;
  timeline?: OrderTimelineEntry[] | null;
  // Legacy orders carry a single commission object; newer ones an array.
  commission?: OrderCommission | OrderCommission[] | null;
  // Customer account; the b2b defaults are prefill, the order snapshot wins.
  customer?: ({ id?: string; first_name?: string | null; last_name?: string | null; email?: string | null } & CustomerB2bDefaults) | null;
  address?: OrderAddress | null;
  payouts?: { status?: string | null }[] | null;
}

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
    // Invoices app timeline rows.
    INVOICE_ISSUED: t('orderStatus.INVOICE_ISSUED'),
    CREDIT_NOTE_ISSUED: t('orderStatus.CREDIT_NOTE_ISSUED'),
    // Production app timeline row (internal, checklist reached 100 %).
    PRODUCTION_COMPLETED: t('orderStatus.PRODUCTION_COMPLETED'),
  };
}

// Order lifecycle flow; QUALITY_CHECK is an optional middle step.
const STATUS_FLOW = ['PENDING', 'CONFIRMED', 'PROCESSING', 'MANUFACTURING', 'QUALITY_CHECK', 'SHIPPED', 'DELIVERED'];

// FulfillmentStatus is a smaller enum (no CONFIRMED). Map onto STATUS_FLOW for comparison.
const FULFILLMENT_TO_FLOW: Record<string, string> = {
  PENDING:       'PENDING',
  PROCESSING:    'PROCESSING',
  MANUFACTURING: 'MANUFACTURING',
  QUALITY_CHECK: 'QUALITY_CHECK',
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

// QUALITY_CHECK is offered only when the production app is enabled with its
// quality-check step on (M4.3 §4.7); other stores keep today's dropdown.
function statusOptions(t: Translator, withQualityCheck: boolean) {
  return [
    { value: 'CONFIRMED', label: t('orderStatus.CONFIRMED') },
    { value: 'PROCESSING', label: t('orderStatus.PROCESSING') },
    { value: 'MANUFACTURING', label: t('orderStatus.MANUFACTURING') },
    ...(withQualityCheck
      ? [{ value: 'QUALITY_CHECK', label: t('orderStatus.QUALITY_CHECK') }]
      : []),
    { value: 'SHIPPED', label: t('orderStatus.SHIPPED') },
    { value: 'DELIVERED', label: t('orderStatus.DELIVERED') },
  ];
}

export default function CreatorOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const router = useRouter();
  const { fmt, currency } = useCurrency();
  const { storeType } = useStoreType();
  // Invoices app: writes need it enabled; documents stay readable after it is
  // switched off (L1), so the card is always mounted and hides itself when
  // there are no documents and nothing may be written.
  const { apps } = useStoreApps();
  const invoicesEnabled = isAppEnabled(apps, 'invoices');
  // Customer exemptions only take effect while reverse charge is on (M2.5).
  const reverseChargeOn =
    isAppEnabled(apps, 'b2b') &&
    normalizeB2bSettings(apps?.find((a) => a.key === 'b2b')?.settings).reverse_charge_enabled;
  const t = useTranslations('creator');
  const tp = useTranslations('payments');
  const uiLocale = useLocale();
  const STATUS_LABELS = statusLabels(t);
  // Designer app (M4.2): the design card stays readable while the app is
  // off (downloads only); it hides itself when the order has no designs.
  const designerEnabled = isAppEnabled(apps, 'designer');
  const designerAvailable = !!apps?.find((a) => a.key === 'designer')?.available;
  // Production app (M4.3): checklist card; `use_quality_check` defaults to true.
  const productionEnabled = isAppEnabled(apps, 'production');
  const qualityCheckEnabled =
    productionEnabled &&
    (apps?.find((a) => a.key === 'production')?.settings as
      | { use_quality_check?: unknown }
      | null
      | undefined)?.use_quality_check !== false;
  const STATUS_OPTIONS = statusOptions(t, qualityCheckEnabled);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [nextStatus, setNextStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [primaryLocale, setPrimaryLocale] = useState('en');
  const describeError = useApiError();

  useEffect(() => {
    if (!token) return;
    api<{ primary_locale: string }>('/translations/overview', { token })
      .then((res) => setPrimaryLocale(res?.primary_locale || 'en'))
      .catch(() => {});
  }, [token]);

  const fetchOrder = () => {
    if (!token || !id) return;
    setLoadError(false);
    api<Order>(`/orders/${id}`, { token })
      .then((data) => {
        setOrder(data);
        setNextStatus('');
      })
      .catch((err) => {
        console.error(err);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrder();
  }, [token, id]);

  const handleStatusUpdate = async () => {
    if (!token || !nextStatus) return;
    setUpdatingStatus(true);
    setStatusError('');
    try {
      await api(`/orders/${id}/status`, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          status: nextStatus,
          ...(statusNotes.trim() ? { note: statusNotes } : {}),
        }),
      });
      setStatusNotes('');
      fetchOrder();
    } catch (err) {
      // Localized by error code when the API sends one; else its message.
      setStatusError(describeError(err) || t('orderDetail.updateFailed'));
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
    // Distinguish a failed request (retryable) from a genuinely missing order.
    if (loadError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <p className="text-sm text-destructive">{t('orderDetail.loadFailed')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              fetchOrder();
            }}
          >
            {t('orderDetail.retry')}
          </Button>
        </div>
      );
    }
    return (
      <p className="text-center py-12 text-muted-foreground text-sm">{t('orderDetail.notFound')}</p>
    );
  }

  // Earnings: sum creator_amount from commission entries
  // Markets app: every amount of the order is in the order's own currency
  // (e.g. EUR on a SEK store); `fmt` formats in the store currency.
  const fmtOrder = (amount: number | string | null | undefined) =>
    order.currency && order.currency !== currency
      ? formatAmountIn(amount, order.currency)
      : fmt(amount);
  const totalEarnings = Array.isArray(order.commission)
    ? order.commission.reduce(
        (acc: number, c) => acc + Number(c.creator_amount ?? 0),
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
            {/* Market context (Markets app): market, hostname, locale, FX rate used. */}
            {order.market && (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[11px] bg-sky-50 text-sky-700 border-sky-200">
                  {t('orders.market')}: {order.market.name} · {order.market.currency}
                </Badge>
                {order.hostname && <span dir="ltr">{t('orders.marketHostname')}: {order.hostname}</span>}
                {order.locale && <span>{t('orders.marketLocale')}: {order.locale}</span>}
                {order.fx_rate_snapshot != null && (
                  <span dir="ltr">{t('orders.marketFxRate')}: {Number(order.fx_rate_snapshot)}</span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {/* Reverse charge / tax exempt (b2b app M2.5), from the order snapshot. */}
          <OrderTaxExemptBadge reason={order.tax_exempt_reason} className="text-xs" />
          <Badge
            variant="outline"
            className={`text-xs font-semibold ${statusColors[order.status] ?? ''}`}
          >
            {STATUS_LABELS[order.status] || order.status}
          </Badge>
        </div>
      </div>

      {/* 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column (main) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Production checklist (production app, creator-fulfilled lines only).
              `orderStatus` lets the card refresh itself when the status card
              moves the order (E3), without remounting it. */}
          {productionEnabled && canUpdateStatus && token && (
            <ProductionChecklist orderId={id} token={token} orderStatus={order.status} onOrderStatusChanged={() => fetchOrder()} />
          )}

          {/* Order items */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t('orderDetail.orderItems')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {order.items && order.items.length > 0 ? (
                  order.items.map((item) => {
                    // Title chain: custom product's own title → custom product's
                    // base product title → direct product → variant's product
                    // (when the order item references only a variant) → fallback.
                    // Prefer the store's primary locale over English.
                    const title =
                      item.custom_product?.translations?.find((t) => t.locale === primaryLocale)?.title ??
                      item.custom_product?.translations?.[0]?.title ??
                      item.custom_product?.product?.translations?.find((t) => t.locale === primaryLocale)?.title ??
                      item.custom_product?.product?.translations?.[0]?.title ??
                      item.product?.translations?.find((t) => t.locale === primaryLocale)?.title ??
                      item.product?.translations?.[0]?.title ??
                      item.variant?.product?.translations?.find((t) => t.locale === primaryLocale)?.title ??
                      item.variant?.product?.translations?.[0]?.title ??
                      '—';

                    // Image: custom product mockup → base product → variant's product.
                    const imgUrl =
                      item.image_url ??
                      item.custom_product?.mockup_images?.[0]?.url ??
                      item.custom_product?.product?.images?.[0]?.url ??
                      item.product?.images?.[0]?.url ??
                      item.variant?.product?.images?.[0]?.url;

                    // Variant options
                    const variantOpts = item.variant?.options as Record<string, string> | undefined;
                    const variantLabel = variantOpts
                      ? Object.entries(variantOpts).map(([k, v]) => `${k}: ${v}`).join(' · ')
                      : null;

                    const bundleOffer = item.bundle_offer ?? null;
                    const bundleTr =
                      bundleOffer?.translations?.find((tr) => tr.locale === primaryLocale) ??
                      bundleOffer?.translations?.[0];
                    const bundleNameTr =
                      bundleOffer?.bundle?.translations?.find((tr) => tr.locale === primaryLocale) ??
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
                                    className={`text-[11px] font-semibold shrink-0 ${
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
                              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
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
                                {t('orderDetail.each', { price: fmtOrder(unitPrice) })}
                                {originalUnitPrice !== null && originalUnitPrice > unitPrice && (
                                  <span className="line-through text-muted-foreground/70 tabular-nums">
                                    {fmtOrder(originalUnitPrice)}
                                  </span>
                                )}
                              </span>
                              <span className="ml-auto flex flex-col items-end">
                                <span className="font-semibold text-foreground text-sm">
                                  {fmtOrder(lineTotal)}
                                </span>
                                {originalLineTotal !== null && originalLineTotal > lineTotal && (
                                  <span className="text-[11px] line-through text-muted-foreground/70 tabular-nums">
                                    {fmtOrder(originalLineTotal)}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Custom field values (order snapshot; files with original download) */}
                        <GroupedOrderFieldValues
                          values={item.custom_field_values}
                          locale={uiLocale}
                          primaryLocale={primaryLocale}
                          token={token}
                        />

                        {/* Design notes */}
                        {item.design_notes && (
                          <p className="ms-17 text-xs text-muted-foreground italic">{t('orderDetail.note')}: {item.design_notes}</p>
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
                  <span>{fmtOrder(Number(order.subtotal ?? order.total))}</span>
                </div>
                {/* Shown when there is a cost or a chosen method (free pickup still names the method). */}
                {(Number(order.shipping_cost ?? 0) > 0 || order.shipping_method_name) && (
                  <div className="flex justify-between text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {t('orderDetail.shipping')}
                      {order.shipping_method_name && <span>({order.shipping_method_name})</span>}
                      {order.shipping_method_type === 'PICKUP' && (
                        <Badge variant="secondary" className="h-4 px-1.5 text-[11px]">{tp('pickup')}</Badge>
                      )}
                    </span>
                    <span>{fmtOrder(Number(order.shipping_cost ?? 0))}</span>
                  </div>
                )}
                {Number(order.discount_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>{t('orderDetail.discount')}</span>
                    <span>-{fmtOrder(Number(order.discount_amount))}</span>
                  </div>
                )}
                {/* Company orders (b2b app) read net-first: net total, then the
                    VAT rows, then the gross labelled "incl. VAT". */}
                {order.customer_type === 'COMPANY' && (
                  <div className="flex justify-between font-medium">
                    <span>{t('orderDetail.netTotal')}</span>
                    <span>{formatAmountIn(deriveNetTotals(order).net_total, order.currency || currency)}</span>
                  </div>
                )}
                {/* Itemised tax lines (one row per rate) in the order's own currency;
                    inclusive orders show what the total already contains. */}
                <OrderTaxLines order={order} currency={order.currency || currency} />
                <Separator />
                <div className="flex justify-between font-semibold text-base pt-1">
                  <span>{order.customer_type === 'COMPANY' && !order.tax_exempt_reason ? t('orderDetail.totalInclVat') : t('orderDetail.total')}</span>
                  {/* Order currency (market orders can differ from the store currency). */}
                  <span>{formatAmountIn(order.total, order.currency || currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Designer app (M4.2): proofs, texts, photos and print files of the
              designed lines; renders nothing when the order has no designs. */}
          {token && designerAvailable && (
            <OrderDesignCard
              orderId={id}
              token={token}
              appEnabled={designerEnabled}
              itemTitles={Object.fromEntries(
                (order.items ?? []).map((item) => [
                  item.id,
                  item.product?.translations?.find((tr) => tr.locale === primaryLocale)?.title ??
                    item.product?.translations?.[0]?.title ??
                    item.variant?.product?.translations?.find((tr) => tr.locale === primaryLocale)?.title ??
                    item.variant?.product?.translations?.[0]?.title ??
                    '',
                ]),
              )}
            />
          )}

          {/* Timeline */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t('orderDetail.timeline')}</CardTitle>
            </CardHeader>
            <CardContent>
              {order.timeline && order.timeline.length > 0 ? (
                <div className="space-y-3">
                  {order.timeline.map((entry, idx) => (
                    <div key={entry.id ?? idx} className="flex items-start gap-3">
                      <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{STATUS_LABELS[entry.status] || entry.status}</p>
                        <p className="text-[11px] text-muted-foreground">
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
                    <p className="text-[11px] text-muted-foreground">
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
                  {STATUS_LABELS[order.status] || order.status}
                </Badge>
                {statusError && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                    {statusError}
                  </div>
                )}
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
                  {STATUS_LABELS[order.status] || order.status}
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
              {/* Company snapshot (b2b app); renders nothing for person orders. */}
              <OrderCompanyLines order={order} customer={order.customer} />
              {/* Customer tax exemption (b2b app, D4/L7): active one or the action. */}
              {reverseChargeOn && token && (
                <CustomerTaxExemption
                  token={token}
                  orderId={id}
                  customerId={order.customer_id ?? order.customer?.id ?? null}
                  vatNumber={order.vat_validation?.vat_number ?? order.vat_number ?? null}
                />
              )}
            </CardContent>
          </Card>

          {/* Why this order carries no VAT (VIES evidence / manual exemption). */}
          <OrderTaxExemptionCard order={order} />

          {/* Invoices app: documents of this order, manual issue and credit notes. */}
          {token && (
            <OrderInvoiceCard orderId={id} token={token} appEnabled={invoicesEnabled} />
          )}

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
                {fmtOrder(totalEarnings)}
              </p>
              <p className="text-muted-foreground mt-1">
                {storeType === 'INDEPENDENT'
                  ? t('orderDetail.independentEarningsNote')
                  : t('orderDetail.creatorCommission')}
              </p>
              <div className="mt-3 space-y-1.5 border-t pt-2">
                {/* Payment status — surfaces refunds and failed payments */}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{tp('payment')}</span>
                  <Badge
                    variant="outline"
                    className={`text-[11px] ${
                      order.payment_status === 'paid'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : order.payment_status === 'refunded'
                          ? 'bg-zinc-100 text-zinc-700 border-zinc-200'
                          : order.payment_status === 'failed'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {order.payment_status === 'paid'
                      ? tp('statusPaid')
                      : order.payment_status === 'refunded'
                        ? tp('statusRefunded')
                        : order.payment_status === 'failed'
                          ? tp('statusFailed')
                          : tp('statusAwaiting')}
                  </Badge>
                </div>
                {/* Payout row — marketplace only. Independent stores are paid
                    directly via Stripe, so payout records are never created. */}
                {storeType !== 'INDEPENDENT' &&
                  (() => {
                    const myPayout = Array.isArray(order.payouts) ? order.payouts[0] : null;
                    return (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{tp('yourPayout')}</span>
                        {myPayout ? (
                          <Badge variant="outline" className={`text-[11px] ${myPayout.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            {myPayout.status === 'paid' ? tp('statusPaid') : tp('statusFailed')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px] bg-zinc-100 text-zinc-600 border-zinc-200">
                            {order.payment_status === 'paid'
                              ? tp('statusPending')
                              : order.payment_status === 'refunded'
                                ? tp('statusRefunded')
                                : tp('statusAwaiting')}
                          </Badge>
                        )}
                      </div>
                    );
                  })()}
                {/* Kustom orders: order id, capture state, manual capture / refund. */}
                {order.payment_method === 'KUSTOM' && token && (
                  <div className="border-t pt-2 mt-2">
                    <KustomPaymentPanel
                      orderId={id}
                      order={order}
                      token={token}
                      onRefresh={fetchOrder}
                      showProvider
                      currency={order.currency}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
