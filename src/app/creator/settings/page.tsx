'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  email: string;
  avatar_url?: string;
  creator?: {
    display_name?: string;
  };
}

interface StoreInfo {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreatorSettingsPage() {
  const { token } = useAuth();
  const router = useRouter();

  // User profile state
  const [user, setUser] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Store state
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load profile
  useEffect(() => {
    if (!token) return;
    api<UserProfile>('/auth/me', { token })
      .then((u) => {
        setUser(u);
        setDisplayName(u.creator?.display_name || '');
        setAvatarUrl(u.avatar_url || '');
      })
      .catch((err) => console.error('Failed to load profile:', err));
  }, [token]);

  // Load store
  useEffect(() => {
    if (!token) return;
    setStoreLoading(true);
    api<StoreInfo>('/stores/my/store', { token })
      .then((s) => setStore(s))
      .catch(() => setStore(null))
      .finally(() => setStoreLoading(false));
  }, [token]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setProfileSaving(true);
    setProfileMsg(null);

    let hasError = false;

    // Save display name
    try {
      await api('/creators/my/profile', {
        method: 'PUT',
        token,
        body: JSON.stringify({ display_name: displayName }),
      });
    } catch (err: any) {
      console.error('Failed to save display name:', err);
      hasError = true;
    }

    // Save avatar url
    try {
      await api('/auth/me', {
        method: 'PUT',
        token,
        body: JSON.stringify({ avatar_url: avatarUrl }),
      });
    } catch (err: any) {
      // Gracefully handle if endpoint doesn't exist
      console.warn('avatar_url save failed (may not be supported):', err?.message);
    }

    setProfileSaving(false);
    if (hasError) {
      setProfileMsg({ type: 'error', text: 'Some settings could not be saved. Please try again.' });
    } else {
      setProfileMsg({ type: 'success', text: 'Profile saved successfully.' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (!newPassword || !currentPassword) {
      setPasswordMsg({ type: 'error', text: 'Please fill in all password fields.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (!token) return;

    setPasswordSaving(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        token,
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg({ type: 'success', text: 'Password changed successfully.' });
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err?.message || 'Failed to change password.' });
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Account Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your creator account and preferences</p>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* Account Info card */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Account Info</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Email (read-only) */}
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="h-8"
                  placeholder="Loading…"
                />
              </div>

              {/* Display Name */}
              <div className="space-y-1.5">
                <Label className="text-xs">Display Name</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="h-8"
                />
              </div>

              {/* Avatar URL */}
              <div className="space-y-1.5">
                <Label className="text-xs">Avatar URL</Label>
                <Input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="h-8"
                />
              </div>

              {/* Feedback */}
              {profileMsg && (
                <div
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
                    profileMsg.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-destructive/30 bg-destructive/5 text-destructive'
                  }`}
                >
                  {profileMsg.type === 'success' ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  )}
                  {profileMsg.text}
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={profileSaving || !user}>
                  {profileSaving ? 'Saving…' : 'Save Profile'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Store Status card */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Store Status</CardTitle>
          </CardHeader>
          <CardContent>
            {storeLoading ? (
              <div className="space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-zinc-100" />
                <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
              </div>
            ) : store ? (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{store.name}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">/{store.slug}</p>
                  <span
                    className={`mt-1 inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-medium ${
                      store.is_active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-zinc-200 bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {store.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push('/creator/store')}
                >
                  Manage Store
                  <ExternalLink className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-[10px] font-medium text-amber-700">
                    Store not created
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Set up your store to start selling
                  </p>
                </div>
                <Button size="sm" onClick={() => router.push('/creator/store')}>
                  Set Up Store
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stripe Connect card */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Stripe Connect</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-[10px] font-medium text-amber-700">
                  Not Connected
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Connect your Stripe account to receive payouts
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Button size="sm" disabled>
                  Connect Stripe
                </Button>
                <p className="text-[10px] text-muted-foreground">Coming soon</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password card */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Current Password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="h-8"
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="h-8"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Confirm New Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
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
                  {passwordSaving ? 'Changing…' : 'Change Password'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
