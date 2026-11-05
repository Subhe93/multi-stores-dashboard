'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/useApiError';
import { useMyStore } from '@/lib/useMyStore';
import { taxCountryOptions } from '@/lib/taxCountries';
import type { TraderDetails } from '@/lib/storeStatus';
import { cn } from '@/lib/utils';

type Form = Omit<TraderDetails, 'completed_at' | 'business_type' | 'vat_check'> & { business_type: 'company' | 'private' | '' };

const EMPTY: Form = {
  legal_name: '',
  business_type: '',
  org_number: '',
  vat_number: '',
  address_line1: '',
  address_line2: '',
  postal_code: '',
  city: '',
  country: 'SE',
  phone: '',
  support_email: '',
};

type FieldKey = keyof Form;

/**
 * Legal trader details (SPEC §1/§3, `PUT /stores/my/trader-details`): what
 * e-handelslagen requires before a store may sell. Field errors come from
 * the API's `fields` on TRADER_DETAILS_INVALID.
 */
export function TraderDetailsForm({ onSaved }: { onSaved?: () => void }) {
  const { store, loading, refetch } = useMyStore();
  return (
    <LegalDetailsFormCard
      details={store?.trader_details}
      loading={loading}
      complete={!!store?.golive_checklist?.trader_details_complete || !!store?.trader_details?.completed_at}
      saveEndpoint="/stores/my/trader-details"
      onSaved={() => {
        refetch();
        onSaved?.();
      }}
    />
  );
}

/** Texts that differ per owner (store vs provider); defaults are the store's. */
export interface LegalDetailsTexts {
  title?: string;
  subtitle?: string;
  saved?: string;
  supportEmailHint?: string;
}

export interface LegalDetailsFormCardProps {
  /** Stored record (same shape for stores and providers). */
  details: TraderDetails | null | undefined;
  loading: boolean;
  complete: boolean;
  /** PUT endpoint validated with the trader-details rules (+ VIES). */
  saveEndpoint: string;
  /** Called after a successful save (reload the stored record here). */
  onSaved?: () => void;
  texts?: LegalDetailsTexts;
  /** DOM id of the card (anchor target). */
  id?: string;
}

/**
 * The legal identity form shared by the store trader details and the
 * provider legal details: same fields, same API rules and error codes
 * (TRADER_DETAILS_INVALID `fields`, TRADER_VAT_INVALID).
 */
