'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { api } from '@/lib/api';
import { Plus, Pencil, Trash2, AlertCircle, ChevronDown, ChevronRight, Store, Truck } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShippingMethodType = 'DELIVERY' | 'PICKUP';

/** ShippingMethod row as returned by the API (decimals may arrive as strings). */
export interface ShippingMethod {
  id: string;
  zone_id: string;
  name: string;
  translations?: Record<string, string> | null;
  type: ShippingMethodType;
  base_cost: number | string;
  per_item_cost: number | string;
  free_threshold: number | string | null;
  estimated_days_min: number;
  estimated_days_max: number;
  is_active: boolean;
  sort_order: number;
}

/** Request body for POST /shipping/zones/:zoneId/methods and PUT /shipping/methods/:id. */
export interface ShippingMethodBody {
  name: string;
  translations: Record<string, string> | null;
  type: ShippingMethodType;
  base_cost: number;
  per_item_cost: number;
  free_threshold: number | null;
  estimated_days_min: number;
  estimated_days_max: number;
  is_active: boolean;
  sort_order: number;
}

/** Uncontrolled string state for the method form (parsed on submit). */
export interface MethodFormState {
  name: string;
  translations: Record<string, string>;
  type: ShippingMethodType;
  baseCost: string;
  perItem: string;
  freeThreshold: string;
  daysMin: string;
  daysMax: string;
  isActive: boolean;
  sortOrder: string;
}

export const DEFAULT_METHOD_NAME = 'Standard shipping';

export function emptyMethodForm(overrides: Partial<MethodFormState> = {}): MethodFormState {
  return {
    name: DEFAULT_METHOD_NAME,
    translations: {},
    type: 'DELIVERY',
    baseCost: '',
    perItem: '0',
    freeThreshold: '',
    daysMin: '3',
    daysMax: '7',
    isActive: true,
    sortOrder: '0',
    ...overrides,
  };
}

export function methodFormFromMethod(m: ShippingMethod): MethodFormState {
  return {
    name: m.name || '',
    translations: m.translations && typeof m.translations === 'object' ? { ...m.translations } : {},
    type: m.type === 'PICKUP' ? 'PICKUP' : 'DELIVERY',
    baseCost: m.base_cost != null ? String(m.base_cost) : '',
    perItem: m.per_item_cost != null ? String(m.per_item_cost) : '0',
    freeThreshold: m.free_threshold != null && m.free_threshold !== '' ? String(m.free_threshold) : '',
    daysMin: String(m.estimated_days_min || '3'),
    daysMax: String(m.estimated_days_max || '7'),
    isActive: m.is_active !== false,
    sortOrder: String(m.sort_order ?? 0),
  };
}

// Base cost must be a valid number — a blank field would otherwise be sent as
// NaN and rejected by the API with an opaque 500. Days must be positive ints.
export function isMethodFormValid(f: MethodFormState): boolean {
  const baseOk = f.baseCost.trim() !== '' && !isNaN(Number(f.baseCost));
  const min = parseInt(f.daysMin);
  const max = parseInt(f.daysMax);
  const daysOk = !isNaN(min) && !isNaN(max) && min >= 1 && max >= min;
  return f.name.trim() !== '' && baseOk && daysOk;
}

