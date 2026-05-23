'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CountryMultiSelect, countryFlag, COUNTRIES } from '@/components/common/CountryMultiSelect';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Plus, Pencil, Trash2, Globe } from 'lucide-react';
import { useCurrency } from '@/lib/useCurrency';

interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  base_cost: number;
  per_item_cost: number;
  free_threshold: number | null;
  estimated_days_min: number;
  estimated_days_max: number;
  is_active: boolean;
}

const emptyForm = {
  name: '',
  countries: [] as string[],
  base_cost: '',
  per_item_cost: '',
  free_threshold: '',
  estimated_days_min: '3',
  estimated_days_max: '7',
};

export default function AdminShipping() {
  const t = useTranslations('admin');
  const { fmt, currency } = useCurrency();
  const { token } = useAuth();
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchZones = async () => {
    if (!token) return;
    try {
      const res = await api<ShippingZone[]>('/shipping/global-zones', { token });
      setZones(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchZones(); }, [token]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (zone: ShippingZone) => {
    setEditingId(zone.id);
    setForm({
      name: zone.name,
      countries: zone.countries,
      base_cost: String(zone.base_cost),
      per_item_cost: String(zone.per_item_cost),
      free_threshold: zone.free_threshold != null ? String(zone.free_threshold) : '',
      estimated_days_min: String(zone.estimated_days_min),
      estimated_days_max: String(zone.estimated_days_max),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!token || !form.name || form.countries.length === 0) return;
    setSaving(true);
    try {
      const body = {
        name: form.name,
        countries: form.countries,
        base_cost: parseFloat(form.base_cost) || 0,
        per_item_cost: parseFloat(form.per_item_cost) || 0,
        free_threshold: form.free_threshold ? parseFloat(form.free_threshold) : null,
        estimated_days_min: parseInt(form.estimated_days_min) || 3,
        estimated_days_max: parseInt(form.estimated_days_max) || 7,
      };
      if (editingId) {
        await api(`/shipping/global-zones/${editingId}`, { method: 'PUT', token, body: JSON.stringify(body) });
      } else {
        await api('/shipping/global-zones', { method: 'POST', token, body: JSON.stringify(body) });
      }
      setShowForm(false);
      fetchZones();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    await api(`/shipping/global-zones/${id}`, { method: 'DELETE', token });
    setDeleteConfirm(null);
    fetchZones();
  };

  const handleToggleActive = async (zone: ShippingZone) => {
    if (!token) return;
    await api(`/shipping/global-zones/${zone.id}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ is_active: !zone.is_active }),
    });
    fetchZones();
  };

  const getCountryNames = (codes: string[]) =>
    codes.map(code => COUNTRIES.find(c => c.code === code)?.name || code);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('globalShippingZones')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('globalShippingZonesSubtitle')}
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1.5" /> {t('addZone')}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">{t('loading')}</p>
      ) : zones.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="py-16 text-center">
            <Globe className="w-8 h-8 mx-auto text-zinc-300 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">{t('noShippingZonesDefined')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('noShippingZonesHint')}
            </p>
            <Button size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" /> {t('addFirstZone')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {zones.map(zone => (
            <Card key={zone.id} className="shadow-none">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-semibold">{zone.name}</span>
                      {zone.is_active
                        ? <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700">{t('active')}</Badge>
                        : <Badge variant="secondary" className="text-[10px] bg-zinc-100 text-zinc-500">{t('inactive')}</Badge>}
                    </div>

                    {/* Countries */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {zone.countries.slice(0, 12).map(code => (
                        <span key={code} className="inline-flex items-center gap-0.5 text-[11px] bg-zinc-100 border border-zinc-200 rounded px-1.5 py-0.5">
                          <span>{countryFlag(code)}</span>
                          <span className="font-mono">{code}</span>
                        </span>
                      ))}
                      {zone.countries.length > 12 && (
                        <span className="text-[11px] text-muted-foreground px-1.5 py-0.5">
                          {t('countMore', { count: zone.countries.length - 12 })}
                        </span>
                      )}
                    </div>

                    {/* Pricing */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{t('base')}: <strong className="text-foreground">{fmt(zone.base_cost)}</strong></span>
                      <span>{t('perItem')}: <strong className="text-foreground">{fmt(zone.per_item_cost)}</strong></span>
                      {zone.free_threshold != null && (
                        <span>{t('freeAbove')}: <strong className="text-foreground">{fmt(zone.free_threshold)}</strong></span>
                      )}
                      <span>{t('delivery')}: <strong className="text-foreground">{t('daysRange', { min: zone.estimated_days_min, max: zone.estimated_days_max })}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => handleToggleActive(zone)}
                    >
                      {zone.is_active ? t('disable') : t('enable')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(zone)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500"
                      onClick={() => setDeleteConfirm(zone.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? t('editShippingZone') : t('createShippingZone')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('zoneName')} *</Label>
              <Input
                className="h-8 text-sm"
                placeholder={t('zoneNamePlaceholder')}
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('countriesSelected', { count: form.countries.length })}</Label>
              <CountryMultiSelect
                value={form.countries}
                onChange={countries => setForm({ ...form, countries })}
                placeholder={t('selectCountriesForZone')}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('baseCost', { currency })}</Label>
                <Input
                  className="h-8 text-sm"
                  type="number"
                  step="0.01"
                  placeholder="5.00"
                  value={form.base_cost}
                  onChange={e => setForm({ ...form, base_cost: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('perItemCost', { currency })}</Label>
                <Input
                  className="h-8 text-sm"
                  type="number"
                  step="0.01"
                  placeholder="1.00"
                  value={form.per_item_cost}
                  onChange={e => setForm({ ...form, per_item_cost: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('freeShippingThreshold', { currency })}</Label>
                <Input
                  className="h-8 text-sm"
                  type="number"
                  step="0.01"
                  placeholder={t('leaveBlankToDisable')}
                  value={form.free_threshold}
                  onChange={e => setForm({ ...form, free_threshold: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('estDaysMin')}</Label>
                <Input
                  className="h-8 text-sm"
                  type="number"
                  placeholder="3"
                  value={form.estimated_days_min}
                  onChange={e => setForm({ ...form, estimated_days_min: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('estDaysMax')}</Label>
                <Input
                  className="h-8 text-sm"
                  type="number"
                  placeholder="7"
                  value={form.estimated_days_max}
                  onChange={e => setForm({ ...form, estimated_days_max: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>{t('cancel')}</Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !form.name || form.countries.length === 0}
            >
              {saving ? t('saving') : editingId ? t('saveChanges') : t('createZone')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('deleteShippingZone')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {t('deleteShippingZoneConfirm')}
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>{t('cancel')}</Button>
            <Button variant="destructive" size="sm" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              {t('deleteZone')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
