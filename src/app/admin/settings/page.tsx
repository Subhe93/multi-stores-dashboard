'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { clearCurrencyCache } from '@/lib/useCurrency';
import { CURRENCIES } from '@/lib/currencies';

interface PlatformConfig {
  commission_type: string;
  commission_value: number;
  default_currency: string;
  default_locale: string;
  supported_locales: string[];
  platform_name: string;
  support_email: string | null;
  min_order_amount: number | null;
  require_provider_approval: boolean;
  require_creator_approval: boolean;
}

const LOCALES = [
  { value: 'en', label: 'English', description: 'English (en)' },
  { value: 'ar', label: 'العربية', description: 'Arabic (ar)' },
  { value: 'tr', label: 'Türkçe', description: 'Turkish (tr)' },
  { value: 'de', label: 'Deutsch', description: 'German (de)' },
  { value: 'fr', label: 'Français', description: 'French (fr)' },
];

const ALL_LOCALE_CODES = LOCALES.map(l => l.value);

export default function AdminSettings() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState<PlatformConfig>({
    commission_type: 'percentage',
    commission_value: 15,
    default_currency: 'EUR',
    default_locale: 'en',
    supported_locales: ['en'],
    platform_name: 'Multi Stores',
    support_email: '',
    min_order_amount: null,
    require_provider_approval: true,
    require_creator_approval: true,
  });

  useEffect(() => {
    if (!token) return;
    api<PlatformConfig>('/admin/platform-config', { token })
      .then(config => {
        if (config) setForm({
          commission_type: config.commission_type || 'percentage',
          commission_value: Number(config.commission_value) || 15,
          default_currency: config.default_currency || 'EUR',
          default_locale: config.default_locale || 'en',
          supported_locales: config.supported_locales?.length ? config.supported_locales : ['en'],
          platform_name: config.platform_name || 'Multi Stores',
          support_email: config.support_email || '',
          min_order_amount: config.min_order_amount ? Number(config.min_order_amount) : null,
          require_provider_approval: config.require_provider_approval ?? true,
          require_creator_approval: config.require_creator_approval ?? true,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setSaved(false);
    try {
      await api('/admin/platform-config', {
        method: 'PUT',
        token,
        body: JSON.stringify({
          ...form,
          commission_value: parseFloat(String(form.commission_value)),
          min_order_amount: form.min_order_amount ? parseFloat(String(form.min_order_amount)) : null,
          support_email: form.support_email || null,
        }),
      });
      clearCurrencyCache();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleLocale = (code: string) => {
    if (code === form.default_locale) return; // can't remove the default locale
    setForm(prev => ({
      ...prev,
      supported_locales: prev.supported_locales.includes(code)
        ? prev.supported_locales.filter(l => l !== code)
        : [...prev.supported_locales, code],
    }));
  };

  const setField = <K extends keyof PlatformConfig>(key: K, value: PlatformConfig[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  if (loading) return <p className="text-sm text-muted-foreground py-12 text-center">Loading...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Platform Settings</h1>
        <p className="text-sm text-muted-foreground">Global configuration for the marketplace</p>
      </div>

      {/* Platform Info */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Platform Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Platform Name</Label>
              <Input
                className="h-8 text-sm"
                value={form.platform_name}
                onChange={e => setField('platform_name', e.target.value)}
                placeholder="Multi Stores"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Support Email</Label>
              <Input
                className="h-8 text-sm"
                type="email"
                value={form.support_email || ''}
                onChange={e => setField('support_email', e.target.value)}
                placeholder="support@platform.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commission */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Commission Rate</CardTitle>
            <Badge variant="secondary" className="text-[10px]">Applied to all transactions</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <SearchableSelect
                value={form.commission_type}
                onChange={v => setField('commission_type', v)}
                placeholder="Select type..."
                options={[
                  { value: 'percentage', label: 'Percentage', description: 'Take % from each transaction' },
                  { value: 'fixed', label: 'Fixed Amount', description: 'Take fixed amount per transaction' },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Value</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  className="h-8 text-sm pr-8"
                  value={form.commission_value}
                  onChange={e => setField('commission_value', parseFloat(e.target.value) || 0)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {form.commission_type === 'percentage' ? '%' : form.default_currency}
                </span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Platform takes {form.commission_value}{form.commission_type === 'percentage' ? '%' : form.default_currency} from each order. The cost is deducted from Provider's or Creator's share based on who created the promotion.
          </p>
        </CardContent>
      </Card>

      {/* Currency & Locale */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Currency & Language</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Default Currency</Label>
              <SearchableSelect
                value={form.default_currency}
                onChange={v => setField('default_currency', v)}
                placeholder="Select currency..."
                searchPlaceholder="Search currencies..."
                options={CURRENCIES}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Default Language</Label>
              <SearchableSelect
                value={form.default_locale}
                onChange={v => {
                  // When changing default locale, make sure it's in supported list
                  setForm(prev => ({
                    ...prev,
                    default_locale: v,
                    supported_locales: prev.supported_locales.includes(v)
                      ? prev.supported_locales
                      : [...prev.supported_locales, v],
                  }));
                }}
                placeholder="Select language..."
                options={LOCALES}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Supported Languages (Creator stores)</Label>
            <div className="flex flex-wrap gap-2">
              {LOCALES.map(locale => {
                const isEnabled = form.supported_locales.includes(locale.value);
                const isDefault = form.default_locale === locale.value;
                return (
                  <button
                    key={locale.value}
                    type="button"
                    onClick={() => toggleLocale(locale.value)}
                    className={`px-3 py-1.5 rounded-md border text-xs font-medium transition ${
                      isEnabled
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    {locale.label}
                    {isDefault && <span className="ml-1.5 opacity-60 text-[10px]">default</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Creators can only activate languages enabled here.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Order Limits */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Order Limits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-w-xs">
            <Label className="text-xs">Minimum Order Amount ({form.default_currency})</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                className="h-8 text-sm pr-10"
                placeholder="No minimum"
                value={form.min_order_amount ?? ''}
                onChange={e => setField('min_order_amount', e.target.value ? parseFloat(e.target.value) : null)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {form.default_currency}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">Leave blank to allow any amount.</p>
          </div>
        </CardContent>
      </Card>

      {/* Registration Approvals */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Registration Approvals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            When enabled, new registrations require manual admin approval before the account is activated.
          </p>
          <Separator />
          <label className="flex items-center justify-between py-1 cursor-pointer group">
            <div>
              <p className="text-sm font-medium">Provider Approval Required</p>
              <p className="text-[11px] text-muted-foreground">New Providers must be verified by admin before adding products</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.require_provider_approval}
              onClick={() => setField('require_provider_approval', !form.require_provider_approval)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                form.require_provider_approval ? 'bg-zinc-900' : 'bg-zinc-200'
              }`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                form.require_provider_approval ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </label>
          <Separator />
          <label className="flex items-center justify-between py-1 cursor-pointer group">
            <div>
              <p className="text-sm font-medium">Creator Approval Required</p>
              <p className="text-[11px] text-muted-foreground">New Creators must be verified by admin before opening their store</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.require_creator_approval}
              onClick={() => setField('require_creator_approval', !form.require_creator_approval)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                form.require_creator_approval ? 'bg-zinc-900' : 'bg-zinc-200'
              }`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                form.require_creator_approval ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </label>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 justify-end">
        {saved && <span className="text-xs text-emerald-600 font-medium">Settings saved successfully!</span>}
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
