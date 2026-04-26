'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { Upload, ImageIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useImageUpload } from '@/lib/useImageUpload';

const countries = [
  { value: 'DE', label: 'Germany', description: 'Deutschland' },
  { value: 'AT', label: 'Austria', description: 'Österreich' },
  { value: 'CH', label: 'Switzerland', description: 'Schweiz' },
  { value: 'FR', label: 'France' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'TR', label: 'Turkey', description: 'Türkiye' },
  { value: 'SA', label: 'Saudi Arabia' },
  { value: 'AE', label: 'UAE' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
];

export default function ProviderSettings() {
  const { token } = useAuth();
  const { pickAndUpload, uploading } = useImageUpload(token);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    if (!token) return;
    api<any>('/providers/me', { token })
      .then((p) => {
        setProfile(p);
        setCompanyName(p.company_name || '');
        setDescription(p.description || '');
        setPhone(p.phone || '');
        setCountry(p.country || '');
        setLogoUrl(p.logo_url || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await api('/providers/me', {
        method: 'PUT', token,
        body: JSON.stringify({ company_name: companyName, description, phone, country, logo_url: logoUrl || undefined }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Company Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo */}
          <div className="space-y-1.5">
            <Label className="text-xs">Company Logo</Label>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-lg border bg-zinc-50 overflow-hidden flex items-center justify-center shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-zinc-300" />
                )}
              </div>
              <div>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={uploading}
                  onClick={async () => {
                    const imgs = await pickAndUpload('logos', false);
                    if (imgs.length) setLogoUrl(imgs[0]!.url);
                  }}>
                  {uploading ? 'Uploading...' : <><Upload className="w-3 h-3 mr-1" /> Upload Logo</>}
                </Button>
                {logoUrl && (
                  <button onClick={() => setLogoUrl('')} className="block text-[10px] text-red-500 mt-1 hover:underline">Remove logo</button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Company Name</Label>
            <Input className="h-9 text-sm" value={companyName} onChange={e => setCompanyName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <textarea rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input className="h-9 text-sm" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Country</Label>
              <SearchableSelect
                value={country}
                onChange={setCountry}
                placeholder="Select country..."
                searchPlaceholder="Search countries..."
                options={countries}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Stripe Connect</CardTitle>
            <Badge variant="outline" className={`text-[10px] ${profile?.stripe_account_id ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              {profile?.stripe_account_id ? 'Connected' : 'Not Connected'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Connect your Stripe account to receive payouts for your orders.</p>
          <Button size="sm" variant={profile?.stripe_account_id ? 'outline' : 'default'}>
            {profile?.stripe_account_id ? 'Manage Stripe Account' : 'Connect Stripe Account'}
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 justify-end">
        {saved && <span className="text-xs text-emerald-600 font-medium">Settings saved!</span>}
        <Button size="sm" onClick={handleSave} disabled={saving || loading}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
