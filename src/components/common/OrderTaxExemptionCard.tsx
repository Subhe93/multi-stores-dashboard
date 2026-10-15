'use client';

import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { countryLabel } from '@/lib/taxCountries';
import { vatCountryMismatch, type OrderTaxExemptionFields, type TaxExemptReason } from '@/lib/b2b';

interface ExemptBadgeProps {
  reason: TaxExemptReason | null | undefined;
  className?: string;
}

/** "Reverse charge" / "Tax exempt" badge; renders nothing for taxed orders. */
export function OrderTaxExemptBadge({ reason, className = '' }: ExemptBadgeProps) {
  const t = useTranslations('creator.orderDetail.taxExemption');
  if (!reason) return null;
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-medium bg-teal-50 text-teal-700 border-teal-200 ${className}`}
    >
      {reason === 'REVERSE_CHARGE' ? t('reverseCharge') : t('customerExempt')}
    </Badge>
  );
}

interface OrderTaxExemptionCardProps {
  order: OrderTaxExemptionFields & { address?: { country?: string | null; country_code?: string | null } | null };
}

/**
 * Evidence of why an order carries no VAT (b2b app, M2.5): the VIES result
 * snapshotted on `order.vat_validation`, or the manual customer exemption.
 * Read-only; keyed on the order snapshot, so it renders even after the app
 * is switched off. Renders nothing for taxed orders.
 */
export function OrderTaxExemptionCard({ order }: OrderTaxExemptionCardProps) {
  const t = useTranslations('creator.orderDetail.taxExemption');
  const locale = useLocale();
  const reason = order.tax_exempt_reason;
  if (!reason) return null;
  const ev = order.vat_validation ?? null;
  const manual = ev?.source === 'MANUAL';
  const destination = (ev?.destination_country || order.address?.country_code || '').toUpperCase();
  const vatCountry = ev ? (ev.country_code === 'EL' ? 'GR' : ev.country_code) : '';
  const mismatch = reason === 'REVERSE_CHARGE' && vatCountryMismatch(ev ? { ...ev, destination_country: destination || undefined } : null);
  const fmtDate = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(locale);
  };

  const rows: Array<{ key: string; label: string; value: React.ReactNode; mono?: boolean }> = [];
  if (ev) {
    if (ev.vat_number) rows.push({ key: 'vat', label: t('vatNumber'), value: ev.vat_number, mono: true });
    if (vatCountry) rows.push({ key: 'country', label: t('vatCountry'), value: countryLabel(vatCountry, locale) });
    if (destination) rows.push({ key: 'dest', label: t('destination'), value: countryLabel(destination, locale) });
    if (!manual) {
      rows.push({
        key: 'valid',
        label: t('viesStatus'),
        value: ev.valid ? t('viesValid') : t('viesNotValid'),
      });
      if (ev.name) rows.push({ key: 'name', label: t('viesName'), value: ev.name });
      if (ev.address) rows.push({ key: 'address', label: t('viesAddress'), value: ev.address });
      rows.push({ key: 'checked', label: t('checkedAt'), value: fmtDate(ev.checked_at) });
      rows.push({
        key: 'ref',
        label: t('viesRef'),
        value: ev.request_identifier || t('viesRefNone'),
        mono: !!ev.request_identifier,
      });
    } else {
      rows.push({
        key: 'kind',
        label: t('exemptionKind'),
        value: ev.exemption_kind === 'FULL' ? t('kindFull') : t('kindReverseCharge'),
      });
      rows.push({ key: 'applied', label: t('appliedAt'), value: fmtDate(ev.exemption_created_at ?? ev.checked_at) });
    }
  }

  return (
    <Card className="shadow-none border-teal-100">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-teal-600" />
          {t('title')}
          <OrderTaxExemptBadge reason={reason} className="ms-auto" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <p className="text-muted-foreground leading-relaxed">
          {manual
            ? t('manualSummary')
            : reason === 'REVERSE_CHARGE'
              ? t('reverseChargeSummary')
              : t('customerExemptSummary')}
        </p>
        {rows.length > 0 && (
          <div className="space-y-1 border-t pt-2">
            {rows.map((row) => (
              <p key={row.key} className="flex justify-between gap-3">
                <span className="shrink-0 text-muted-foreground">{row.label}</span>
                <span
                  dir={row.mono ? 'ltr' : undefined}
                  className={`text-end wrap-break-word ${row.mono ? 'font-mono' : ''} ${row.key === 'address' ? 'whitespace-pre-line' : ''}`}
                >
                  {row.value}
                </span>
              </p>
            ))}
          </div>
        )}
        {mismatch && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {t('countryMismatch', {
                vatCountry: countryLabel(vatCountry, locale),
                destination: countryLabel(destination, locale),
              })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
