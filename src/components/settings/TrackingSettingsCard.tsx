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

// ── Tracking & cookies card (Namez go-live 3.9) ──────────────────────────────
// Store settings → Store tab. Edits the public tracking ids (GA4, Meta Pixel,
// TikTok Pixel) and the cookie-consent toggle as one explicitly saved form
// (PUT /stores/my/store). The storefront shows the cookie banner only when at
// least one id is set and loads a tracker only after consent (or right away
// when consent is not required).

export interface TrackingSettings {
  ga4_measurement_id: string | null;
  meta_pixel_id: string | null;
  tiktok_pixel_id: string | null;
  consent_required: boolean;
}

interface TrackingForm {
  ga4_measurement_id: string;
  meta_pixel_id: string;
  tiktok_pixel_id: string;
  consent_required: boolean;
}

type IdField = 'ga4_measurement_id' | 'meta_pixel_id' | 'tiktok_pixel_id';

// Mirror of the API DTO rules (modules/stores/dto/store.dto.ts): GA4 and
// TikTok ids are case-insensitive and stored upper-cased.
const RULES: Record<IdField, RegExp> = {
  ga4_measurement_id: /^$|^G-[A-Z0-9]{4,}$/i,
  meta_pixel_id: /^$|^[0-9]{5,32}$/,
  tiktok_pixel_id: /^$|^[A-Z0-9]{8,64}$/i,
};
const ID_FIELDS: IdField[] = ['ga4_measurement_id', 'meta_pixel_id', 'tiktok_pixel_id'];

function toForm(value: Partial<TrackingSettings> | null | undefined): TrackingForm {
  return {
    ga4_measurement_id: value?.ga4_measurement_id ?? '',
    meta_pixel_id: value?.meta_pixel_id ?? '',
    tiktok_pixel_id: value?.tiktok_pixel_id ?? '',
    consent_required: value?.consent_required !== false,
  };
}

function normalizeId(field: IdField, raw: string): string {
  const trimmed = raw.trim();
  return field === 'meta_pixel_id' ? trimmed : trimmed.toUpperCase();
}

/** Client-side validation: field → true when the value is invalid. */
function formErrors(form: TrackingForm): Partial<Record<IdField, true>> {
  const out: Partial<Record<IdField, true>> = {};
  for (const field of ID_FIELDS) {
    if (!RULES[field].test(normalizeId(field, form[field]))) out[field] = true;
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
  const describeError = useApiError();
  const [form, setForm] = useState<TrackingForm>(() => toForm(value));
  const [saved, setSaved] = useState<TrackingForm>(() => toForm(value));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

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
      const field = ID_FIELDS.find((f) => err.errors!.some((m) => m.includes(f)));
      if (field) return t(`invalid.${field}`);
      if (err.errors.some((m) => m.includes('consent_required'))) return t('invalid.consent_required');
    }
    return describeError(err);
  };

  const handleSave = async () => {
    if (saving || hasErrors) return;
    setSaving(true);
    setMsg(null);
    const body: TrackingSettings = {
      ga4_measurement_id: normalizeId('ga4_measurement_id', form.ga4_measurement_id) || null,
      meta_pixel_id: normalizeId('meta_pixel_id', form.meta_pixel_id) || null,
      tiktok_pixel_id: normalizeId('tiktok_pixel_id', form.tiktok_pixel_id) || null,
      consent_required: form.consent_required,
    };
    try {
      await api('/stores/my/store', {
        method: 'PUT',
        token,
        // Empty strings clear the id on the API side.
        body: JSON.stringify({
          ga4_measurement_id: body.ga4_measurement_id ?? '',
          meta_pixel_id: body.meta_pixel_id ?? '',
          tiktok_pixel_id: body.tiktok_pixel_id ?? '',
          consent_required: body.consent_required,
        }),
      });
      const next = toForm(body);
      setForm(next);
      setSaved(next);
      setMsg({ type: 'success', text: t('saved') });
      onSaved(body);
    } catch (err) {
      setMsg({ type: 'error', text: friendlyError(err) });
    } finally {
      setSaving(false);
    }
  };

  const anyId = ID_FIELDS.some((f) => form[f].trim() !== '');

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
          {idField('tiktok_pixel_id', 'CXXXXXXXXXXXXXXXXX')}
        </div>

        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t('consentRequired')}</p>
            <p className="text-[11px] text-muted-foreground">
              {form.consent_required ? t('consentRequiredOn') : t('consentRequiredOff')}
            </p>
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
