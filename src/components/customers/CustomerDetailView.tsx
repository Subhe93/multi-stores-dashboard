'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Ban,
  CircleCheck,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShoppingBag,
  Wallet,
  Receipt,
  CalendarClock,
  Store as StoreIcon,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { StatCard } from '@/components/common/StatCard';
import { CustomerTaxExemption } from '@/components/apps/CustomerTaxExemption';
import { useAuth } from '@/lib/auth';
import { useCurrency } from '@/lib/useCurrency';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';
import { normalizeB2bSettings } from '@/lib/b2b';
import {
  customerName,
  isBannedStatus,
  isBlockedStatus,
  normalizeCustomerDetail,
  type CustomerDetail,
  type CustomerType,
} from '@/lib/customers';
import {
  BLOCKED_STATUS,
  getCustomer,
  sendLoginLink,
  sendPasswordReset,
  setCustomerStatus,
  updateCustomer,
  type CustomerScope,
} from '@/lib/customers.api';
import { CustomerStatusBadge, RelativeDate, formatMoney, useDateFormatter } from './shared';
import { useCustomerError } from './useCustomerError';

const ORDER_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  MANUFACTURING: 'bg-purple-50 text-purple-700 border-purple-200',
  QUALITY_CHECK: 'bg-orange-50 text-orange-700 border-orange-200',
  SHIPPED: 'bg-sky-50 text-sky-700 border-sky-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  REFUNDED: 'bg-zinc-100 text-zinc-700 border-zinc-200',
};

interface ProfileForm {
  first_name: string;
  last_name: string;
  phone: string;
  customer_type: '' | CustomerType;
  company_name: string;
  org_number: string;
  vat_number: string;
}

function toForm(c: CustomerDetail): ProfileForm {
  return {
    first_name: c.first_name,
    last_name: c.last_name,
    phone: c.phone ?? '',
    customer_type: c.customer_type ?? '',
    company_name: c.company_name ?? '',
    org_number: c.org_number ?? '',
    vat_number: c.vat_number ?? '',
  };
}

type PendingAction = 'login-link' | 'password-reset' | 'block' | 'unblock' | null;

