'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { API_URL, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import { useImageUpload } from '@/lib/useImageUpload';
import { useTransientFlag } from '@/lib/useTransientFlag';
import { taxCountryOptions } from '@/lib/taxCountries';
import {
  EMPTY_LEGAL_PROFILE,
  LEGAL_PROFILE_MAX_LENGTH,
  missingFieldLabel,
  normalizeIban,
  timezoneOptions,
  validateBankgiro,
  validateBic,
  validateIban,
  validateTimezone,
} from '@/lib/invoices';
import { saveLegalProfile, type LegalProfileInput, type LegalProfileView } from '@/lib/invoices.api';

// Text fields edited as strings; empty strings are sent as null.
type TextField = Exclude<keyof LegalProfileInput, 'f_tax_approved' | 'due_days'>;
type FormState = Record<TextField, string> & { f_tax_approved: boolean; due_days: string };

const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

// API error code → field it belongs to (inline message under that field).
const CODE_FIELD: Record<string, TextField> = {
  INVOICE_IBAN_INVALID: 'iban',
  INVOICE_BANKGIRO_INVALID: 'bankgiro',
  INVOICE_BIC_INVALID: 'bic',
  INVOICE_VAT_NUMBER_INVALID: 'vat_number',
  INVOICE_TIMEZONE_INVALID: 'timezone',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toForm(view: Partial<LegalProfileInput> | null): FormState {
  const src = { ...EMPTY_LEGAL_PROFILE, ...(view ?? {}) };
  const out = {} as FormState;
  for (const key of Object.keys(EMPTY_LEGAL_PROFILE) as (keyof LegalProfileInput)[]) {
    if (key === 'f_tax_approved') out.f_tax_approved = !!src.f_tax_approved;
    else if (key === 'due_days') out.due_days = String(src.due_days ?? 30);
    else out[key] = (src[key] as string | null) ?? '';
  }
  return out;
}

// Only the fields that differ from the loaded server copy, so a stale form
// can never clear values saved elsewhere (e.g. another tab).
function changedFields(next: LegalProfileInput, base: LegalProfileInput): Partial<LegalProfileInput> {
  const out: Partial<LegalProfileInput> = {};
  for (const key of Object.keys(EMPTY_LEGAL_PROFILE) as (keyof LegalProfileInput)[]) {
    if (next[key] !== base[key]) (out as Record<string, unknown>)[key] = next[key];
  }
  return out;
}

function toInput(form: FormState): LegalProfileInput {
  const out = {} as LegalProfileInput;
  for (const key of Object.keys(EMPTY_LEGAL_PROFILE) as (keyof LegalProfileInput)[]) {
    if (key === 'f_tax_approved') out.f_tax_approved = form.f_tax_approved;
    else if (key === 'due_days') out.due_days = Number(form.due_days);
    else if (key === 'timezone') out.timezone = form.timezone.trim() || EMPTY_LEGAL_PROFILE.timezone;
    else {
      let value = form[key].trim();
      if (key === 'iban') value = normalizeIban(value);
      if (key === 'bic' || key === 'country_code' || key === 'vat_number') value = value.toUpperCase();
      (out as unknown as Record<string, string | null>)[key] = value || null;
    }
  }
  return out;
}

// /uploads/... paths are stored relative; previews need the API origin.
function previewUrl(url: string): string {
  if (!url) return '';
  return url.startsWith('http') ? url : `${API_ORIGIN}${url}`;
}

// useImageUpload returns an absolute URL, but the API accepts only
// /uploads/... paths for the logo; anything else is rejected (null).
function storedLogoUrl(url: string): string | null {
  if (url.startsWith('/uploads/')) return url;
  if (url.startsWith(`${API_ORIGIN}/uploads/`)) return url.slice(API_ORIGIN.length);
  try {
    const { pathname } = new URL(url);
    return pathname.startsWith('/uploads/') ? pathname : null;
  } catch {
    return null;
  }
}

interface LegalProfileFormProps {
  token: string;
  // Loaded server copy; the page renders the form only after a successful GET.
  profile: LegalProfileView;
  onSaved: (view: LegalProfileView) => void;
}

/**
 * Seller profile printed on every invoice (StoreLegalProfile, D1). Fields
 * are saved progressively; the server reports `complete` / `missing[]`.
 */
export function LegalProfileForm({ token, profile, onSaved }: LegalProfileFormProps) {
  const t = useTranslations('creator.invoices.profile');
  const tc = useTranslations('common');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const describeError = useApiError();
  const { pickAndUpload, uploading } = useImageUpload(token);

  const [form, setForm] = useState<FormState>(() => toForm(profile));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, flashSaved] = useTransientFlag();

  const countryOptions = useMemo(
    () => taxCountryOptions(locale, form.country_code ? [form.country_code] : []),
    [locale, form.country_code],
  );
  const tzOptions = useMemo(() => timezoneOptions(form.timezone), [form.timezone]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setError(null);
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (form.iban.trim() && !validateIban(form.iban)) errs.iban = tErrors('INVOICE_IBAN_INVALID');
    if (form.bankgiro.trim() && !validateBankgiro(form.bankgiro)) errs.bankgiro = tErrors('INVOICE_BANKGIRO_INVALID');
    if (form.bic.trim() && !validateBic(form.bic)) errs.bic = tErrors('INVOICE_BIC_INVALID');
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) errs.email = t('invalidEmail');
    if (form.website.trim() && !/^https?:\/\//i.test(form.website.trim())) errs.website = t('invalidWebsite');
    const due = Number(form.due_days);
    if (!form.due_days.trim() || !Number.isInteger(due) || due < 0 || due > 120) errs.due_days = t('invalidDueDays');
    if (form.timezone.trim() && !validateTimezone(form.timezone.trim())) errs.timezone = tErrors('INVOICE_TIMEZONE_INVALID');
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (saving) return;
    if (!validate()) {
      setError(t('fixErrors'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const changes = changedFields(toInput(form), toInput(toForm(profile)));
      if (Object.keys(changes).length === 0) {
        flashSaved();
        return;
      }
      const view = await saveLegalProfile(token, changes);
      setForm(toForm(view));
      onSaved(view);
      flashSaved();
    } catch (err) {
      const field = err instanceof ApiError && err.code ? CODE_FIELD[err.code] : undefined;
      if (field) setFieldErrors((prev) => ({ ...prev, [field]: describeError(err) }));
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleLogo = async () => {
    const [img] = await pickAndUpload('general');
    if (!img?.url) return;
    const stored = storedLogoUrl(img.url);
    if (stored) set('logo_url', stored);
    else setFieldErrors((prev) => ({ ...prev, logo_url: t('logoUploadFailed') }));
  };

  const text = (key: TextField, opts: { dir?: 'ltr'; placeholder?: string; hint?: string; type?: string } = {}) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{t(`fields.${key}`)}</Label>
      <Input
        className="h-8 text-sm"
        type={opts.type ?? 'text'}
        dir={opts.dir}
        value={form[key]}
        maxLength={LEGAL_PROFILE_MAX_LENGTH[key]}
        placeholder={opts.placeholder}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={!!fieldErrors[key]}
      />
      {fieldErrors[key] ? (
        <p className="text-[11px] text-red-600">{fieldErrors[key]}</p>
      ) : opts.hint ? (
        <p className="text-[11px] text-muted-foreground">{opts.hint}</p>
      ) : null}
    </div>
  );

  const section = (title: string, description: string | null, children: React.ReactNode) => (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );

  const missing = profile.missing ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {section(
          t('groups.identity'),
          t('groups.identityHint'),
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {text('legal_name', { placeholder: 'Neronet Academy AB' })}
              {text('brand_name', { hint: t('hints.brand_name') })}
              {text('org_number', { dir: 'ltr', placeholder: '556036-0793' })}
              {text('vat_number', { dir: 'ltr', placeholder: 'SE556036079301', hint: t('hints.vat_number') })}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {text('registered_office', { hint: t('hints.registered_office') })}
              <div className="flex items-start justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0 space-y-0.5">
                  <Label className="text-xs">{t('fields.f_tax_approved')}</Label>
                  <p className="text-[11px] text-muted-foreground">{t('hints.f_tax_approved')}</p>
                </div>
                <ToggleSwitch
                  checked={form.f_tax_approved}
                  onChange={(next) => set('f_tax_approved', next)}
                  label={t('fields.f_tax_approved')}
                />
              </div>
            </div>
          </>,
        )}

        {section(
          t('groups.address'),
          null,
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {text('address_line1')}
              {text('address_line2')}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {text('postal_code', { dir: 'ltr' })}
              {text('city')}
              <div className="space-y-1.5">
                <Label className="text-xs">{t('fields.country_code')}</Label>
                <SearchableSelect
                  value={form.country_code}
                  onChange={(v) => set('country_code', v)}
                  options={countryOptions}
                  placeholder={t('selectCountry')}
                />
              </div>
            </div>
          </>,
        )}

        {section(
          t('groups.contact'),
          null,
          <div className="grid gap-4 md:grid-cols-3">
            {text('email', { dir: 'ltr', type: 'email', placeholder: 'info@example.se' })}
            {text('phone', { dir: 'ltr', type: 'tel', placeholder: '+46 8 123 456' })}
            {text('website', { dir: 'ltr', placeholder: 'https://example.se' })}
          </div>,
        )}

        {section(
          t('groups.bank'),
          t('groups.bankHint'),
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {text('bankgiro', { dir: 'ltr', placeholder: '5050-1055' })}
              {text('plusgiro', { dir: 'ltr', placeholder: '12 34 56-7' })}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {text('iban', { dir: 'ltr', placeholder: 'SE45 5000 0000 0583 9825 7466' })}
              {text('bic', { dir: 'ltr', placeholder: 'ESSESESS' })}
              {text('bank_name')}
            </div>
          </>,
        )}

        {section(
          t('groups.document'),
          null,
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('fields.logo_url')}</Label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-16 w-32 items-center justify-center overflow-hidden rounded-md border bg-zinc-50">
                  {form.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- arbitrary upload host
                    <img src={previewUrl(form.logo_url)} alt="" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="px-2 text-center text-[10px] text-muted-foreground">{t('logoFallback')}</span>
                  )}
                </div>
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={handleLogo}>
                  {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />} {t('uploadLogo')}
                </Button>
                {form.logo_url && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => set('logo_url', '')}>
                    <Trash2 /> {t('removeLogo')}
                  </Button>
                )}
              </div>
              {fieldErrors.logo_url && <p className="text-[11px] text-red-600">{fieldErrors.logo_url}</p>}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('fields.due_days')}</Label>
                <Input
                  className="h-8 text-sm"
                  type="number"
                  min={0}
                  max={120}
                  dir="ltr"
                  value={form.due_days}
                  onChange={(e) => set('due_days', e.target.value)}
                  aria-invalid={!!fieldErrors.due_days}
                />
                {fieldErrors.due_days ? (
                  <p className="text-[11px] text-red-600">{fieldErrors.due_days}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">{t('hints.due_days')}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('fields.timezone')}</Label>
                <SearchableSelect value={form.timezone} onChange={(v) => set('timezone', v)} options={tzOptions} />
                {fieldErrors.timezone ? (
                  <p className="text-[11px] text-red-600">{fieldErrors.timezone}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">{t('hints.timezone')}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('fields.footer_note')}</Label>
              <Textarea
                className="min-h-20 text-sm"
                maxLength={1000}
                value={form.footer_note}
                onChange={(e) => set('footer_note', e.target.value)}
                placeholder={t('hints.footer_note')}
              />
            </div>
          </>,
        )}
      </div>

      {/* Completeness checklist + save, sticky beside the form on wide screens. */}
      <div className="space-y-4">
        <Card className="shadow-none lg:sticky lg:top-20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{t('checklistTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {profile.complete ? (
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-800">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span>{t('complete')}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-amber-800">{t('incomplete')}</p>
                <ul className="space-y-1">
                  {missing.map((m) => (
                    <li key={m} className="flex items-center gap-2">
                      <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
                      {missingFieldLabel(m, t)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">{t('checklistHint')}</p>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-red-700">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 border-t pt-3">
              {saved && <span className="text-xs font-medium text-emerald-600">{t('saved')}</span>}
              <Button size="sm" disabled={saving || uploading} onClick={handleSave}>
                {saving && <Loader2 className="animate-spin" />} {tc('save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
