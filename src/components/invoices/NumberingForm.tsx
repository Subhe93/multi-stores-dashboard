'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Info, Loader2, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApiError } from '@/lib/useApiError';
import { useTransientFlag } from '@/lib/useTransientFlag';
import {
  MAX_PADDING,
  formatInvoiceNumberPreview,
  validateNumberingSeries,
  type NumberingFieldError,
} from '@/lib/invoices';
import {
  saveNumbering,
  type LegalProfileView,
  type NumberingInput,
  type NumberingSeriesView,
} from '@/lib/invoices.api';

type SeriesKey = 'invoice' | 'credit_note';
interface SeriesForm {
  prefix: string;
  next_number: string;
  padding: string;
}

const DEFAULT_SERIES: Record<SeriesKey, NumberingSeriesView> = {
  invoice: { prefix: '', padding: 0, next_number: 1, issued_count: 0, locked: false },
  credit_note: { prefix: 'CN-', padding: 0, next_number: 1, issued_count: 0, locked: false },
};

function toSeriesForm(view: NumberingSeriesView): SeriesForm {
  return { prefix: view.prefix ?? '', next_number: String(view.next_number ?? 1), padding: String(view.padding ?? 0) };
}

interface NumberingFormProps {
  token: string;
  profile: LegalProfileView;
  onSaved: (view: LegalProfileView) => void;
}

/**
 * Invoice and credit-note number series (D2). Prefix and padding are
 * cosmetic and stay editable; the next number is frozen once a document was
 * issued in that series so numbering never has gaps or duplicates.
 */
export function NumberingForm({ token, profile, onSaved }: NumberingFormProps) {
  const t = useTranslations('creator.invoices.numbering');
  const tc = useTranslations('common');
  const describeError = useApiError();
  const views: Record<SeriesKey, NumberingSeriesView> = {
    invoice: profile?.numbering?.invoice ?? DEFAULT_SERIES.invoice,
    credit_note: profile?.numbering?.credit_note ?? DEFAULT_SERIES.credit_note,
  };
  const [form, setForm] = useState<Record<SeriesKey, SeriesForm>>(() => ({
    invoice: toSeriesForm(views.invoice),
    credit_note: toSeriesForm(views.credit_note),
  }));
  const [errors, setErrors] = useState<Record<SeriesKey, NumberingFieldError[]>>({ invoice: [], credit_note: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, flashSaved] = useTransientFlag();

  const set = (series: SeriesKey, key: keyof SeriesForm, value: string) => {
    setForm((prev) => ({ ...prev, [series]: { ...prev[series], [key]: value } }));
    setErrors((prev) => ({ ...prev, [series]: prev[series].filter((e) => e !== key) }));
    setError(null);
  };

  const parsed = (series: SeriesKey) => ({
    prefix: form[series].prefix.trim(),
    next_number: Number(form[series].next_number),
    padding: Number(form[series].padding),
  });

  const handleSave = async () => {
    if (saving) return;
    // A locked series' counter is not editable, so it is not validated either.
    const check = (series: SeriesKey) =>
      validateNumberingSeries(views[series].locked ? { ...parsed(series), next_number: views[series].next_number } : parsed(series));
    const next: Record<SeriesKey, NumberingFieldError[]> = {
      invoice: check('invoice'),
      credit_note: check('credit_note'),
    };
    setErrors(next);
    if (next.invoice.length || next.credit_note.length) {
      setError(t('fixErrors'));
      return;
    }
    const body: NumberingInput = {};
    for (const series of ['invoice', 'credit_note'] as SeriesKey[]) {
      const p = parsed(series);
      // next_number is sent only when it changed on an unlocked series;
      // prefix and padding stay editable either way.
      const sendNext = !views[series].locked && p.next_number !== views[series].next_number;
      body[series] = { prefix: p.prefix, padding: p.padding, ...(sendNext ? { next_number: p.next_number } : {}) };
    }
    setSaving(true);
    setError(null);
    try {
      const view = await saveNumbering(token, body);
      if (view?.numbering) {
        setForm({ invoice: toSeriesForm(view.numbering.invoice), credit_note: toSeriesForm(view.numbering.credit_note) });
      }
      onSaved(view);
      flashSaved();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  const seriesCard = (series: SeriesKey) => {
    const view = views[series];
    const p = parsed(series);
    const errs = errors[series];
    const preview = formatInvoiceNumberPreview(p.prefix, view.locked ? view.next_number : p.next_number, p.padding);
    return (
      <Card key={series} className="shadow-none">
        <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-sm font-semibold">{t(series === 'invoice' ? 'invoiceSeries' : 'creditNoteSeries')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('issuedCount', { count: view.issued_count })}</p>
          </div>
          {view.locked && (
            <Badge variant="outline" className="text-[10px] bg-zinc-50 text-zinc-700 border-zinc-200">
              <Lock /> {t('lockedBadge')}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('prefix')}</Label>
              <Input
                className="h-8 font-mono text-sm"
                dir="ltr"
                maxLength={12}
                value={form[series].prefix}
                onChange={(e) => set(series, 'prefix', e.target.value)}
                aria-invalid={errs.includes('prefix')}
                placeholder={series === 'invoice' ? 'INV-' : 'CN-'}
              />
              <p className={`text-[11px] ${errs.includes('prefix') ? 'text-red-600' : 'text-muted-foreground'}`}>
                {errs.includes('prefix') ? t('invalidPrefix') : t('prefixHint')}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('nextNumber')}</Label>
              <Input
                className="h-8 font-mono text-sm"
                type="number"
                dir="ltr"
                min={1}
                value={view.locked ? String(view.next_number) : form[series].next_number}
                disabled={view.locked}
                onChange={(e) => set(series, 'next_number', e.target.value)}
                aria-invalid={errs.includes('next_number')}
              />
              <p className={`text-[11px] ${errs.includes('next_number') ? 'text-red-600' : 'text-muted-foreground'}`}>
                {errs.includes('next_number') ? t('invalidNextNumber') : view.locked ? t('lockedHint') : t('nextNumberHint')}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('padding')}</Label>
              <Input
                className="h-8 font-mono text-sm"
                type="number"
                dir="ltr"
                min={0}
                max={MAX_PADDING}
                value={form[series].padding}
                onChange={(e) => set(series, 'padding', e.target.value)}
                aria-invalid={errs.includes('padding')}
              />
              <p className={`text-[11px] ${errs.includes('padding') ? 'text-red-600' : 'text-muted-foreground'}`}>
                {errs.includes('padding') ? t('invalidPadding', { max: MAX_PADDING }) : t('paddingHint')}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">{t('preview')}</span>
            <span className="font-mono text-sm font-semibold" dir="ltr">{preview}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  const anyLocked = views.invoice.locked || views.credit_note.locked;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
        <Info className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-1">
          <p>{t('description')}</p>
          {anyLocked && <p className="font-medium">{t('lockedExplanation')}</p>}
        </div>
      </div>

      {!profile?.numbering && (
        <p className="text-xs text-muted-foreground">{t('notConfigured')}</p>
      )}

      {seriesCard('invoice')}
      {seriesCard('credit_note')}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {saved && <span className="text-xs font-medium text-emerald-600">{t('saved')}</span>}
        {/* Sequences are created with the first seller-profile save. */}
        <Button size="sm" disabled={saving || !profile?.numbering} onClick={handleSave}>
          {saving && <Loader2 className="animate-spin" />} {tc('save')}
        </Button>
      </div>
    </div>
  );
}