/** Customer detail shared by the creator page (editable) and the admin page (read-only, with store). */
export function CustomerDetailView({ scope }: { scope: CustomerScope }) {
  const t = useTranslations('creator.customers');
  const ta = useTranslations('admin.customersPage');
  const tStatus = useTranslations('creator.orderStatus');
  const tc = useTranslations('common');
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { fmt } = useCurrency();
  const fmtDate = useDateFormatter();
  const describeError = useCustomerError();
  const isAdmin = scope === 'admin';
  const listPath = isAdmin ? '/admin/customers' : '/creator/customers';
  const orderPath = (orderId: string) => (isAdmin ? `/admin/orders/${orderId}` : `/creator/orders/${orderId}`);

  const { apps } = useStoreApps();
  const b2bEnabled = !isAdmin && isAppEnabled(apps, 'b2b');
  const reverseChargeOn =
    b2bEnabled && normalizeB2bSettings(apps?.find((a) => a.key === 'b2b')?.settings).reverse_charge_enabled;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoadError(null);
    try {
      const raw = await getCustomer(token, scope, id);
      setCustomer(normalizeCustomerDetail(raw));
    } catch (err) {
      setLoadError(describeError(err));
    } finally {
      setLoading(false);
    }
    // describeError is rebuilt every render; token/id/scope are the inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const money = (amount: number | string | null | undefined, currency?: string | null) =>
    formatMoney(amount, currency ?? customer?.stats.currency, fmt);

  const startEdit = () => {
    if (!customer) return;
    setForm(toForm(customer));
    setFormError(null);
    setEditing(true);
  };

  const saveProfile = async () => {
    if (!token || !customer || !form) return;
    setSaving(true);
    setFormError(null);
    try {
      const company = form.customer_type === 'COMPANY';
      await updateCustomer(token, customer.id, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || null,
        ...(b2bEnabled || customer.customer_type
          ? {
              customer_type: form.customer_type || null,
              company_name: company ? form.company_name.trim() || null : null,
              org_number: company ? form.org_number.trim() || null : null,
              vat_number: company ? form.vat_number.trim() || null : null,
            }
          : {}),
      });
      setEditing(false);
      setNotice(t('detail.saved'));
      await load();
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async () => {
    if (!token || !customer || !pending) return;
    setBusy(true);
    setActionError(null);
    try {
      if (pending === 'login-link') {
        await sendLoginLink(token, customer.id);
        setNotice(t('detail.loginLinkSent', { email: customer.email }));
      } else if (pending === 'password-reset') {
        await sendPasswordReset(token, customer.id);
        setNotice(t('detail.resetSent', { email: customer.email }));
      } else {
        await setCustomerStatus(token, scope, customer, pending === 'block' ? BLOCKED_STATUS : 'ACTIVE');
        setNotice(pending === 'block' ? t('detail.blocked') : t('detail.unblocked'));
        await load();
      }
      setPending(null);
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (loadError || !customer) {
    return (
      <div className="space-y-4">
        <Link href={listPath} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {t('detail.back')}
        </Link>
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <p className="text-sm text-destructive">{loadError ?? t('errors.notFound')}</p>
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); void load(); }}>
            {t('retry')}
          </Button>
        </div>
      </div>
    );
  }

  const blocked = isBlockedStatus(customer.status);
  // A platform ban is the admin's: the store owner sees it but cannot change it.
  const bannedForOwner = !isAdmin && isBannedStatus(customer.status);
  const name = customerName(customer);
  const isCompany = customer.customer_type === 'COMPANY';
  const latestOrderId = customer.orders[0]?.id ?? null;

  const confirmCopy: Record<Exclude<PendingAction, null>, { title: string; description: string; label: string; destructive?: boolean }> = {
    'login-link': {
      title: t('confirmLoginLink.title'),
      description: t('confirmLoginLink.description', { email: customer.email }),
      label: t('actions.sendLoginLink'),
    },
    'password-reset': {
      title: t('confirmReset.title'),
      description: t('confirmReset.description', { email: customer.email }),
      label: t('actions.sendPasswordReset'),
    },
    block: {
      title: t('confirmBlock.title', { name }),
      description: t('confirmBlock.description'),
      label: t('actions.block'),
      destructive: true,
    },
    unblock: {
      title: t('confirmUnblock.title', { name }),
      description: t('confirmUnblock.description'),
      label: t('actions.unblock'),
    },
  };
  const copy = pending ? confirmCopy[pending] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Link href={listPath} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {isAdmin ? ta('title') : t('title')}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">{name}</h1>
              <CustomerStatusBadge status={customer.status} />
              {isCompany && (
                <Badge variant="outline" className="text-[11px] font-medium bg-violet-50 text-violet-700 border-violet-200">
                  {t('companyBadge')}
                </Badge>
              )}
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5" /><span dir="ltr">{customer.email}</span></span>
              {customer.created_at && <span>{t('detail.customerSince', { date: fmtDate(customer.created_at) })}</span>}
              {isAdmin && customer.store && (
                <span className="inline-flex items-center gap-1.5">
                  <StoreIcon className="size-3.5" />
                  {customer.store.name}
                  <span className="text-xs">({customer.store.slug})</span>
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isAdmin && (
              <>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setActionError(null); setPending('login-link'); }} disabled={blocked}>
                  <KeyRound className="size-3.5 me-1.5" />
                  {t('actions.sendLoginLink')}
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setActionError(null); setPending('password-reset'); }} disabled={blocked}>
                  <Mail className="size-3.5 me-1.5" />
                  {t('actions.sendPasswordReset')}
                </Button>
              </>
            )}
            {bannedForOwner ? (
              <Tooltip>
                <TooltipTrigger render={<span className="inline-flex" tabIndex={0} />}>
                  <Button variant="outline" size="sm" className="h-8 text-xs" disabled aria-describedby="customer-banned-hint">
                    <Ban className="size-3.5 me-1.5" />
                    {t('actions.bannedByPlatform')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('detail.bannedTooltip')}</TooltipContent>
              </Tooltip>
            ) : blocked ? (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setActionError(null); setPending('unblock'); }}>
                <CircleCheck className="size-3.5 me-1.5" />
                {t('actions.unblock')}
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="h-8 text-xs text-red-600 hover:text-red-700" onClick={() => { setActionError(null); setPending('block'); }}>
                <Ban className="size-3.5 me-1.5" />
                {t('actions.block')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {notice && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 opacity-70 hover:opacity-100" aria-label={t('dismiss')}>
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {blocked && (
        <div id="customer-banned-hint" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {bannedForOwner ? t('detail.bannedNotice') : t('detail.blockedNotice')}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title={t('stats.orders')} value={customer.stats.orders_count} icon={<ShoppingBag className="size-4" />} />
        <StatCard title={t('stats.totalSpent')} value={money(customer.stats.total_spent)} icon={<Wallet className="size-4" />} />
        <StatCard title={t('stats.averageOrder')} value={money(customer.stats.average_order)} icon={<Receipt className="size-4" />} />
        <Card className="shadow-none">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[12px] font-medium text-muted-foreground">{t('stats.lastOrder')}</p>
                <p className="mt-1 text-lg font-bold tracking-tight">
                  {customer.stats.last_order_at ? fmtDate(customer.stats.last_order_at) : '—'}
                </p>
                {customer.stats.last_order_at && <RelativeDate value={customer.stats.last_order_at} />}
              </div>
              <div className="flex size-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                <CalendarClock className="size-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Orders */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t('detail.orders')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {customer.orders.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">{t('detail.noOrders')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-2 text-start font-semibold">{t('detail.colOrder')}</th>
                        <th className="px-4 py-2 text-start font-semibold">{t('detail.colDate')}</th>
                        <th className="px-4 py-2 text-start font-semibold">{tc('status')}</th>
                        <th className="px-4 py-2 text-end font-semibold">{t('detail.colTotal')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.orders.map((o) => (
                        <tr key={o.id} className="border-b last:border-b-0 hover:bg-zinc-50">
                          <td className="px-4 py-2.5">
                            <Link href={orderPath(o.id)} className="font-mono text-sm font-medium hover:underline">
                              {o.order_number}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmtDate(o.created_at)}</td>
                          <td className="px-4 py-2.5">
                            <Badge variant="outline" className={`text-[11px] font-semibold ${ORDER_STATUS_STYLES[o.status] ?? ''}`}>
                              {tStatus.has(o.status) ? tStatus(o.status) : o.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-end font-medium tabular-nums">{money(o.total, o.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {customer.orders.length > 0 && customer.stats.all_orders_count > customer.orders.length && (
                <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
                  {t('detail.showingRecent', { shown: customer.orders.length, total: customer.stats.all_orders_count })}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Addresses */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t('detail.addresses')}</CardTitle>
            </CardHeader>
            <CardContent>
              {customer.addresses.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('detail.noAddresses')}</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {customer.addresses.map((a) => (
                    <div key={a.id} className="rounded-lg border p-3 text-xs leading-relaxed">
                      <div className="mb-1 flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-muted-foreground" />
                        <span className="font-medium">{a.label || a.full_name}</span>
                        {a.is_default && (
                          <Badge variant="outline" className="ms-auto text-[10px]">{t('detail.defaultAddress')}</Badge>
                        )}
                      </div>
                      {a.label && <p>{a.full_name}</p>}
                      {a.company_name && <p>{a.company_name}{a.org_number ? ` · ${a.org_number}` : ''}</p>}
                      <p>{a.line1}</p>
                      {a.line2 && <p>{a.line2}</p>}
                      <p>{[a.postal_code, a.city].filter(Boolean).join(' ')}{a.state ? `, ${a.state}` : ''}</p>
                      <p>{a.country_code}</p>
                      {a.phone && <p className="text-muted-foreground" dir="ltr">{a.phone}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Profile and B2B */}
        <div className="space-y-6">
          <Card className="shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold">{t('detail.profile')}</CardTitle>
              {!isAdmin && !editing && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={startEdit}>
                  <Pencil className="size-3.5 me-1" />
                  {tc('edit')}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {editing && form ? (
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveProfile();
                  }}
                >
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="cust-first" className="text-xs">{t('fields.firstName')}</Label>
                      <Input id="cust-first" className="h-8 text-sm" value={form.first_name}
                        onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cust-last" className="text-xs">{t('fields.lastName')}</Label>
                      <Input id="cust-last" className="h-8 text-sm" value={form.last_name}
                        onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cust-phone" className="text-xs">{t('fields.phone')}</Label>
                    <Input id="cust-phone" type="tel" className="h-8 text-sm" value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  {(b2bEnabled || customer.customer_type) && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('fields.customerType')}</Label>
                        <SearchableSelect
                          value={form.customer_type}
                          onChange={(v) => setForm({ ...form, customer_type: v as ProfileForm['customer_type'] })}
                          options={[
                            { value: '', label: t('fields.typeUnset') },
                            { value: 'PERSON', label: t('filters.person') },
                            { value: 'COMPANY', label: t('filters.company') },
                          ]}
                        />
                      </div>
                      {form.customer_type === 'COMPANY' && (
                        <>
                          <div className="space-y-1">
                            <Label htmlFor="cust-company" className="text-xs">{t('fields.companyName')}</Label>
                            <Input id="cust-company" className="h-8 text-sm" value={form.company_name}
                              onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label htmlFor="cust-org" className="text-xs">{t('fields.orgNumber')}</Label>
                              <Input id="cust-org" className="h-8 text-sm" value={form.org_number} maxLength={32}
                                onChange={(e) => setForm({ ...form, org_number: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="cust-vat" className="text-xs">{t('fields.vatNumber')}</Label>
                              <Input id="cust-vat" className="h-8 text-sm" value={form.vat_number} maxLength={32}
                                onChange={(e) => setForm({ ...form, vat_number: e.target.value })} />
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  {formError && (
                    <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {formError}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditing(false)} disabled={saving}>
                      {tc('cancel')}
                    </Button>
                    <Button type="submit" size="sm" className="h-8 text-xs" disabled={saving}>
                      {saving ? tc('saving') : tc('save')}
                    </Button>
                  </div>
                </form>
              ) : (
                <dl className="space-y-2.5 text-xs">
                  <ProfileLine label={t('fields.name')} value={`${customer.first_name} ${customer.last_name}`.trim() || '—'} />
                  <ProfileLine label={t('fields.email')} value={customer.email} ltr />
                  <ProfileLine
                    label={t('fields.phone')}
                    value={customer.phone ? <span className="inline-flex items-center gap-1"><Phone className="size-3" />{customer.phone}</span> : '—'}
                    ltr
                  />
                  {customer.customer_type && (
                    <ProfileLine
                      label={t('fields.customerType')}
                      value={isCompany ? t('filters.company') : t('filters.person')}
                    />
                  )}
                  {isCompany && (
                    <>
                      <ProfileLine label={t('fields.companyName')} value={customer.company_name || '—'} />
                      <ProfileLine label={t('fields.orgNumber')} value={customer.org_number || '—'} ltr />
                      <ProfileLine label={t('fields.vatNumber')} value={customer.vat_number || '—'} ltr />
                    </>
                  )}
                </dl>
              )}
            </CardContent>
          </Card>

          {/* Tax exemption (b2b app). The exemption dialog needs an order as
              evidence, so customers without orders see the status only. */}
          {(reverseChargeOn || customer.tax_exemption) && (
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{t('detail.taxExemption')}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs">
                {reverseChargeOn && token && latestOrderId ? (
                  <CustomerTaxExemption
                    token={token}
                    orderId={latestOrderId}
                    customerId={customer.id}
                    vatNumber={customer.vat_number}
                  />
                ) : customer.tax_exemption ? (
                  <p>
                    {t('detail.exemptSince', { date: fmtDate(customer.tax_exemption.created_at) })}
                    {customer.tax_exemption.vat_number && (
                      <span className="block text-muted-foreground" dir="ltr">{customer.tax_exemption.vat_number}</span>
                    )}
                  </p>
                ) : (
                  <p className="text-muted-foreground">{t('detail.noExemption')}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => { if (!o) { setPending(null); setActionError(null); } }}
        title={copy?.title}
        description={copy?.description}
        confirmLabel={copy?.label}
        destructive={copy?.destructive}
        busy={busy}
        busyLabel={t('working')}
        error={actionError}
        onConfirm={() => void runAction()}
      />
    </div>
  );
}

function ProfileLine({ label, value, ltr }: { label: string; value: React.ReactNode; ltr?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-medium break-all">
        <span dir={ltr ? 'ltr' : undefined}>{value}</span>
      </dd>
    </div>
  );
}
