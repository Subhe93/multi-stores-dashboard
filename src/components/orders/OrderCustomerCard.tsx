'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Copy, Loader2, Mail, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';
import { getCustomer, type CustomerScope } from '@/lib/customers.api';
import { isBlockedStatus, normalizeCustomerDetail, type CustomerDetail } from '@/lib/customers';
import { CustomerStatusBadge, formatMoney, useDateFormatter } from '@/components/customers/shared';

/** Address shape shared by the order's shipping address and Kustom's billing address. */
export interface CardAddress {
  full_name?: string | null;
  company_name?: string | null;
  line1?: string | null;
  street?: string | null;
  line2?: string | null;
  apartment?: string | null;
  city?: string | null;
  region?: string | null;
  state?: string | null;
  zip?: string | null;
  postal_code?: string | null;
  country?: string | null;
  country_code?: string | null;
  phone?: string | null;
}

/** The order fields this card reads (GET /orders/:id). */
export interface OrderCustomerCardOrder {
  id: string;
  customer_id?: string | null;
  payment_method?: string | null;
  locale?: string | null;
  market?: { name: string } | null;
  customer?: {
    id?: string;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    email?: string | null;
    // Account email / status (user row), returned by the order detail API.
    user?: { email?: string | null; status?: string | null } | null;
  } | null;
  address?: CardAddress | null;
}

interface KustomStatusBilling {
  synced?: string | null;
  billing_address?: CardAddress | null;
}

interface Props {
  scope: CustomerScope;
  token: string | null;
  order: OrderCustomerCardOrder;
  /** Re-fetches the order (a Kustom status read may have corrected it). */
  onOrderChanged?: () => void;
  /** Extra rows under the contact block (company snapshot, tax exemption). */
  children?: ReactNode;
}

const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

function line1Of(a: CardAddress) {
  return a.line1 ?? a.street ?? null;
}
function postalOf(a: CardAddress) {
  return a.postal_code ?? a.zip ?? null;
}
function countryOf(a: CardAddress) {
  return a.country_code ?? a.country ?? null;
}

/** Same postal destination (and recipient name when both carry one). */
function sameAddress(a: CardAddress, b: CardAddress): boolean {
  const nameA = norm(a.full_name);
  const nameB = norm(b.full_name);
  return (
    (!nameA || !nameB || nameA === nameB) &&
    norm(line1Of(a)) === norm(line1Of(b)) &&
    norm(a.line2 ?? a.apartment) === norm(b.line2 ?? b.apartment) &&
    norm(postalOf(a)).replace(/\s/g, '') === norm(postalOf(b)).replace(/\s/g, '') &&
    norm(a.city) === norm(b.city) &&
    norm(countryOf(a)) === norm(countryOf(b))
  );
}

function CopyButton({ value, label, copiedLabel }: { value: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access denied: nothing to do.
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? copiedLabel : label}
      aria-label={copied ? copiedLabel : label}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
    </button>
  );
}

/**
 * Shopify-like customer card of an order detail page: name (links to the
 * customer page), contact with copy, store stats of the customer (loaded
 * lazily, skipped on error), billing address, order language / market.
 */
