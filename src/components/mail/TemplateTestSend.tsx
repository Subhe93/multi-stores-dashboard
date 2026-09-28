'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface TemplateTestSendProps {
  // '/mail/store/templates' (creator) or '/mail/admin/templates' (admin).
  basePath: string;
  event: string;
  locale: string;
  subject: string;
  html: string;
  text: string;
  // Admin may pick the recipient; a creator's test always goes to their own
  // login email (enforced by the API).
  allowRecipient?: boolean;
}

// Sends the template as it is in the editor right now (saved or not), filled
// with sample data, so it can be checked in a real inbox.
export function TemplateTestSend({
  basePath,
  event,
  locale,
  subject,
  html,
  text,
  allowRecipient = false,
}: TemplateTestSendProps) {
  const t = useTranslations('templateEditor');
  const { token, user } = useAuth();

  const [to, setTo] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSend = async () => {
    if (!token || sending) return;
    setSending(true);
    setMsg(null);
    try {
      const res = await api<{ sent: true; to: string }>(`${basePath}/${event}/test`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          locale,
          subject,
          body_html: html,
          body_text: text,
          ...(allowRecipient && to.trim() ? { to: to.trim() } : {}),
        }),
      });
      setMsg({ type: 'success', text: t('testSent', { email: res.to }) });
    } catch (err) {
      setMsg({ type: 'error', text: (err instanceof Error && err.message) || t('testFailed') });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-md border border-zinc-200 px-3 py-3 space-y-2">
      <div>
        <p className="text-xs font-medium">{t('testTitle')}</p>
        <p className="text-[11px] text-muted-foreground">
          {allowRecipient ? t('testHintAdmin') : t('testHint', { email: user?.email || '' })}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {allowRecipient && (
          <Input
            className="h-8 text-sm flex-1 min-w-48"
            type="email"
            dir="ltr"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={user?.email || ''}
          />
        )}
        <Button size="sm" variant="outline" onClick={handleSend} disabled={sending || !html.trim()}>
          {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          <span className="ms-1.5">{sending ? t('sending') : t('sendTest')}</span>
        </Button>
      </div>
      {msg && (
        <p className={`text-[11px] ${msg.type === 'success' ? 'text-emerald-600' : 'text-destructive'}`}>{msg.text}</p>
      )}
    </div>
  );
}
