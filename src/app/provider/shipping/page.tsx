'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Globe, Trash2, Truck, Pencil, Star, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { CountryMultiSelect, countryFlag, COUNTRIES } from '@/components/common/CountryMultiSelect';
import { useCurrency } from '@/lib/useCurrency';
import { useTranslations } from 'next-intl';

type Translator = ReturnType<typeof useTranslations>;

function getCountryName(code: string): string {
  return COUNTRIES.find(c => c.code === code)?.name ?? code;
}

/** Returns a set of country codes that appear in more than one zone within the profile */
function getDuplicateCountries(zones: any[]): Set<string> {
  const seen = new Map<string, number>();
  for (const zone of zones) {
    const codes: string[] = Array.isArray(zone.countries)
      ? zone.countries
      : (zone.countries || '').split(',').map((c: string) => c.trim()).filter(Boolean);
    codes.forEach(c => seen.set(c, (seen.get(c) || 0) + 1));
  }
  const dupes = new Set<string>();
  seen.forEach((count, code) => { if (count > 1) dupes.add(code); });
  return dupes;
}

// Reusable zone form fields — extracted as a plain function returning JSX (not a component)
// so it can be inlined without remount issues
function zoneFormFields(
  zoneName: string, setZoneName: (v: string) => void,
  zoneCountries: string[], setZoneCountries: (v: string[]) => void,
  zoneBaseCost: string, setZoneBaseCost: (v: string) => void,
  zonePerItem: string, setZonePerItem: (v: string) => void,
  zoneFreeThreshold: string, setZoneFreeThreshold: (v: string) => void,
  zoneDaysMin: string, setZoneDaysMin: (v: string) => void,
  zoneDaysMax: string, setZoneDaysMax: (v: string) => void,
  currency: string,
  t: Translator,
) {
  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('zoneName')}</Label>
          <Input
            className="h-8 text-sm"
            placeholder={t('zoneNamePlaceholder')}
            value={zoneName}
            onChange={e => setZoneName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('estimatedDelivery')}</Label>
          <div className="flex gap-1.5 items-center">
            <Input type="number" min="1" className="h-8 text-sm" placeholder={t('min')} value={zoneDaysMin} onChange={e => setZoneDaysMin(e.target.value)} />
            <span className="text-xs text-muted-foreground shrink-0">{t('to')}</span>
            <Input type="number" min="1" className="h-8 text-sm" placeholder={t('max')} value={zoneDaysMax} onChange={e => setZoneDaysMax(e.target.value)} />
            <span className="text-xs text-muted-foreground shrink-0">{t('days')}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">{t('countries')}</Label>
        <CountryMultiSelect
          value={zoneCountries}
          onChange={setZoneCountries}
          placeholder={t('selectCountriesPlaceholder')}
        />
        {zoneCountries.length > 0 && (
          <p className="text-[10px] text-muted-foreground">{t('countriesSelected', { count: zoneCountries.length })}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('baseShippingCost', { currency })}</Label>
          <Input type="number" step="0.01" min="0" className="h-8 text-sm" placeholder="0.00" value={zoneBaseCost} onChange={e => setZoneBaseCost(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('perAdditionalItem', { currency })}</Label>
          <Input type="number" step="0.01" min="0" className="h-8 text-sm" placeholder="0.00" value={zonePerItem} onChange={e => setZonePerItem(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('freeShippingAbove', { currency })}</Label>
          <Input type="number" step="0.01" min="0" className="h-8 text-sm" placeholder={t('optional')} value={zoneFreeThreshold} onChange={e => setZoneFreeThreshold(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

interface ConfirmState {
  type: 'zone' | 'profile';
  id: string;
  name: string;
}

export default function ProviderShipping() {
  const { fmt, currency } = useCurrency();
  const { token } = useAuth();
  const t = useTranslations('provider');
  const tc = useTranslations('common');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  // Dialogs
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [showAddZone, setShowAddZone] = useState<string | null>(null); // profileId
  const [editingZone, setEditingZone] = useState<any>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Zone form state
  const [zoneName, setZoneName] = useState('');
  const [zoneCountries, setZoneCountries] = useState<string[]>([]);
  const [zoneBaseCost, setZoneBaseCost] = useState('');
  const [zonePerItem, setZonePerItem] = useState('0');
  const [zoneFreeThreshold, setZoneFreeThreshold] = useState('');
  const [zoneDaysMin, setZoneDaysMin] = useState('3');
  const [zoneDaysMax, setZoneDaysMax] = useState('7');

  // Profile form state
  const [profileName, setProfileName] = useState('');

  const fetchProfiles = async () => {
    if (!token) return;
    try {
      const res = await api<any[]>('/shipping/profiles', { token });
      setProfiles(Array.isArray(res) ? res : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProfiles(); }, [token]);

  const resetZoneForm = () => {
    setZoneName('');
    setZoneCountries([]);
    setZoneBaseCost('');
    setZonePerItem('0');
    setZoneFreeThreshold('');
    setZoneDaysMin('3');
    setZoneDaysMax('7');
  };

  const handleAddProfile = async () => {
    if (!token || !profileName) return;
    setSaving(true);
    try {
      await api('/shipping/profiles', {
        method: 'POST', token,
        body: JSON.stringify({ name: profileName, is_default: profiles.length === 0 }),
      });
      setShowAddProfile(false);
      setProfileName('');
      await fetchProfiles();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleAddZone = async () => {
    if (!token || !showAddZone || !zoneName || zoneCountries.length === 0 || !zoneBaseCost) return;
    setSaving(true);
    try {
      await api(`/shipping/profiles/${showAddZone}/zones`, {
        method: 'POST', token,
        body: JSON.stringify({
          name: zoneName,
          countries: zoneCountries,
          base_cost: parseFloat(zoneBaseCost),
          per_item_cost: parseFloat(zonePerItem || '0'),
          free_threshold: zoneFreeThreshold ? parseFloat(zoneFreeThreshold) : undefined,
          estimated_days_min: parseInt(zoneDaysMin),
          estimated_days_max: parseInt(zoneDaysMax),
        }),
      });
      setShowAddZone(null);
      resetZoneForm();
      await fetchProfiles();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const openEditZone = (zone: any) => {
    setEditingZone(zone);
    setZoneName(zone.name || '');
    setZoneCountries(
      Array.isArray(zone.countries)
        ? zone.countries
        : (zone.countries || '').split(',').map((c: string) => c.trim()).filter(Boolean),
    );
    setZoneBaseCost(String(zone.base_cost || ''));
    setZonePerItem(String(zone.per_item_cost || '0'));
    setZoneFreeThreshold(zone.free_threshold ? String(zone.free_threshold) : '');
    setZoneDaysMin(String(zone.estimated_days_min || '3'));
    setZoneDaysMax(String(zone.estimated_days_max || '7'));
  };

  const handleUpdateZone = async () => {
    if (!token || !editingZone || !zoneName || zoneCountries.length === 0) return;
    setSaving(true);
    try {
      await api(`/shipping/zones/${editingZone.id}`, {
        method: 'PUT', token,
        body: JSON.stringify({
          name: zoneName,
          countries: zoneCountries,
          base_cost: parseFloat(zoneBaseCost),
          per_item_cost: parseFloat(zonePerItem || '0'),
          free_threshold: zoneFreeThreshold ? parseFloat(zoneFreeThreshold) : undefined,
          estimated_days_min: parseInt(zoneDaysMin),
          estimated_days_max: parseInt(zoneDaysMax),
        }),
      });
      setEditingZone(null);
      resetZoneForm();
      await fetchProfiles();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleSetDefault = async (profileId: string) => {
    if (!token) return;
    setSettingDefault(profileId);
    try {
      await api(`/shipping/profiles/${profileId}/default`, { method: 'PUT', token });
      await fetchProfiles();
    } catch (err) { console.error(err); }
    finally { setSettingDefault(null); }
  };

  const handleConfirmDelete = async () => {
    if (!token || !confirm) return;
    setDeleting(true);
    try {
      if (confirm.type === 'zone') {
        await api(`/shipping/zones/${confirm.id}`, { method: 'DELETE', token });
      } else {
        await api(`/shipping/profiles/${confirm.id}`, { method: 'DELETE', token });
      }
      setConfirm(null);
      await fetchProfiles();
    } catch (err) { console.error(err); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('shipping')}</h1>
          <p className="text-sm text-muted-foreground">{t('shippingSubtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setShowAddProfile(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> {t('newProfile')}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">{tc('loading')}</p>
      ) : profiles.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center py-16">
            <Truck className="w-8 h-8 text-zinc-300 mb-3" />
            <p className="text-sm font-medium mb-1">{t('noShippingProfiles')}</p>
            <p className="text-xs text-muted-foreground mb-4 text-center max-w-xs">
              {t('noShippingProfilesHint')}
            </p>
            <Button size="sm" onClick={() => setShowAddProfile(true)}>{t('createShippingProfile')}</Button>
          </CardContent>
        </Card>
      ) : (
        profiles.map(profile => {
          const duplicates = getDuplicateCountries(profile.zones || []);
          return (
          <Card key={profile.id} className="shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold">{profile.name}</CardTitle>
                  {profile.is_default && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Star className="w-2.5 h-2.5" /> {t('default')}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {t('zoneCount', { count: profile.zones?.length || 0 })}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  {!profile.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      disabled={settingDefault === profile.id}
                      onClick={() => handleSetDefault(profile.id)}
                    >
                      {settingDefault === profile.id ? tc('saving') : t('setDefault')}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { resetZoneForm(); setShowAddZone(profile.id); }}
                  >
                    <Plus className="w-3 h-3 mr-1" /> {t('addZone')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setConfirm({ type: 'profile', id: profile.id, name: profile.name })}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {!profile.zones?.length ? (
                <div className="border border-dashed rounded-lg py-6 text-center">
                  <Globe className="w-5 h-5 text-zinc-300 mx-auto mb-1.5" />
                  <p className="text-xs text-muted-foreground">{t('noZonesYet')}</p>
                </div>
              ) : (
                profile.zones.map((zone: any) => {
                  const codes: string[] = Array.isArray(zone.countries)
                    ? zone.countries
                    : (zone.countries || '').split(',').map((c: string) => c.trim()).filter(Boolean);

                  return (
                    <div key={zone.id} className="p-3 border rounded-lg hover:bg-zinc-50/50 transition">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium">{zone.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {t('countryCount', { count: codes.length })}
                          </span>
                        </div>
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditZone(zone)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setConfirm({ type: 'zone', id: zone.id, name: zone.name })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Country flags — highlight duplicates */}
                      <div className="flex flex-wrap gap-1 mb-2.5">
                        {codes.slice(0, 12).map(code => {
                          const isDupe = duplicates.has(code);
                          return (
                            <span
                              key={code}
                              title={isDupe ? t('countryDuplicateTooltip', { country: getCountryName(code) }) : getCountryName(code)}
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] border ${
                                isDupe
                                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                                  : 'bg-zinc-100 border-zinc-200'
                              }`}
                            >
                              <span>{countryFlag(code)}</span>
                              <span className="font-mono">{code}</span>
                              {isDupe && <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />}
                            </span>
                          );
                        })}
                        {codes.length > 12 && (
                          <span className="inline-flex items-center bg-zinc-100 border border-zinc-200 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            {t('moreCount', { count: codes.length - 12 })}
                          </span>
                        )}
                      </div>
                      {/* Conflict warning */}
                      {codes.some(c => duplicates.has(c)) && (
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {t('zoneOverlapWarning')}
                        </div>
                      )}

                      {/* Rates */}
                      <div className="grid grid-cols-4 gap-3 text-xs pt-2 border-t border-dashed">
                        <div>
                          <p className="text-muted-foreground text-[10px] mb-0.5">{t('baseCost')}</p>
                          <p className="font-semibold">{fmt(zone.base_cost)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px] mb-0.5">{t('perExtraItem')}</p>
                          <p className="font-semibold">{fmt(zone.per_item_cost)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px] mb-0.5">{t('freeShippingAboveShort')}</p>
                          <p className="font-semibold">{zone.free_threshold ? `${fmt(Number(zone.free_threshold))}` : '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px] mb-0.5">{t('estDelivery')}</p>
                          <p className="font-semibold">{t('daysRange', { min: zone.estimated_days_min, max: zone.estimated_days_max })}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
          );
        })
      )}

      {/* ── Add Profile Dialog ── */}
      <Dialog open={showAddProfile} onOpenChange={v => { if (!v) { setShowAddProfile(false); setProfileName(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('newShippingProfile')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('profileName')}</Label>
              <Input
                className="h-9 text-sm"
                placeholder={t('profileNamePlaceholder')}
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddProfile()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setShowAddProfile(false); setProfileName(''); }}>{tc('cancel')}</Button>
            <Button size="sm" onClick={handleAddProfile} disabled={saving || !profileName}>
              {saving ? t('creating') : t('createProfile')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Zone Dialog ── */}
      <Dialog open={!!showAddZone} onOpenChange={v => { if (!v) { setShowAddZone(null); resetZoneForm(); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t('addShippingZone')}</DialogTitle></DialogHeader>
          {zoneFormFields(
            zoneName, setZoneName,
            zoneCountries, setZoneCountries,
            zoneBaseCost, setZoneBaseCost,
            zonePerItem, setZonePerItem,
            zoneFreeThreshold, setZoneFreeThreshold,
            zoneDaysMin, setZoneDaysMin,
            zoneDaysMax, setZoneDaysMax,
            currency,
            t,
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setShowAddZone(null); resetZoneForm(); }}>{tc('cancel')}</Button>
            <Button
              size="sm"
              onClick={handleAddZone}
              disabled={saving || !zoneName || zoneCountries.length === 0 || !zoneBaseCost}
            >
              {saving ? t('adding') : t('addZone')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Zone Dialog ── */}
      <Dialog open={!!editingZone} onOpenChange={v => { if (!v) { setEditingZone(null); resetZoneForm(); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t('editZone', { name: editingZone?.name })}</DialogTitle></DialogHeader>
          {zoneFormFields(
            zoneName, setZoneName,
            zoneCountries, setZoneCountries,
            zoneBaseCost, setZoneBaseCost,
            zonePerItem, setZonePerItem,
            zoneFreeThreshold, setZoneFreeThreshold,
            zoneDaysMin, setZoneDaysMin,
            zoneDaysMax, setZoneDaysMax,
            currency,
            t,
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setEditingZone(null); resetZoneForm(); }}>{tc('cancel')}</Button>
            <Button
              size="sm"
              onClick={handleUpdateZone}
              disabled={saving || !zoneName || zoneCountries.length === 0}
            >
              {saving ? tc('saving') : t('saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Delete Dialog ── */}
      <Dialog open={!!confirm} onOpenChange={v => { if (!v && !deleting) setConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirm?.type === 'profile' ? t('deleteProfile') : t('deleteZone')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-1">
            {t('deleteConfirmName', { name: confirm?.name ?? '' })}
            {confirm?.type === 'profile' && (
              <span className="block mt-1 text-red-600 text-xs">{t('deleteProfileWarning')}</span>
            )}
            {' '}{t('actionCannotBeUndone')}
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirm(null)} disabled={deleting}>{tc('cancel')}</Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? t('deleting') : tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