export function OrderCustomerCard({ scope, token, order, onOrderChanged, children }: Props) {
  const t = useTranslations('creator');
  const uiLocale = useLocale();
  const formatDate = useDateFormatter();
  const { fmt } = useCurrency();
  const customerId = order.customer_id ?? order.customer?.id ?? null;

  // Customer profile + stats in this store; the card works without it.
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  useEffect(() => {
    if (!token || !customerId) return;
    let alive = true;
    getCustomer(token, scope, customerId)
      .then((raw) => {
        if (alive) setDetail(normalizeCustomerDetail(raw));
      })
      .catch(() => {
        // 404 (customer of another store) or network error: no stats line.
      });
    return () => {
      alive = false;
    };
  }, [token, scope, customerId]);

  // Kustom keeps the billing address the shopper typed in its iframe; the
  // order stores only the shipping address, so it is read on demand.
  const isKustom = order.payment_method === 'KUSTOM';
  const [billing, setBilling] = useState<CardAddress | null | undefined>(undefined);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState(false);
  const loadBilling = async () => {
    if (!token || billingLoading) return;
    setBillingLoading(true);
    setBillingError(false);
    try {
      const res = await api<KustomStatusBilling>(`/payments/kustom/orders/${order.id}/status`, { token });
      setBilling(res?.billing_address ?? null);
      if (res?.synced) onOrderChanged?.();
    } catch {
      setBillingError(true);
    } finally {
      setBillingLoading(false);
    }
  };

  const firstName = order.customer?.first_name ?? detail?.first_name ?? '';
  const lastName = order.customer?.last_name ?? detail?.last_name ?? '';
  const name = `${firstName} ${lastName}`.trim();
  const email = order.customer?.user?.email ?? order.customer?.email ?? detail?.email ?? null;
  const phone = order.address?.phone ?? order.customer?.phone ?? detail?.phone ?? null;
  const accountStatus = order.customer?.user?.status ?? detail?.status ?? null;
  const customerHref = customerId
    ? scope === 'admin'
      ? `/admin/customers/${customerId}`
      : `/creator/customers/${customerId}`
    : null;

  const regionName = (code: string | null) => {
    if (!code) return null;
    if (code.length !== 2) return code;
    try {
      return new Intl.DisplayNames([uiLocale], { type: 'region' }).of(code.toUpperCase()) ?? code;
    } catch {
      return code;
    }
  };
  const languageName = (code: string | null | undefined) => {
    if (!code) return null;
    try {
      return new Intl.DisplayNames([uiLocale], { type: 'language' }).of(code) ?? code;
    } catch {
      return code;
    }
  };

  const stats = detail?.stats;
  const ordersCount = stats?.all_orders_count ?? 0;

  const renderAddress = (a: CardAddress) => (
    <div className="space-y-0.5">
      {a.full_name && <p>{a.full_name}</p>}
      {a.company_name && <p>{a.company_name}</p>}
      {line1Of(a) && <p>{line1Of(a)}</p>}
      {(a.line2 ?? a.apartment) && <p>{a.line2 ?? a.apartment}</p>}
      <p>{[postalOf(a), a.city].filter(Boolean).join(' ')}</p>
      {countryOf(a) && <p>{regionName(countryOf(a))}</p>}
      {a.phone && (
        <p dir="ltr" className="text-start">
          {a.phone}
        </p>
      )}
    </div>
  );

  let billingBlock: ReactNode;
  if (!isKustom || billing === null) {
    // Card / cash checkouts collect one address: billing = shipping.
    billingBlock = <p className="text-muted-foreground">{t('orderDetail.sameAsShipping')}</p>;
  } else if (billing === undefined) {
    billingBlock = (
      <div className="space-y-1">
        <p className="text-muted-foreground">{t('orderDetail.billingAtKustom')}</p>
        <button
          type="button"
          onClick={loadBilling}
          disabled={billingLoading || !token}
          className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-60"
        >
          {billingLoading && <Loader2 className="size-3 animate-spin" />}
          {t('orderDetail.loadBillingAddress')}
        </button>
        {billingError && <p className="text-destructive">{t('orderDetail.billingLoadFailed')}</p>}
      </div>
    );
  } else if (order.address && sameAddress(billing, order.address)) {
    billingBlock = <p className="text-muted-foreground">{t('orderDetail.sameAsShipping')}</p>;
  } else {
    billingBlock = renderAddress(billing);
  }

  const language = languageName(order.locale);

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{t('orderDetail.customer')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {/* Identity + store stats */}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {customerHref ? (
              <Link href={customerHref} className="font-medium text-sm text-primary hover:underline">
                {name || email || '—'}
              </Link>
            ) : (
              <p className="font-medium text-sm">{name || email || '—'}</p>
            )}
            {accountStatus && isBlockedStatus(accountStatus) && <CustomerStatusBadge status={accountStatus} />}
          </div>
          {stats && (
            <>
              <p className="text-muted-foreground">
                {t('orderDetail.customerOrderCount', { count: ordersCount })}
                {stats.total_spent > 0 && (
                  <>
                    {' · '}
                    {t('orderDetail.customerTotalSpent', {
                      amount: formatMoney(stats.total_spent, stats.currency, fmt),
                    })}
                  </>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={`text-[11px] ${
                    ordersCount <= 1
                      ? 'bg-sky-50 text-sky-700 border-sky-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {ordersCount <= 1 ? t('orderDetail.firstOrder') : t('orderDetail.returningCustomer')}
                </Badge>
                {detail?.created_at && (
                  <span className="text-muted-foreground">
                    {t('orderDetail.customerSince', { date: formatDate(detail.created_at) })}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Contact */}
        <div className="space-y-1 border-t pt-3">
          <p className="font-medium text-muted-foreground">{t('orderDetail.contactInfo')}</p>
          <div className="flex min-w-0 items-center gap-1.5">
            <Mail className="size-3.5 shrink-0 text-muted-foreground" />
            {email ? (
              <>
                <a href={`mailto:${email}`} dir="ltr" className="min-w-0 truncate text-primary hover:underline">
                  {email}
                </a>
                <CopyButton value={email} label={t('orderDetail.copy')} copiedLabel={t('orderDetail.copied')} />
              </>
            ) : (
              <span className="text-muted-foreground">{t('orderDetail.noEmail')}</span>
            )}
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <Phone className="size-3.5 shrink-0 text-muted-foreground" />
            {phone ? (
              <>
                <a
                  href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                  dir="ltr"
                  className="min-w-0 truncate text-primary hover:underline"
                >
                  {phone}
                </a>
                <CopyButton value={phone} label={t('orderDetail.copy')} copiedLabel={t('orderDetail.copied')} />
              </>
            ) : (
              <span className="text-muted-foreground">{t('orderDetail.noPhone')}</span>
            )}
          </div>
          {children}
        </div>

        {/* Billing address */}
        <div className="space-y-1 border-t pt-3">
          <p className="font-medium text-muted-foreground">{t('orderDetail.billingAddress')}</p>
          {billingBlock}
        </div>

        {/* Order language / market */}
        {(language || order.market) && (
          <p className="border-t pt-3 text-[11px] text-muted-foreground">
            {language && (
              <span>
                {t('orders.marketLocale')}: {language}
              </span>
            )}
            {language && order.market && ' · '}
            {order.market && (
              <span>
                {t('orders.market')}: {order.market.name}
              </span>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
