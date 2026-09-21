'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Loader2, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { LocalizedTextFields } from '@/components/taxes/LocalizedTextFields';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { countryLabel, taxCountryOptions } from '@/lib/taxCountries';
import {
  formatTaxRateLabel,
  formatTaxRatePercent,
  localizedTaxText,
  parseTaxRateBp,
  type TaxClass,
  type TaxRateRow,
} from '@/lib/taxRate';

// Default VAT labels per locale, pre-filled when creating a rate.
const DEFAULT_LABELS: Record<string, string> = {
  en: 'VAT',
  sv: 'Moms',
  de: 'MwSt.',
  fr: 'TVA',
  tr: 'KDV',
  ar: 'ضريبة القيمة المضافة',
};

interface RateForm {
  tax_class_id: string;
  country: string;
  region: string;
  postcode_pattern: string;
  ratePercent: string;
  label: Record<string, string>;
  priority: string;
  applies_to_shipping: boolean;
  is_active: boolean;
}

interface TaxRatesManagerProps {
  // '/taxes/admin/rates' (platform) or '/taxes/my/rates' (own store).
  endpoint: string;
  classes: TaxClass[];
  // Locales offered for the label inputs (platform or store locales).
  locales: string[];
  // Admin only: shows the "Seed default rates" button.
  canSeed?: boolean;
  // Called after a successful seed so the parent can reload the classes.
  onSeeded?: () => void;
  // Optional note rendered above the table (e.g. how own rates combine with platform rates).
  note?: string;
}

function emptyForm(classes: TaxClass[], locales: string[]): RateForm {
  const defaultClass = classes.find((c) => c.is_default) || classes[0];
  const label: Record<string, string> = {};
  locales.forEach((l) => {
    if (DEFAULT_LABELS[l]) label[l] = DEFAULT_LABELS[l];
  });
  return {
    tax_class_id: defaultClass?.id || '',
    country: '',
    region: '',
    postcode_pattern: '',
    ratePercent: '',
    label,
    priority: '0',
    applies_to_shipping: true,
    is_active: true,
  };
}

// Field limits mirrored from the API DTO (plans/tax-system/API-CONTRACT-TAX.md).
const PRIORITY_MIN = 0;
const PRIORITY_MAX = 1000;
const LABEL_MAX_LENGTH = 60;
const POSTCODE_PATTERN_MAX_LENGTH = 40;
// Region codes are stored uppercased: letters, digits and dashes only.
const REGION_PATTERN = /^[A-Z0-9-]+$/;

type RateFormField = 'priority' | 'label' | 'region' | 'postcode_pattern';
type RateFormErrors = Partial<Record<RateFormField, string>>;

// Locale whose label is mandatory: English when offered, else the first one.
function requiredLabelLocale(locales: string[]): string {
  return locales.includes('en') ? 'en' : locales[0] || 'en';
}

function formFromRate(rate: TaxRateRow): RateForm {
  const label = typeof rate.label === 'object' && rate.label ? { ...rate.label } : { en: String(rate.label || '') };
  return {
    tax_class_id: rate.tax_class_id,
    country: rate.country,
    region: rate.region || '',
    postcode_pattern: rate.postcode_pattern || '',
    ratePercent: formatTaxRatePercent(rate.rate_bp),
    label,
    priority: String(rate.priority ?? 0),
    applies_to_shipping: rate.applies_to_shipping ?? true,
    is_active: rate.is_active ?? true,
  };
}

