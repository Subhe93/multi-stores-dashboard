'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Change-password card shared by the creator and provider settings pages.
 * PUT /auth/change-password is role-agnostic (JWT only); the API revokes
 * every token issued before the change and returns a fresh pair.
 */
export function ChangePasswordCard() {
  const t = useTranslations('creator');
  const { token, replaceTokens } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (!newPassword || !currentPassword) {
      setPasswordMsg({ type: 'error', text: t('settings.passwordFillAll') });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: t('settings.passwordMismatch') });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: t('settings.passwordTooShort') });
      return;
    }
    if (!token) return;

    setPasswordSaving(true);
    try {
      // PUT is the API's verb (POST answered 404).
      const res = await api<{ access_token?: string; refresh_token?: string }>('/auth/change-password', {
        method: 'PUT',
        token,
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      // The refresh token comes back in the httpOnly cookie.
      if (res?.access_token) {
        replaceTokens({ access_token: res.access_token, refresh_token: res.refresh_token });
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg({ type: 'success', text: t('settings.passwordChanged') });
    } catch (err) {
      setPasswordMsg({ type: 'error', text: (err instanceof Error && err.message) || t('settings.passwordChangeFailed') });
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{t('settings.changePassword')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('settings.currentPassword')}</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t('settings.currentPasswordPlaceholder')}
              className="h-8"
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('settings.newPassword')}</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('settings.newPasswordPlaceholder')}
              className="h-8"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('settings.confirmNewPassword')}</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('settings.confirmPasswordPlaceholder')}
              className="h-8"
              autoComplete="new-password"
            />
          </div>

          {/* Feedback */}
          {passwordMsg && (
            <div
              className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
                passwordMsg.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-destructive/30 bg-destructive/5 text-destructive'
              }`}
            >
              {passwordMsg.type === 'success' ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              )}
              {passwordMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={passwordSaving}>
              {passwordSaving ? t('settings.changing') : t('settings.changePassword')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
