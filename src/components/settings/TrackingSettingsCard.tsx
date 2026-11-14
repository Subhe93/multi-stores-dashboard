'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import {
  MEDIA_VENDOR_LABELS,
  TRACKER_VENDOR_LABELS,
  consentSetup,
  marketingVendorLabels,
  type TrackerVendor,
} from '@/lib/consentLog';
import {
  TRACKING_ID_FIELDS,
  TRACKING_ID_RULES,
  clarityPatch,
  normalizeTrackingId as normalizeId,
  showClarityConsentWarning,
  type TrackingIdField,
} from '@/lib/trackingIds';

// ── Tracking & cookies card (Namez go-live 3.9) ──────────────────────────────
// Store settings → Store tab. Edits the public tracking ids (GA4, Meta Pixel,
// TikTok Pixel, Microsoft Clarity) and the cookie-consent toggle as one
// explicitly saved form (PUT /stores/my/store).
//
// Consent v2 (plans/consent-v2/CONTRACT.md): the storefront banner offers
// "Acceptera alla / Avböj alla / Inställningar", and the settings dialog has
// one switch per category. Each vendor loads only under its own category:
// Statistik = GA4 + Clarity, Marknadsföring = Meta Pixel + TikTok Pixel (and
// Google's ad signals), Externa medier = YouTube, Vimeo, Google Maps. The
// banner shows only when at least one tracker is gated. With consent not
// required, GA4/Meta/TikTok load right away; Microsoft Clarity is the
// exception and stays gated under Statistik. The read-only overview below
// the ids (lib/consentLog `consentSetup`) shows this mapping live.
//
// The Clarity id is sent only when the owner changed it, so a parent that does
// not pass `clarity_project_id` can never clear a stored id by saving.
//
// Meta Conversions API: the access token is write-only. The API never returns
// it, only `meta_capi_token_set`; the field is sent only when the owner typed
// a new token (replace) or pressed Remove (null). Left untouched, the request
// does not mention it and the stored token is kept.

export interface TrackingSettings {
  ga4_measurement_id: string | null;
  meta_pixel_id: string | null;
  tiktok_pixel_id: string | null;
  clarity_project_id: string | null;
  consent_required: boolean;
  meta_capi_token_set: boolean;
  meta_test_event_code: string | null;
}

interface TrackingForm {
  ga4_measurement_id: string;
  meta_pixel_id: string;
  tiktok_pixel_id: string;
  clarity_project_id: string;
  consent_required: boolean;
  meta_test_event_code: string;
  // A newly typed token (never the stored one) and the pending "remove".
  meta_capi_token: string;
  remove_capi_token: boolean;
}

type IdField = TrackingIdField;
type CapiField = 'meta_capi_token' | 'meta_test_event_code';
type Field = IdField | CapiField;

// Mirror of the API DTO rules (modules/stores/dto/store.dto.ts); the id rules
// and their normalization live in lib/trackingIds.
const RULES: Record<Field, RegExp> = {
  ...TRACKING_ID_RULES,
  meta_capi_token: /^$|^[A-Za-z0-9_\-|]{1,600}$/,
  meta_test_event_code: /^$|^[A-Za-z0-9_-]{1,40}$/,
};
const ID_FIELDS: IdField[] = TRACKING_ID_FIELDS;
const CAPI_FIELDS: CapiField[] = ['meta_capi_token', 'meta_test_event_code'];

function toForm(value: Partial<TrackingSettings> | null | undefined): TrackingForm {
  return {
    ga4_measurement_id: value?.ga4_measurement_id ?? '',
    meta_pixel_id: value?.meta_pixel_id ?? '',
    tiktok_pixel_id: value?.tiktok_pixel_id ?? '',
    clarity_project_id: value?.clarity_project_id ?? '',
    consent_required: value?.consent_required !== false,
    meta_test_event_code: value?.meta_test_event_code ?? '',
    meta_capi_token: '',
    remove_capi_token: false,
  };
}