export function TaxRatesManager({ endpoint, classes, locales, canSeed, onSeeded, note }: TaxRatesManagerProps) {
  const t = useTranslations('taxes');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { token } = useAuth();

  const [rates, setRates] = useState<TaxRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Filters (client-side; the list is small enough to hold in memory).
  const [filterCountry, setFilterCountry] = useState('');
  const [filterClass, setFilterClass] = useState('');

  // Create / edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RateForm>(() => emptyForm(classes, locales));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  // Per-field messages shown under the inputs before the request is sent.
  const [fieldErrors, setFieldErrors] = useState<RateFormErrors>({});

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<TaxRateRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Seed (admin)
  const [seedOpen, setSeedOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRates = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError('');
    try {
      const rows = await api<TaxRateRow[]>(endpoint, { token });
      setRates(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setLoadError((err instanceof Error && err.message) || t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [token, endpoint, t]);

  useEffect(() => {
    void fetchRates();
  }, [fetchRates]);

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const className = (id: string) => {
    const cls = classById.get(id);
    return cls ? localizedTaxText(cls.name, locale, cls.key) : '—';
  };

  const countryOptions = useMemo(
    () => taxCountryOptions(locale, rates.map((r) => r.country)),
    [locale, rates],
  );
  const classOptions = useMemo(
    () => classes.map((c) => ({ value: c.id, label: localizedTaxText(c.name, locale, c.key), description: c.key })),
    [classes, locale],
  );

  const filtered = useMemo(
    () =>
      rates
        .filter((r) => !filterCountry || r.country === filterCountry)
        .filter((r) => !filterClass || r.tax_class_id === filterClass)
        .sort(
          (a, b) =>
            a.country.localeCompare(b.country) ||
            (a.region || '').localeCompare(b.region || '') ||
            a.priority - b.priority ||
            b.rate_bp - a.rate_bp,
        ),
    [rates, filterCountry, filterClass],
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(classes, locales));
    setFormError('');
    setFieldErrors({});
    setDialogOpen(true);
  };

  const openEdit = (rate: TaxRateRow) => {
    setEditingId(rate.id);
    setForm(formFromRate(rate));
    setFormError('');
    setFieldErrors({});
    setDialogOpen(true);
  };

  const updateForm = (patch: Partial<RateForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    // Clear the inline error of every field being edited.
    const touched = Object.keys(patch) as (keyof RateForm)[];
    setFieldErrors((prev) => {
      const next = { ...prev };
      touched.forEach((key) => {
        if (key in next) delete next[key as RateFormField];
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (!token || saving) return;
    const rateBp = parseTaxRateBp(form.ratePercent);
    if (!form.tax_class_id || !form.country) {
      setFormError(t('rateRequiredFields'));
      return;
    }
    if (rateBp === null) {
      setFormError(t('invalidRate'));
      return;
    }

    // Mirror the API validation so the dialog explains the problem inline
    // instead of surfacing a raw 400.
    const errors: RateFormErrors = {};
    const region = form.region.trim().toUpperCase();
    const postcodePattern = form.postcode_pattern.trim();
    const priorityInput = form.priority.trim();
    const priority = priorityInput === '' ? 0 : Number(priorityInput);
    const label: Record<string, string> = Object.fromEntries(
      Object.entries(form.label)
        .map(([k, v]) => [k, v.trim()] as const)
        .filter(([, v]) => v),
    );
    const requiredLocale = requiredLabelLocale(locales);

    if (!Number.isInteger(priority) || priority < PRIORITY_MIN || priority > PRIORITY_MAX) {
      errors.priority = t('invalidPriority', { min: PRIORITY_MIN, max: PRIORITY_MAX });
    }
    if (Object.keys(label).length === 0) {
      errors.label = t('labelRequired');
    } else if (!label[requiredLocale]) {
      errors.label = t('labelLocaleRequired', { locale: requiredLocale.toUpperCase() });
    } else if (Object.values(label).some((v) => v.length > LABEL_MAX_LENGTH)) {
      errors.label = t('labelTooLong', { max: LABEL_MAX_LENGTH });
    }
    if (region && !REGION_PATTERN.test(region)) {
      errors.region = t('invalidRegion');
    }
    if (postcodePattern.length > POSTCODE_PATTERN_MAX_LENGTH) {
      errors.postcode_pattern = t('invalidPostcode', { max: POSTCODE_PATTERN_MAX_LENGTH });
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('');
      return;
    }

    const body = {
      tax_class_id: form.tax_class_id,
      country: form.country.toUpperCase(),
      region: region || null,
      postcode_pattern: postcodePattern || null,
      rate_bp: rateBp,
      label,
      priority,
      applies_to_shipping: form.applies_to_shipping,
      is_active: form.is_active,
    };
    setSaving(true);
    setFormError('');
    setFieldErrors({});
    try {
      if (editingId) {
        await api(`${endpoint}/${editingId}`, { method: 'PUT', token, body: JSON.stringify(body) });
      } else {
        await api(endpoint, { method: 'POST', token, body: JSON.stringify(body) });
      }
      setDialogOpen(false);
      await fetchRates();
    } catch (err) {
      setFormError((err instanceof Error && err.message) || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api(`${endpoint}/${deleteTarget.id}`, { method: 'DELETE', token });
      setDeleteTarget(null);
      await fetchRates();
    } catch (err) {
      setLoadError((err instanceof Error && err.message) || t('deleteFailed'));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // POST /taxes/admin/rates/seed — idempotent; the response count shape is
  // taken from the first numeric field the API returns.
  const handleSeed = async () => {
    if (!token || seeding) return;
    setSeeding(true);
    setSeedMsg(null);
    try {
      const res = await api<Record<string, unknown> | number>('/taxes/admin/rates/seed', { method: 'POST', token });
      let count: number | undefined;
      if (typeof res === 'number') count = res;
      else if (res && typeof res === 'object') {
        const candidate = ['rates_created', 'created', 'rates', 'count', 'inserted'].map((k) => res[k]).find((v) => typeof v === 'number');
        count = candidate as number | undefined;
      }
      setSeedMsg({ type: 'success', text: count === undefined ? t('seedRatesDoneNoCount') : t('seedRatesDone', { count }) });
      setSeedOpen(false);
      await fetchRates();
      onSeeded?.();
    } catch (err) {
      setSeedMsg({ type: 'error', text: (err instanceof Error && err.message) || t('seedRatesFailed') });
      setSeedOpen(false);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-4">
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}

      {/* Toolbar: filters + actions */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56 space-y-1">
          <Label className="text-xs">{t('filterCountry')}</Label>
          <SearchableSelect
            value={filterCountry}
            onChange={setFilterCountry}
            options={[{ value: '', label: t('allCountries') }, ...countryOptions]}
            placeholder={t('allCountries')}
          />
        </div>
        <div className="w-48 space-y-1">
          <Label className="text-xs">{t('filterClass')}</Label>
          <SearchableSelect
            value={filterClass}
            onChange={setFilterClass}
            options={[{ value: '', label: t('allClasses') }, ...classOptions]}
            placeholder={t('allClasses')}
          />
        </div>
        <div className="ms-auto flex items-center gap-2">
          {canSeed && (
            <Button size="sm" variant="outline" onClick={() => setSeedOpen(true)} disabled={seeding}>
              {seeding ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              {t('seedRates')}
            </Button>
          )}
          <Button size="sm" onClick={openCreate} disabled={classes.length === 0}>
            <Plus className="size-3.5" />
            {t('addRate')}
          </Button>
        </div>
      </div>

      {seedMsg && (
        <p className={`text-[11px] ${seedMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>{seedMsg.text}</p>
      )}
      {loadError && <p className="text-[11px] text-red-600">{loadError}</p>}

      <Card className="shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('country')}</TableHead>
                <TableHead>{t('region')}</TableHead>
                <TableHead>{t('postcode')}</TableHead>
                <TableHead>{t('taxClass')}</TableHead>
                <TableHead className="text-end">{t('rate')}</TableHead>
                <TableHead>{t('label')}</TableHead>
                <TableHead className="text-end">{t('priority')}</TableHead>
                <TableHead>{t('shipping')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-xs text-muted-foreground">
                    {tc('loading')}
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-xs text-muted-foreground">
                    {rates.length === 0 ? t('noRates') : tc('noResults')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((rate) => (
                  <TableRow key={rate.id} className={rate.is_active ? '' : 'opacity-60'}>
                    <TableCell className="text-xs whitespace-nowrap">{countryLabel(rate.country, locale)}</TableCell>
                    <TableCell className="text-xs">{rate.region || '—'}</TableCell>
                    <TableCell className="text-xs font-mono">{rate.postcode_pattern || '—'}</TableCell>
                    <TableCell className="text-xs">{className(rate.tax_class_id)}</TableCell>
                    <TableCell className="text-xs text-end font-medium tabular-nums">{formatTaxRateLabel(rate.rate_bp)}</TableCell>
                    <TableCell className="text-xs">{localizedTaxText(rate.label, locale, '—')}</TableCell>
                    <TableCell className="text-xs text-end tabular-nums">{rate.priority ?? 0}</TableCell>
                    <TableCell className="text-xs">
                      {rate.applies_to_shipping ? <Check className="size-3.5 text-emerald-600" /> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rate.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {rate.is_active ? t('active') : t('inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={tc('edit')} onClick={() => openEdit(rate)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={tc('delete')} className="text-red-500" onClick={() => setDeleteTarget(rate)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? t('editRate') : t('addRate')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('country')}</Label>
                <SearchableSelect
                  value={form.country}
                  onChange={(v) => setForm({ ...form, country: v })}
                  options={countryOptions}
                  placeholder={t('selectCountry')}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('taxClass')}</Label>
                <SearchableSelect
                  value={form.tax_class_id}
                  onChange={(v) => setForm({ ...form, tax_class_id: v })}
                  options={classOptions}
                  placeholder={t('selectClass')}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('region')}</Label>
                <Input
                  className="h-8 text-sm uppercase"
                  value={form.region}
                  onChange={(e) => updateForm({ region: e.target.value })}
                  placeholder={t('regionPlaceholder')}
                  aria-invalid={!!fieldErrors.region}
                />
                {fieldErrors.region ? (
                  <p className="text-[10px] text-red-600">{fieldErrors.region}</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">{t('regionHint')}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('postcode')}</Label>
                <Input
                  className="h-8 text-sm font-mono"
                  value={form.postcode_pattern}
                  onChange={(e) => updateForm({ postcode_pattern: e.target.value })}
                  placeholder="123*  /  10000-19999"
                  maxLength={POSTCODE_PATTERN_MAX_LENGTH}
                  aria-invalid={!!fieldErrors.postcode_pattern}
                />
                {fieldErrors.postcode_pattern ? (
                  <p className="text-[10px] text-red-600">{fieldErrors.postcode_pattern}</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">{t('postcodeHint')}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('rate')}</Label>
                <div className="relative w-32">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step={0.01}
                    className="h-8 text-sm pe-7"
                    value={form.ratePercent}
                    onChange={(e) => setForm({ ...form, ratePercent: e.target.value })}
                  />
                  <span className="pointer-events-none absolute inset-y-0 inset-e-0 flex items-center pe-2.5 text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('priority')}</Label>
                <Input
                  type="number"
                  min={PRIORITY_MIN}
                  max={PRIORITY_MAX}
                  step={1}
                  className="h-8 w-32 text-sm"
                  value={form.priority}
                  onChange={(e) => updateForm({ priority: e.target.value })}
                  aria-invalid={!!fieldErrors.priority}
                />
                {fieldErrors.priority ? (
                  <p className="text-[10px] text-red-600">{fieldErrors.priority}</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">{t('priorityHint')}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <LocalizedTextFields
                label={t('label')}
                locales={locales}
                value={form.label}
                onChange={(label) => updateForm({ label })}
                placeholder="VAT"
              />
              {fieldErrors.label && <p className="text-[10px] text-red-600">{fieldErrors.label}</p>}
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded accent-primary"
                  checked={form.applies_to_shipping}
                  onChange={(e) => setForm({ ...form, applies_to_shipping: e.target.checked })}
                />
                <span className="text-xs font-medium">{t('appliesToShipping')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded accent-primary"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                <span className="text-xs font-medium">{t('active')}</span>
              </label>
            </div>

            {formError && <p className="text-[11px] text-red-600">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={saving}>
              {tc('cancel')}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? tc('saving') : tc('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('deleteRate')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteTarget &&
              t('deleteRateConfirm', {
                country: countryLabel(deleteTarget.country, locale),
                rate: formatTaxRateLabel(deleteTarget.rate_bp),
              })}
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {tc('cancel')}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-3.5 animate-spin" />}
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seed confirmation (admin) */}
      {canSeed && (
        <Dialog open={seedOpen} onOpenChange={setSeedOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('seedRates')}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{t('seedRatesConfirm')}</p>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSeedOpen(false)} disabled={seeding}>
                {tc('cancel')}
              </Button>
              <Button size="sm" onClick={handleSeed} disabled={seeding}>
                {seeding && <Loader2 className="size-3.5 animate-spin" />}
                {tc('confirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