export function LegalDetailsFormCard({ details, loading, complete, saveEndpoint, onSaved, texts, id }: LegalDetailsFormCardProps) {
  const { token } = useAuth();
  const t = useTranslations('creator.traderDetails');
  const tc = useTranslations('common');
  const locale = useLocale();
  const describe = useApiError();
  const [form, setForm] = useState<Form>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [vatRejected, setVatRejected] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (loading || hydrated) return;
    const td = details;
    if (td) {
      setForm({
        legal_name: td.legal_name ?? '',
        business_type: td.business_type ?? '',
        org_number: td.org_number ?? '',
        vat_number: td.vat_number ?? '',
        address_line1: td.address_line1 ?? '',
        address_line2: td.address_line2 ?? '',
        postal_code: td.postal_code ?? '',
        city: td.city ?? '',
        country: td.country ?? 'SE',
        phone: td.phone ?? '',
        support_email: td.support_email ?? '',
      });
    }
    setHydrated(true);
  }, [loading, hydrated, details]);

  const countryOptions = useMemo(() => taxCountryOptions(locale), [locale]);
  const set = (key: FieldKey, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((errs) => errs.filter((e) => e !== key));
    if (key === 'vat_number') setVatRejected(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await api(saveEndpoint, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          ...form,
          // The DTO only accepts 'company' | 'private'; an empty choice must be
          // omitted so the API reports it as TRADER_DETAILS_INVALID `fields`
          // (highlighted below) instead of a raw validation error.
          business_type: form.business_type || undefined,
          vat_number: form.vat_number || undefined,
          address_line2: form.address_line2 || undefined,
        }),
      });
      setFieldErrors([]);
      setVatRejected(false);
      setMessage({ type: 'success', text: texts?.saved ?? t('saved') });
      onSaved?.();
    } catch (err) {
      const fields = err instanceof ApiError && Array.isArray(err.payload?.fields) ? (err.payload.fields as string[]) : [];
      setFieldErrors(fields);
      // TRADER_VAT_INVALID: VIES rejected the number (blocking); the field
      // is highlighted and the message names the cause.
      const vatInvalid = err instanceof ApiError && err.code === 'TRADER_VAT_INVALID';
      setVatRejected(vatInvalid);
      setMessage({ type: 'error', text: vatInvalid ? t('vies.invalid') : fields.length ? t('fixFields') : describe(err) });
    } finally {
      setSaving(false);
    }
  };

  const invalid = (key: FieldKey) => fieldErrors.includes(key);
  // VIES answer of the stored VAT number (wave 3): verified (name/address),
  // or "could not be verified now" (null, non-blocking).
  const vatCheck = details?.vat_check ?? null;
  const storedVat = details?.vat_number ?? '';
  const showVatCheck = !!vatCheck && !!storedVat && (form.vat_number ?? '').replace(/\s/g, '').toUpperCase() === storedVat;
  const field = (key: FieldKey, props: { required?: boolean; dir?: 'ltr'; type?: string; placeholder?: string; hint?: string } = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`trader-${key}`} className="text-xs">
        {t(`fields.${key}`)} {props.required && <span className="text-red-500">*</span>}
      </Label>
      <Input
        id={`trader-${key}`}
        className={cn('h-8 text-sm', invalid(key) && 'border-red-400 focus-visible:ring-red-200')}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        dir={props.dir}
        type={props.type}
        placeholder={props.placeholder}
        aria-invalid={invalid(key)}
        aria-describedby={invalid(key) ? `trader-${key}-error` : undefined}
      />
      {invalid(key) ? (
        <p id={`trader-${key}-error`} className="text-[11px] text-red-600">
          {key === 'vat_number' && vatRejected ? t('vies.invalidShort') : t.has(`errors.${key}`) ? t(`errors.${key}`) : t('errors.generic')}
        </p>
      ) : key === 'vat_number' && showVatCheck ? (
        vatCheck.valid === true ? (
          <p className="inline-flex items-start gap-1 text-[11px] text-emerald-700">
            <CheckCircle2 className="mt-px size-3 shrink-0" />
            <span>
              {t('vies.verified')}
              {vatCheck.name ? ` — ${vatCheck.name}` : ''}
              {vatCheck.address ? `, ${vatCheck.address.replace(/\s*\n\s*/g, ', ')}` : ''}
            </span>
          </p>
        ) : (
          <p className="inline-flex items-start gap-1 text-[11px] text-amber-700">
            <Info className="mt-px size-3 shrink-0" />
            <span>{t('vies.unavailable')}</span>
          </p>
        )
      ) : (
        props.hint && <p className="text-[11px] text-muted-foreground">{props.hint}</p>
      )}
    </div>
  );

  return (
    <Card id={id} className={cn('shadow-none', id && 'scroll-mt-20')}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">{texts?.title ?? t('title')}</CardTitle>
          {complete && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
              <CheckCircle2 className="size-3.5" /> {t('complete')}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{texts?.subtitle ?? t('subtitle')}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {field('legal_name', { required: true })}
            <div className="space-y-1.5">
              <Label className="text-xs">
                {t('fields.business_type')} <span className="text-red-500">*</span>
              </Label>
              <SearchableSelect
                value={form.business_type}
                onChange={(v) => set('business_type', v)}
                placeholder={tc('select')}
                options={[
                  { value: 'company', label: t('businessType.company'), description: t('businessType.companyDesc') },
                  { value: 'private', label: t('businessType.private'), description: t('businessType.privateDesc') },
                ]}
              />
              {invalid('business_type') && <p className="text-[11px] text-red-600">{t('errors.business_type')}</p>}
            </div>
            {field('org_number', { required: true, dir: 'ltr', placeholder: '556016-0680', hint: form.country === 'SE' ? t('orgNumberHintSe') : undefined })}
            {field('vat_number', { dir: 'ltr', placeholder: 'SE556016068001', hint: t('vatHint') })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('address_line1', { required: true })}
            {field('address_line2')}
            {field('postal_code', { required: true, dir: 'ltr' })}
            {field('city', { required: true })}
            <div className="space-y-1.5">
              <Label className="text-xs">
                {t('fields.country')} <span className="text-red-500">*</span>
              </Label>
              {hydrated && <SearchableSelect value={form.country} onChange={(v) => set('country', v)} options={countryOptions} />}
              {invalid('country') && <p className="text-[11px] text-red-600">{t('errors.country')}</p>}
            </div>
            {field('phone', { required: true, dir: 'ltr', type: 'tel', placeholder: '+46 70 123 45 67' })}
            {field('support_email', { required: true, dir: 'ltr', type: 'email', hint: texts?.supportEmailHint ?? t('supportEmailHint') })}
          </div>

          {message && (
            <div
              role={message.type === 'error' ? 'alert' : 'status'}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
                message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-destructive/30 bg-destructive/5 text-destructive'
              }`}
            >
              {message.type === 'success' ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /> : <AlertCircle className="mt-0.5 size-3.5 shrink-0" />}
              {message.text}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">{t('footerNote')}</p>
            <Button type="submit" size="sm" disabled={saving || !hydrated}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {saving ? tc('saving') : tc('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
