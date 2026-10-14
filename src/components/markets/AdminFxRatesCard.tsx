'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/useApiError';
import { useTransientFlag } from '@/lib/useTransientFlag';
import { SUPPORTED_CURRENCY_OPTIONS } from '@/lib/supportedCurrencies';
import { adminGetFxRates, adminPutFxRates, deleteFxRate, type FxRateRow } from '@/lib/markets.api';

// Rate kept as text while editing so clearing the field doesn't snap to 0.
// `persisted` rows exist on the server and are removed through the API.
interface RateDraft {
  base: string;
  quote: string;
  rate: string;
  persisted: boolean;
}

const toDraft = (r: FxRateRow): RateDraft => ({ base: r.base, quote: r.quote, rate: String(r.rate), persisted: true });

/**
 * Platform FX table (L3): base → quote rates used by markets whose price rule
 * has `source: 'platform'`. Rows are added/edited and saved as a whole through
 * PUT /markets/admin/fx-rates; a saved row is removed with DELETE .../:base/:quote.
 */
export function AdminFxRatesCard() {
  const t = useTranslations('admin.fxRates');
  const { token } = useAuth();
  const describeError = useApiError();
  const [rates, setRates] = useState<RateDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, flashSaved] = useTransientFlag();
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    adminGetFxRates(token)
      .then((list) => { if (!cancelled) setRates(Array.isArray(list) ? list.map(toDraft) : []); })
      .catch((err: unknown) => { if (!cancelled) setLoadError(describeError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- describeError is stable for the mounted locale
  }, [token]);

  const update = (i: number, patch: Partial<RateDraft>) =>
    setRates((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const [removing, setRemoving] = useState<number | null>(null);

  const valid = rates.every((r) => r.base && r.quote && r.base !== r.quote && Number(r.rate) > 0);

  const handleRemove = async (i: number) => {
    const row = rates[i];
    if (!row || removing !== null) return;
    // Unsaved rows only exist locally.
    if (!row.persisted) {
      setRates((prev) => prev.filter((_, idx) => idx !== i));
      return;
    }
    if (!token || !window.confirm(t('removeConfirm', { pair: `${row.base} → ${row.quote}` }))) return;
    setRemoving(i);
    setSaveError(null);
    try {
      const res = await deleteFxRate(token, row.base, row.quote);
      setRates(Array.isArray(res) ? res.map(toDraft) : rates.filter((_, idx) => idx !== i));
    } catch (err) {
      setSaveError(describeError(err));
    } finally {
      setRemoving(null);
    }
  };

  const handleSave = async () => {
    if (!token || saving || !valid) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await adminPutFxRates(token, rates.map((r) => ({ base: r.base, quote: r.quote, rate: Number(r.rate) })));
      if (Array.isArray(res)) setRates(res.map(toDraft));
      flashSaved();
    } catch (err) {
      setSaveError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
        <p className="text-[11px] text-muted-foreground">{t('subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-xs text-muted-foreground">…</p>
        ) : loadError ? (
          <p className="text-[11px] text-red-600">{loadError}</p>
        ) : (
          <>
            {rates.length === 0 && <p className="text-xs text-muted-foreground">{t('empty')}</p>}
            {rates.map((r, i) => (
              <div key={i} className="grid items-center gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                <SearchableSelect value={r.base} onChange={(v) => update(i, { base: v })} placeholder={t('base')} options={SUPPORTED_CURRENCY_OPTIONS} />
                <SearchableSelect value={r.quote} onChange={(v) => update(i, { quote: v })} placeholder={t('quote')} options={SUPPORTED_CURRENCY_OPTIONS} />
                <Input
                  className="h-8 text-sm"
                  type="number"
                  min={0}
                  step="0.00000001"
                  dir="ltr"
                  value={r.rate}
                  placeholder={t('rate')}
                  onChange={(e) => update(i, { rate: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  aria-label={t('remove')}
                  disabled={removing !== null || saving}
                  onClick={() => handleRemove(i)}
                >
                  {removing === i ? <Loader2 className="animate-spin" /> : <Trash2 />}
                </Button>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setRates((prev) => [...prev, { base: '', quote: '', rate: '', persisted: false }])}>
                <Plus /> {t('add')}
              </Button>
              <div className="flex items-center gap-2">
                {saved && <span className="text-xs font-medium text-emerald-600">{t('saved')}</span>}
                {saveError && <span className="text-xs text-red-600">{saveError}</span>}
                <Button type="button" size="sm" disabled={saving || !valid} onClick={handleSave}>
                  {saving ? <Loader2 className="animate-spin" /> : null} {t('save')}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
