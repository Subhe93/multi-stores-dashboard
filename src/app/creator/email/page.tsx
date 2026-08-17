'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronRight, Loader2, Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface StoreMailSettings {
  host: string | null;
  port: number | null;
  secure: boolean;
  user: string | null;
  from: string | null;
  enabled: boolean;
  passwordSet: boolean;
  verifiedAt: string | null;
}

interface TemplateRow {
  event: string;
  overridden: boolean;
  enabled: boolean;
  updated_at: string | null;
  platformAvailable: boolean;
}

export default function CreatorEmailPage() {
  const t = useTranslations('creator.email');
  const tc = useTranslations('common');
  const { token } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<string | null>(null);

  // Sender
  const [settings, setSettings] = useState<StoreMailSettings | null>(null);
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [from, setFrom] = useState('');
  const [secure, setSecure] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Test
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Templates
  const [templates, setTemplates] = useState<TemplateRow[]>([]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api<StoreMailSettings>('/mail/store/settings', { token }),
      api<TemplateRow[]>('/notification-templates/store', { token }),
    ])
      .then(([s, tpl]) => {
        if (cancelled) return;
        setSettings(s);
        setHost(s.host || '');
        setPort(s.port ? String(s.port) : '');
        setUser(s.user || '');
        setFrom(s.from || '');
        setSecure(s.secure);
        setEnabled(s.enabled);
        setTemplates(Array.isArray(tpl) ? tpl : []);
      })
      .catch((err: any) => {
        // The API refuses marketplace stores outright — show why rather than
        // an empty form the creator could fill in for nothing.
        if (!cancelled) setBlocked(err?.message || t('loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const handleSave = async () => {
    if (!token || saving) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const updated = await api<StoreMailSettings>('/mail/store/settings', {
        method: 'PUT',
        token,
        body: JSON.stringify({
          host,
          port: port ? Number(port) : null,
          user,
          // Blank means "keep the stored password" — the secret never round-trips.
          ...(password ? { password } : {}),
          from,
          secure,
          enabled,
        }),
      });
      setSettings(updated);
      setPassword('');
      setSaveMsg({ type: 'success', text: t('saved') });
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err?.message || t('saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!token || testing) return;
    setTesting(true);
    setTestMsg(null);
    try {
      await api('/mail/store/test', {
        method: 'POST',
        token,
        body: JSON.stringify(testEmail ? { to: testEmail } : {}),
      });
      setTestMsg({ type: 'success', text: t('testSent') });
      const s = await api<StoreMailSettings>('/mail/store/settings', { token });
      setSettings(s);
    } catch (err: any) {
      setTestMsg({ type: 'error', text: err?.message || t('testFailed') });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (blocked) {
    return (
      <Card className="shadow-none max-w-2xl">
        <CardContent className="py-8 text-center space-y-2">
          <Mail className="size-6 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{blocked}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{t('subtitle')}</p>
      </div>

      {/* Sender */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">{t('sender')}</CardTitle>
            <Badge
              variant={settings?.verifiedAt ? 'default' : 'secondary'}
              className="text-[10px]"
            >
              {settings?.verifiedAt ? t('verified') : t('notVerified')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">{t('senderHint')}</p>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">{t('host')}</Label>
              <Input
                className="h-8 text-sm font-mono"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="smtp.example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('port')}</Label>
              <Input
                className="h-8 text-sm"
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="587"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('user')}</Label>
              <Input
                className="h-8 text-sm font-mono"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('password')}</Label>
              <Input
                className="h-8 text-sm font-mono"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={settings?.passwordSet ? '••••••••' : ''}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 items-end">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">{t('from')}</Label>
              <Input
                className="h-8 text-sm"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="My Store <orders@mystore.com>"
              />
            </div>
            <label className="flex items-center gap-2 h-8 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={secure}
                onChange={(e) => setSecure(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300"
              />
              <span className="text-xs">{t('secure')}</span>
            </label>
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{t('useOwnSender')}</p>
              <p className="text-[11px] text-muted-foreground">
                {enabled ? t('useOwnSenderOn') : t('useOwnSenderOff')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled((v) => !v)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                enabled ? 'bg-emerald-500' : 'bg-zinc-300'
              }`}
            >
              <span
                className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0.5 rtl:-translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center gap-3 justify-end">
            {saveMsg && (
              <span
                className={`text-xs ${
                  saveMsg.type === 'success' ? 'text-emerald-600' : 'text-destructive'
                }`}
              >
                {saveMsg.text}
              </span>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? tc('saving') : tc('save')}
            </Button>
          </div>

          {/* Test — the only place a broken sender surfaces its real error,
              since order mail quietly falls back to the platform sender. */}
          <div className="border-t pt-3 space-y-2">
            <Label className="text-xs">{t('test')}</Label>
            <p className="text-[11px] text-muted-foreground">{t('testHint')}</p>
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm flex-1"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder={t('testPlaceholder')}
              />
              <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? '…' : t('sendTest')}
              </Button>
            </div>
            {testMsg && (
              <p
                className={`text-[11px] ${
                  testMsg.type === 'success' ? 'text-emerald-600' : 'text-destructive'
                }`}
              >
                {testMsg.text}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Templates */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t('templates')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <p className="text-xs text-muted-foreground px-6 pb-3">{t('templatesHint')}</p>
          <div className="divide-y border-t">
            {templates.map((row) => (
              <button
                key={row.event}
                type="button"
                onClick={() => router.push(`/creator/email/${row.event}`)}
                className="w-full flex items-center justify-between px-6 py-3 hover:bg-zinc-50 transition text-start"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t(`events.${row.event}` as never)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.overridden
                      ? row.enabled
                        ? t('customised')
                        : t('customisedDisabled')
                      : t('usingPlatform')}
                  </p>
                </div>
                <ChevronRight className="size-4 text-zinc-300 rtl:rotate-180 shrink-0" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
