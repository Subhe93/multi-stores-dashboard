'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface StoreNotifications {
  notification_email: string | null;
  login_email: string;
  effective_email: string;
}

// Where new-order notifications go: the store's own address, or the creator's
// login email when none is set. Available to every store type.
export function OrderNotificationsCard() {
  const t = useTranslations('emailLog');
  const tc = useTranslations('common');
  const { token } = useAuth();

  const [settings, setSettings] = useState<StoreNotifications | null>(null);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<StoreNotifications>('/mail/store/notifications', { token })
      .then((s) => {
        if (cancelled) return;
        setSettings(s);
        setEmail(s.notification_email || '');
      })
      .catch((err: unknown) => {
        if (!cancelled) setMsg({ type: 'error', text: (err instanceof Error && err.message) || t('loadFailed') });
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const handleSave = async () => {
    if (!token || saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const updated = await api<StoreNotifications>('/mail/store/notifications', {
        method: 'PUT',
        token,
        body: JSON.stringify({ notification_email: email.trim() }),
      });
      setSettings(updated);
      setEmail(updated.notification_email || '');
      setMsg({ type: 'success', text: t('notificationSaved') });
    } catch (err) {
      setMsg({ type: 'error', text: (err instanceof Error && err.message) || t('notificationSaveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const dirty = !!settings && email.trim() !== (settings.notification_email || '');

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{t('notificationTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('notificationHint')}</p>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('notificationEmail')}</Label>
          <Input
            className="h-8 text-sm"
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={settings?.login_email || ''}
          />
          {settings && (
            <p className="text-[11px] text-muted-foreground">
              {t('notificationCurrent')}{' '}
              <span className="font-mono" dir="ltr">
                {settings.effective_email}
              </span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 justify-end">
          {msg && (
            <span className={`text-xs ${msg.type === 'success' ? 'text-emerald-600' : 'text-destructive'}`}>
              {msg.text}
            </span>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? tc('saving') : tc('save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