export function methodFormToBody(f: MethodFormState): ShippingMethodBody {
  // Only non-empty translations are sent; an empty block clears the column.
  const entries = Object.entries(f.translations)
    .map(([k, v]) => [k, (v || '').trim()] as const)
    .filter(([, v]) => v !== '');
  const isPickup = f.type === 'PICKUP';
  return {
    name: f.name.trim(),
    translations: entries.length ? Object.fromEntries(entries) : null,
    type: f.type,
    base_cost: parseFloat(f.baseCost),
    // Pickup has no per-item surcharge or free threshold.
    per_item_cost: isPickup ? 0 : parseFloat(f.perItem || '0'),
    free_threshold: !isPickup && f.freeThreshold ? parseFloat(f.freeThreshold) : null,
    estimated_days_min: parseInt(f.daysMin),
    estimated_days_max: parseInt(f.daysMax),
    is_active: f.isActive,
    sort_order: parseInt(f.sortOrder || '0') || 0,
  };
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

interface MethodFormFieldsProps {
  form: MethodFormState;
  onChange: (next: MethodFormState) => void;
  /** Store/platform content locales offered in the translations block. */
  locales: string[];
  currency: string;
  /** Hide active/sort-order controls (zone create dialog creates the default method). */
  compact?: boolean;
}

export function MethodFormFields({ form, onChange, locales, currency, compact = false }: MethodFormFieldsProps) {
  const t = useTranslations('shipping');
  const [showTranslations, setShowTranslations] = useState(
    () => Object.values(form.translations).some(v => (v || '').trim() !== ''),
  );
  const isPickup = form.type === 'PICKUP';
  const set = (patch: Partial<MethodFormState>) => onChange({ ...form, ...patch });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('methodName')} *</Label>
          <Input
            className="h-8 text-sm"
            placeholder={t('methodNamePlaceholder')}
            value={form.name}
            onChange={e => set({ name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('methodType')}</Label>
          <SearchableSelect
            value={form.type}
            onChange={v => set({ type: v === 'PICKUP' ? 'PICKUP' : 'DELIVERY' })}
            options={[
              { value: 'DELIVERY', label: t('typeDelivery') },
              { value: 'PICKUP', label: t('typePickup') },
            ]}
          />
        </div>
      </div>

      {locales.length > 0 && (
        <div className="rounded-lg border border-dashed">
          <button
            type="button"
            className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setShowTranslations(v => !v)}
          >
            {showTranslations ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5 rtl:rotate-180" />}
            {t('translations')}
            <span className="font-normal">({t('optional')})</span>
          </button>
          {showTranslations && (
            <div className="grid grid-cols-2 gap-3 px-3 pb-3">
              {locales.map(locale => (
                <div key={locale} className="space-y-1">
                  <Label className="text-[11px] uppercase text-muted-foreground">{locale}</Label>
                  <Input
                    className="h-8 text-sm"
                    placeholder={form.name || DEFAULT_METHOD_NAME}
                    value={form.translations[locale] || ''}
                    onChange={e => set({ translations: { ...form.translations, [locale]: e.target.value } })}
                  />
                </div>
              ))}
              <p className="col-span-2 text-[10px] text-muted-foreground">{t('translationsHint')}</p>
            </div>
          )}
        </div>
      )}

      <div className={`grid gap-3 ${isPickup ? 'grid-cols-1' : 'grid-cols-3'}`}>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('baseShippingCost', { currency })}</Label>
          <Input type="number" step="0.01" min="0" className="h-8 text-sm" placeholder="0.00" value={form.baseCost} onChange={e => set({ baseCost: e.target.value })} />
        </div>
        {!isPickup && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('perAdditionalItem', { currency })}</Label>
              <Input type="number" step="0.01" min="0" className="h-8 text-sm" placeholder="0.00" value={form.perItem} onChange={e => set({ perItem: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('freeShippingAbove', { currency })}</Label>
              <Input type="number" step="0.01" min="0" className="h-8 text-sm" placeholder={t('optional')} value={form.freeThreshold} onChange={e => set({ freeThreshold: e.target.value })} />
            </div>
          </>
        )}
      </div>

      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <div className="space-y-1.5">
          <Label className="text-xs">{isPickup ? t('readyIn') : t('estimatedDelivery')}</Label>
          <div className="flex gap-1.5 items-center">
            <Input type="number" min="1" className="h-8 text-sm" placeholder={t('min')} value={form.daysMin} onChange={e => set({ daysMin: e.target.value })} />
            <span className="text-xs text-muted-foreground shrink-0">{t('to')}</span>
            <Input type="number" min="1" className="h-8 text-sm" placeholder={t('max')} value={form.daysMax} onChange={e => set({ daysMax: e.target.value })} />
            <span className="text-xs text-muted-foreground shrink-0">{t('days')}</span>
          </div>
        </div>
        {!compact && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('sortOrder')}</Label>
              <Input type="number" min="0" step="1" className="h-8 text-sm" value={form.sortOrder} onChange={e => set({ sortOrder: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('active')}</Label>
              <label className="flex h-8 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-zinc-300"
                  checked={form.isActive}
                  onChange={e => set({ isActive: e.target.checked })}
                />
                <span className="text-xs text-muted-foreground">{form.isActive ? t('active') : t('inactive')}</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-zone methods list + dialogs
// ---------------------------------------------------------------------------

interface ZoneMethodsProps {
  zone: {
    id: string;
    methods?: ShippingMethod[] | null;
    base_cost?: number | string;
    per_item_cost?: number | string;
    free_threshold?: number | string | null;
    estimated_days_min?: number;
    estimated_days_max?: number;
  };
  token: string;
  locales: string[];
  currency: string;
  fmt: (amount: number | string) => string;
  /** Called after any successful create/update/delete so the parent can refetch. */
  onChanged: () => Promise<void> | void;
}

/** Human-readable message from a thrown api() error, with a translated fallback. */
function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      {message}
    </div>
  );
}

export function ZoneMethods({ zone, token, locales, currency, fmt, onChanged }: ZoneMethodsProps) {
  const t = useTranslations('shipping');
  const tc = useTranslations('common');

  const [editing, setEditing] = useState<ShippingMethod | 'new' | null>(null);
  const [form, setForm] = useState<MethodFormState>(emptyMethodForm());
  const [confirm, setConfirm] = useState<ShippingMethod | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [rowError, setRowError] = useState('');

  const methods = (Array.isArray(zone.methods) ? zone.methods : [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const openAdd = () => {
    setFormError('');
    setForm(emptyMethodForm({
      // Seed a fresh method from the zone's legacy rate so the values stay in sync.
      baseCost: methods.length === 0 && zone.base_cost != null ? String(zone.base_cost) : '',
      perItem: methods.length === 0 && zone.per_item_cost != null ? String(zone.per_item_cost) : '0',
      freeThreshold: methods.length === 0 && zone.free_threshold != null ? String(zone.free_threshold) : '',
      daysMin: String(zone.estimated_days_min || 3),
      daysMax: String(zone.estimated_days_max || 7),
      sortOrder: String(methods.length),
    }));
    setEditing('new');
  };

  const openEdit = (m: ShippingMethod) => {
    setFormError('');
    setForm(methodFormFromMethod(m));
    setEditing(m);
  };

  const closeForm = () => {
    setEditing(null);
    setFormError('');
  };

  const handleSave = async () => {
    if (!editing || !isMethodFormValid(form)) return;
    setSaving(true);
    setFormError('');
    try {
      const body = methodFormToBody(form);
      if (editing === 'new') {
        await api(`/shipping/zones/${zone.id}/methods`, { method: 'POST', token, body: JSON.stringify(body) });
      } else {
        await api(`/shipping/methods/${editing.id}`, { method: 'PUT', token, body: JSON.stringify(body) });
      }
      closeForm();
      await onChanged();
    } catch (err: unknown) {
      console.error(err);
      setFormError(errorMessage(err, t('saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (m: ShippingMethod) => {
    setToggling(m.id);
    setRowError('');
    try {
      const body = methodFormToBody({ ...methodFormFromMethod(m), isActive: !m.is_active });
      await api(`/shipping/methods/${m.id}`, { method: 'PUT', token, body: JSON.stringify(body) });
      await onChanged();
    } catch (err: unknown) {
      console.error(err);
      setRowError(errorMessage(err, t('saveFailed')));
    } finally {
      setToggling(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    setFormError('');
    try {
      await api(`/shipping/methods/${confirm.id}`, { method: 'DELETE', token });
      setConfirm(null);
      await onChanged();
    } catch (err: unknown) {
      console.error(err);
      setFormError(errorMessage(err, t('deleteFailed')));
    } finally {
      setDeleting(false);
    }
  };

  const typeBadge = (type: ShippingMethodType) => (
    type === 'PICKUP' ? (
      <Badge variant="secondary" className="text-[10px] gap-1 bg-violet-50 text-violet-700">
        <Store className="size-2.5" /> {t('typePickup')}
      </Badge>
    ) : (
      <Badge variant="outline" className="text-[10px] gap-1">
        <Truck className="size-2.5" /> {t('typeDelivery')}
      </Badge>
    )
  );

  const columnHeaders = (
    <div className="grid grid-cols-12 gap-2 px-2 text-[10px] text-muted-foreground">
      <span className="col-span-4">{t('methodName')}</span>
      <span className="col-span-2">{t('baseCost')}</span>
      <span className="col-span-2">{t('perExtraItem')}</span>
      <span className="col-span-2">{t('freeShippingAboveShort')}</span>
      <span className="col-span-2">{t('estDelivery')}</span>
    </div>
  );

  return (
    <div className="pt-2 border-t border-dashed space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground">
          {t('methods')}
          {methods.length > 0 && <span className="ms-1.5 font-normal">({methods.length})</span>}
        </p>
        <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={openAdd}>
          <Plus className="size-3 me-1" /> {t('addMethod')}
        </Button>
      </div>

      {rowError && <ErrorBanner message={rowError} />}

      {methods.length === 0 ? (
        // Legacy zone without methods: show the zone's own rate read-only and
        // prompt to create the first method (which is seeded from it).
        <div className="rounded-md border bg-zinc-50/60 px-2 py-2 space-y-1.5">
          {columnHeaders}
          <div className="grid grid-cols-12 gap-2 items-center px-2 text-xs opacity-70">
            <span className="col-span-4 flex items-center gap-1.5">
              <span className="font-medium truncate">{DEFAULT_METHOD_NAME}</span>
              {typeBadge('DELIVERY')}
            </span>
            <span className="col-span-2 font-semibold">{zone.base_cost != null ? fmt(zone.base_cost) : '—'}</span>
            <span className="col-span-2 font-semibold">{zone.per_item_cost != null ? fmt(zone.per_item_cost) : '—'}</span>
            <span className="col-span-2 font-semibold">{zone.free_threshold != null ? fmt(Number(zone.free_threshold)) : '—'}</span>
            <span className="col-span-2 font-semibold">
              {zone.estimated_days_min != null
                ? t('daysRange', { min: zone.estimated_days_min, max: zone.estimated_days_max ?? zone.estimated_days_min })
                : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 px-2 pt-1 text-[10px] text-muted-foreground">
            <span>{t('noMethodsYet')}</span>
            <Button variant="outline" size="sm" className="h-6 text-[11px] shrink-0" onClick={openAdd}>
              <Plus className="size-3 me-1" /> {t('addMethod')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {columnHeaders}
          {methods.map(m => {
            const isPickup = m.type === 'PICKUP';
            return (
              <div
                key={m.id}
                className={`grid grid-cols-12 gap-2 items-center rounded-md border px-2 py-1.5 text-xs ${m.is_active ? 'bg-white' : 'bg-zinc-50 text-muted-foreground'}`}
              >
                <div className="col-span-4 flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0" title={t('sortOrder')}>#{m.sort_order ?? 0}</span>
                  <span className="font-medium truncate" title={m.name}>{m.name}</span>
                  {typeBadge(m.type)}
                  {!m.is_active && (
                    <Badge variant="secondary" className="text-[10px] bg-zinc-100 text-zinc-500">{t('inactive')}</Badge>
                  )}
                </div>
                <span className="col-span-2 font-semibold">{fmt(m.base_cost)}</span>
                <span className="col-span-2 font-semibold">{isPickup ? '—' : fmt(m.per_item_cost)}</span>
                <span className="col-span-2 font-semibold">{!isPickup && m.free_threshold != null ? fmt(Number(m.free_threshold)) : '—'}</span>
                <div className="col-span-2 flex items-center justify-between gap-1">
                  <span className="font-semibold" title={isPickup ? t('readyIn') : t('estDelivery')}>
                    {t('daysRange', { min: m.estimated_days_min, max: m.estimated_days_max })}
                  </span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={m.is_active}
                      title={m.is_active ? t('active') : t('inactive')}
                      disabled={toggling === m.id}
                      onClick={() => handleToggleActive(m)}
                      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition disabled:opacity-50 ${m.is_active ? 'bg-emerald-500' : 'bg-zinc-300'}`}
                    >
                      <span className={`inline-block size-3 rounded-full bg-white shadow transition ${m.is_active ? 'translate-x-3.5 rtl:-translate-x-3.5' : 'translate-x-0.5 rtl:-translate-x-0.5'}`} />
                    </button>
                    <Button variant="ghost" size="icon" className="size-6" onClick={() => openEdit(m)} title={t('editMethod')}>
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => { setFormError(''); setConfirm(m); }}
                      title={t('deleteMethod')}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit method dialog */}
      <Dialog open={!!editing} onOpenChange={v => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? t('addMethod') : t('editMethod')}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <MethodFormFields form={form} onChange={setForm} locales={locales} currency={currency} />
          </div>
          <ErrorBanner message={formError} />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeForm}>{tc('cancel')}</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !isMethodFormValid(form)}>
              {saving ? tc('saving') : editing === 'new' ? t('addMethod') : t('saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Two-step delete confirmation */}
      <Dialog open={!!confirm} onOpenChange={v => { if (!v && !deleting) { setConfirm(null); setFormError(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('deleteMethod')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-1">
            {t('deleteConfirmName', { name: confirm?.name ?? '' })} {t('actionCannotBeUndone')}
          </p>
          <ErrorBanner message={formError} />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setConfirm(null); setFormError(''); }} disabled={deleting}>{tc('cancel')}</Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? t('deleting') : tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