/** Client-side validation: field → true when the value is invalid. */
function formErrors(form: TrackingForm): Partial<Record<Field, true>> {
  const out: Partial<Record<Field, true>> = {};
  for (const field of ID_FIELDS) {
    if (!RULES[field].test(normalizeId(field, form[field]))) out[field] = true;
  }
  for (const field of CAPI_FIELDS) {
    if (!RULES[field].test(form[field].trim())) out[field] = true;
  }
  return out;
}

interface Props {
  token: string;
  value: Partial<TrackingSettings> | null | undefined;
  onSaved: (settings: TrackingSettings) => void;
}

export function TrackingSettingsCard({ token, value, onSaved }: Props) {
  const t = useTranslations('creator.settings.tracking');
  const tSetup = useTranslations('consentLog.setup');
  const describeError = useApiError();
  const [form, setForm] = useState<TrackingForm>(() => toForm(value));
  const [saved, setSaved] = useState<TrackingForm>(() => toForm(value));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  // Whether a token is stored on the server (the token itself is never sent back).
  const tokenSet = value?.meta_capi_token_set === true;

  // Re-seed from a fresh store payload, never over unsaved edits (same rule
  // as CheckoutSettingsCard).
  const lastSeeded = useRef(JSON.stringify(toForm(value)));
  useEffect(() => {
    const next = toForm(value);
    const json = JSON.stringify(next);
    if (json === lastSeeded.current) return;
    lastSeeded.current = json;
    if (dirty) return;
    setForm(next);
    setSaved(next);
  }, [value, dirty]);

  const errors = formErrors(form);
  const hasErrors = Object.keys(errors).length > 0;

  const update = (patch: Partial<TrackingForm>) => {
    setMsg(null);
    setForm((f) => ({ ...f, ...patch }));
  };

  // class-validator messages name the field; translate them to the friendly
  // per-field hint instead of surfacing the raw "must match" text.
  const friendlyError = (err: unknown): string => {
    if (err instanceof ApiError && Array.isArray(err.errors)) {
      const field = [...CAPI_FIELDS, ...ID_FIELDS].find((f) => err.errors!.some((m) => m.includes(f)));
      if (field) return t(`invalid.${field}`);
      if (err.errors.some((m) => m.includes('consent_required'))) return t('invalid.consent_required');
    }
    return describeError(err);
  };

  const handleSave = async () => {
    if (saving || hasErrors) return;
    setSaving(true);
    setMsg(null);
    const newToken = form.meta_capi_token.trim();
    const testCode = form.meta_test_event_code.trim();
    const ids = {
      ga4_measurement_id: normalizeId('ga4_measurement_id', form.ga4_measurement_id) || null,
      meta_pixel_id: normalizeId('meta_pixel_id', form.meta_pixel_id) || null,
      tiktok_pixel_id: normalizeId('tiktok_pixel_id', form.tiktok_pixel_id) || null,
      clarity_project_id: normalizeId('clarity_project_id', form.clarity_project_id) || null,
      consent_required: form.consent_required,
    };
    // Clarity: sent only when changed (see the header comment).
    const clarityBody = clarityPatch(form.clarity_project_id, saved.clarity_project_id);
    // Write-only token: sent only when replaced (new value) or removed (null).
    // Absent from the body = the stored token is kept.
    const tokenPatch: { meta_capi_token?: string | null } = newToken
      ? { meta_capi_token: newToken }
      : form.remove_capi_token
        ? { meta_capi_token: null }
        : {};
    try {
      const res = await api<{ meta_capi_token_set?: boolean } | undefined>('/stores/my/store', {
        method: 'PUT',
        token,
        // Empty strings clear the id on the API side.
        body: JSON.stringify({
          ga4_measurement_id: ids.ga4_measurement_id ?? '',
          meta_pixel_id: ids.meta_pixel_id ?? '',
          tiktok_pixel_id: ids.tiktok_pixel_id ?? '',
          ...clarityBody,
          consent_required: ids.consent_required,
          meta_test_event_code: testCode,
          ...tokenPatch,
        }),
      });
      const nextTokenSet =
        typeof res?.meta_capi_token_set === 'boolean'
          ? res.meta_capi_token_set
          : newToken
            ? true
            : form.remove_capi_token
              ? false
              : tokenSet;
      const settings: TrackingSettings = {
        ...ids,
        meta_capi_token_set: nextTokenSet,
        meta_test_event_code: testCode || null,
      };
      // The typed token is dropped from the form as soon as it is saved.
      const next = toForm(settings);
      setForm(next);
      setSaved(next);
      setMsg({ type: 'success', text: t('saved') });
      onSaved(settings);
    } catch (err) {
      setMsg({ type: 'error', text: friendlyError(err) });
    } finally {
      setSaving(false);
    }
  };

  const anyId = ID_FIELDS.some((f) => form[f].trim() !== '');
  const clarityConsentWarning = showClarityConsentWarning(form.clarity_project_id, form.consent_required);
  const setup = consentSetup(form);
  const vendorList = (vendors: TrackerVendor[]) => vendors.map((v) => TRACKER_VENDOR_LABELS[v]).join(', ');
  const typingToken = form.meta_capi_token.trim() !== '';
  // A stored token that this save keeps (nothing typed, not being removed).
  const keepsStoredToken = tokenSet && !form.remove_capi_token && !typingToken;
  const willHaveToken = typingToken || keepsStoredToken;

  const idField = (field: IdField, placeholder: string) => (
    <div className="space-y-1">
      <Label htmlFor={`tr_${field}`}>{t(`${field}.label`)}</Label>
      <Input
        id={`tr_${field}`}
        value={form[field]}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        dir="ltr"
        className="font-mono"
        onChange={(e) => update({ [field]: e.target.value } as Partial<TrackingForm>)}
        aria-invalid={errors[field] || undefined}
      />
      <p className={`text-[11px] ${errors[field] ? 'text-red-600' : 'text-muted-foreground'}`}>
        {errors[field] ? t(`invalid.${field}`) : t(`${field}.hint`)}
      </p>
    </div>
  );

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
        <p className="text-[11px] text-muted-foreground">{t('subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-4">
          {idField('ga4_measurement_id', 'G-XXXXXXXXXX')}
          {idField('meta_pixel_id', '123456789012345')}

          {/* Meta Conversions API: server-side Purchase events. */}
          <div className="space-y-4 border-s-2 border-muted ps-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="tr_meta_capi_token">{t('meta_capi_token.label')}</Label>
                {tokenSet && !typingToken && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => update({ remove_capi_token: !form.remove_capi_token })}
                  >
                    {form.remove_capi_token ? t('meta_capi_token.undoRemove') : t('meta_capi_token.remove')}
                  </Button>
                )}
              </div>
              <Input
                id="tr_meta_capi_token"
                type="password"
                value={form.meta_capi_token}
                placeholder={keepsStoredToken ? t('meta_capi_token.savedPlaceholder') : 'EAA…'}
                autoComplete="new-password"
                spellCheck={false}
                dir="ltr"
                className="font-mono"
                // Typing a new token replaces the stored one (and cancels a pending remove).
                onChange={(e) => update({ meta_capi_token: e.target.value, remove_capi_token: false })}
                aria-invalid={errors.meta_capi_token || undefined}
              />
              {errors.meta_capi_token ? (
                <p className="text-[11px] text-red-600">{t('invalid.meta_capi_token')}</p>
              ) : form.remove_capi_token ? (
                <p className="text-[11px] text-amber-600">{t('meta_capi_token.willRemove')}</p>
              ) : keepsStoredToken ? (
                <p className="text-[11px] text-emerald-600">{t('meta_capi_token.savedHint')}</p>
              ) : typingToken && tokenSet ? (
                <p className="text-[11px] text-muted-foreground">{t('meta_capi_token.willReplace')}</p>
              ) : null}
              <p className="text-[11px] text-muted-foreground">{t('meta_capi_token.help')}</p>
              <p className="text-[11px] text-muted-foreground">{t('meta_capi_token.where')}</p>
              {willHaveToken && form.meta_pixel_id.trim() === '' && (
                <p className="text-[11px] text-amber-600">{t('meta_capi_token.needsPixel')}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="tr_meta_test_event_code">{t('meta_test_event_code.label')}</Label>
              <Input
                id="tr_meta_test_event_code"
                value={form.meta_test_event_code}
                placeholder="TEST12345"
                autoComplete="off"
                spellCheck={false}
                dir="ltr"
                className="font-mono"
                onChange={(e) => update({ meta_test_event_code: e.target.value })}
                aria-invalid={errors.meta_test_event_code || undefined}
              />
              <p
                className={`text-[11px] ${errors.meta_test_event_code ? 'text-red-600' : 'text-muted-foreground'}`}
              >
                {errors.meta_test_event_code ? t('invalid.meta_test_event_code') : t('meta_test_event_code.hint')}
              </p>
            </div>
          </div>

          {idField('tiktok_pixel_id', 'CXXXXXXXXXXXXXXXXX')}

          {/* Microsoft Clarity: heatmaps + session recordings, always consent-gated. */}
          <div className="space-y-1">
            {idField('clarity_project_id', 'abcdefghij')}
            <p className="text-[11px] text-muted-foreground">{t('clarity_project_id.help')}</p>
            <p className="text-[11px] text-amber-600">{t('clarity_project_id.noCustomCode')}</p>
          </div>
        </div>

        {/* Consent v2: categories in the storefront cookie banner and the vendors in each. */}
        <div className="space-y-2 border-t pt-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{tSetup('title')}</p>
            <p className="text-[11px] text-muted-foreground">{tSetup(setup.banner ? 'bannerOn' : 'bannerOff')}</p>
          </div>
          <ul className="divide-y rounded-lg border text-[11px]">
            {(
              [
                { key: 'necessary', vendors: tSetup('necessaryVendors'), on: true },
                { key: 'analytics', vendors: vendorList(setup.analytics), on: setup.analytics.length > 0 },
                // Google is named too when GA4 is gated: marketing grants it the ad signals.
                { key: 'marketing', vendors: marketingVendorLabels(setup).join(', '), on: setup.marketing.length > 0 },
                { key: 'externalMedia', vendors: MEDIA_VENDOR_LABELS.join(', '), on: true },
              ] as const
            ).map((c) => (
              <li key={c.key} className="flex items-start justify-between gap-3 px-3 py-2">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium text-foreground">{tSetup(`categories.${c.key}`)}</p>
                  <p className="text-muted-foreground">{c.on ? c.vendors : tSetup('noVendors')}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 ${
                    c.key === 'necessary'
                      ? 'bg-muted text-muted-foreground'
                      : c.on
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {c.key === 'necessary' ? tSetup('alwaysOn') : c.on ? tSetup('offered') : tSetup('notOffered')}
                </span>
              </li>
            ))}
          </ul>
          {setup.ungated.length > 0 && (
            <p className="text-[11px] text-amber-600">{tSetup('ungated', { vendors: vendorList(setup.ungated) })}</p>
          )}
          <p className="text-[11px] text-muted-foreground">{tSetup('externalHint')}</p>
        </div>

        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t('consentRequired')}</p>
            <p className="text-[11px] text-muted-foreground">
              {form.consent_required ? t('consentRequiredOn') : t('consentRequiredOff')}
            </p>
            {clarityConsentWarning && (
              <p className="text-[11px] text-amber-600" role="status">
                {t('clarityConsentOffWarning')}
              </p>
            )}
          </div>
          <ToggleSwitch
            checked={form.consent_required}
            onChange={(checked) => update({ consent_required: checked })}
            label={t('consentRequired')}
          />
        </div>

        {!anyId && <p className="text-[11px] text-muted-foreground">{t('noIdsHint')}</p>}

        <div className="flex items-center justify-between gap-3 border-t pt-3">
          {msg ? (
            <p className={`text-[11px] ${msg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>
          ) : (
            <span className="text-[11px] text-muted-foreground">{dirty ? t('unsaved') : ''}</span>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving || !dirty || hasErrors}>
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            {t('save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
