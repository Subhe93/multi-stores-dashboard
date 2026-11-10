'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Archive, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  archiveStatusColors,
  formatArchiveMoney,
  useArchiveStatusLabel,
} from '@/components/orders/ArchivedOrdersTab';

/**
 * Read-only detail of an archived WooCommerce order (plans/wp-order-archive,
 * M70): header, addresses, lines with their customisation meta, refunds and
 * a link to the matched product when the importer resolved one.
 */

interface ArchivedAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
}

interface ArchivedRefund {
  external_id: string;
  amount: string;
  reason: string | null;
  created_at: string;
}

interface ArchivedLine {
  id: string;
  position: number;
  name: string;
  sku: string | null;
  quantity: string | number;
  unit_price: string | number | null;
  line_total: string | number;
  line_tax: string | number;
  product_external_id: string | null;
  variation_external_id: string | null;
  product_id: string | null;
  meta: Record<string, unknown> | null;
  product: { id: string; name: string; slug: string } | null;
}

interface ArchivedOrderDetail {
  id: string;
  external_id: string;
  number: string;
  status: string;
  created_at_source: string;
  currency: string;
  subtotal: string | number;
  shipping_total: string | number;
  discount_total: string | number;
  tax_total: string | number;
  total: string | number;
  payment_method_title: string | null;
  shipping_method_title: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  billing_address: ArchivedAddress | null;
  shipping_address: ArchivedAddress | null;
  customer_note: string | null;
  refunds: ArchivedRefund[] | null;
  imported_at: string;
  lines: ArchivedLine[];
}

/** One customisation value as text: scalars as-is, lists joined, records as "k: v". */
function metaValueText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(metaValueText).join(', ');
  if (typeof value === 'object')
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${metaValueText(v)}`)
      .join(' · ');
  return String(value);
}

function AddressBlock({ address, fallbackName }: { address: ArchivedAddress | null; fallbackName?: string | null }) {
  const t = useTranslations('orders.archive');
  if (!address) return <p className="text-sm text-muted-foreground">{t('noAddress')}</p>;
  const name = [address.first_name, address.last_name].filter(Boolean).join(' ') || fallbackName;
  const cityLine = [address.postcode, address.city].filter(Boolean).join(' ');
  return (
    <div className="space-y-0.5 text-sm">
      {name && <p className="font-medium">{name}</p>}
      {address.company && <p>{address.company}</p>}
      {address.address_1 && <p>{address.address_1}</p>}
      {address.address_2 && <p>{address.address_2}</p>}
      {(cityLine || address.state) && <p>{[cityLine, address.state].filter(Boolean).join(', ')}</p>}
      {address.country && <p>{address.country}</p>}
      {address.email && <p className="text-muted-foreground">{address.email}</p>}
      {address.phone && <p className="text-muted-foreground">{address.phone}</p>}
    </div>
  );
}

export default function ArchivedOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { token } = useAuth();
  const t = useTranslations('orders.archive');
  const locale = useLocale();
  const statusLabel = useArchiveStatusLabel();
  const [order, setOrder] = useState<ArchivedOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!token || !params?.id) return;
    let cancelled = false;
    api<ArchivedOrderDetail>(`/archived-orders/${params.id}`, { token })
      .then((res) => {
        if (!cancelled) setOrder(res);
      })
      .catch((err: unknown) => {
        console.error(err);
        if (cancelled) return;
        // Only a 404 means "not found"; anything else is a load failure.
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, params?.id]);

  const fmtDate = (value: string | null | undefined) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">{t('loading')}</div>;
  if (notFound || loadError || !order)
    return (
      <div className="space-y-4">
        <Link href="/creator/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="size-4 rtl:rotate-180" /> {t('back')}
        </Link>
        <p className="text-sm text-destructive">{notFound ? t('notFound') : t('loadFailed')}</p>
      </div>
    );

  const money = (v: string | number | null | undefined) => formatArchiveMoney(v, order.currency, locale);
  const refunds = Array.isArray(order.refunds) ? order.refunds : [];
  const refundedTotal = refunds.reduce((n, r) => n + (parseFloat(String(r.amount)) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link href="/creator/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
            <ArrowLeft className="size-4 rtl:rotate-180" /> {t('back')}
          </Link>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
            <Archive className="size-5 text-muted-foreground" aria-hidden="true" />
            {t('detailTitle', { number: order.number })}
            <Badge variant="outline" className={`text-[11px] font-semibold ${archiveStatusColors[order.status] ?? ''}`}>
              {statusLabel(order.status)}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {fmtDate(order.created_at_source)} · {t('externalId')}: {order.external_id}
          </p>
        </div>
        <div className="text-end text-xs text-muted-foreground">
          <p>{t('readOnly')}</p>
          <p>
            {t('importedAt')}: {fmtDate(order.imported_at)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('customer')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{order.customer_name || '—'}</p>
            {order.customer_email && <p className="text-muted-foreground">{order.customer_email}</p>}
            {order.customer_phone && <p className="text-muted-foreground">{order.customer_phone}</p>}
            <Separator className="my-2" />
            <p>
              <span className="text-muted-foreground">{t('payment')}:</span> {order.payment_method_title || '—'}
            </p>
            <p>
              <span className="text-muted-foreground">{t('shippingMethod')}:</span> {order.shipping_method_title || '—'}
            </p>
            {order.customer_note && (
              <>
                <Separator className="my-2" />
                <p className="text-xs text-muted-foreground">{t('note')}</p>
                <p className="whitespace-pre-wrap">{order.customer_note}</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('billingAddress')}</CardTitle>
          </CardHeader>
          <CardContent>
            <AddressBlock address={order.billing_address} fallbackName={order.customer_name} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('shippingAddress')}</CardTitle>
          </CardHeader>
          <CardContent>
            <AddressBlock address={order.shipping_address} fallbackName={order.customer_name} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('linesTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.lines.length === 0 && <p className="text-sm text-muted-foreground">{t('noLines')}</p>}
          {order.lines.map((line) => (
            <div key={line.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">{line.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('qtyUnit', { qty: Number(line.quantity), unit: line.unit_price === null ? '—' : money(line.unit_price) })}
                    {line.sku && <> · SKU {line.sku}</>}
                    {line.product_external_id && (
                      <>
                        {' '}
                        · WC #{line.product_external_id}
                        {line.variation_external_id && `/${line.variation_external_id}`}
                      </>
                    )}
                  </p>
                  {line.product ? (
                    <Link
                      href={`/creator/products/own/${line.product.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <ExternalLink className="size-3" /> {t('matchedProduct', { name: line.product.name })}
                    </Link>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('noProduct')}</p>
                  )}
                </div>
                <div className="text-end text-sm">
                  <p className="font-medium">{money(line.line_total)}</p>
                  {Number(line.line_tax) !== 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t('lineTax')}: {money(line.line_tax)}
                    </p>
                  )}
                </div>
              </div>
              {line.meta && Object.keys(line.meta).length > 0 && (
                <dl className="mt-2 grid gap-x-4 gap-y-1 border-t pt-2 text-xs sm:grid-cols-[max-content_1fr]">
                  {Object.entries(line.meta).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="whitespace-pre-wrap break-words">{metaValueText(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))}
          <Separator />
          <dl className="ms-auto grid w-full max-w-xs grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{t('subtotal')}</dt>
            <dd className="text-end">{money(order.subtotal)}</dd>
            <dt className="text-muted-foreground">{t('shipping')}</dt>
            <dd className="text-end">{money(order.shipping_total)}</dd>
            {Number(order.discount_total) !== 0 && (
              <>
                <dt className="text-muted-foreground">{t('discount')}</dt>
                <dd className="text-end">-{money(order.discount_total)}</dd>
              </>
            )}
            <dt className="text-muted-foreground">{t('tax')}</dt>
            <dd className="text-end">{money(order.tax_total)}</dd>
            <dt className="font-medium">{t('total')}</dt>
            <dd className="text-end font-semibold">{money(order.total)}</dd>
            {refundedTotal > 0 && (
              <>
                <dt className="text-muted-foreground">{t('refunded')}</dt>
                <dd className="text-end text-destructive">-{money(refundedTotal)}</dd>
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      {refunds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('refundsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {refunds.map((r) => (
              <div key={r.external_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{money(r.amount)}</p>
                  <p className="text-xs text-muted-foreground">{r.reason || t('noReason')}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(r.created_at)} · WC #{r.external_id}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div>
        <Link href="/creator/orders" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          {t('back')}
        </Link>
      </div>
    </div>
  );
}
