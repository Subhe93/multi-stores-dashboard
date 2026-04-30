'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { ArrowLeft, Pencil, Key, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, user: currentUser } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Edit dialogs
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');

  // Profile form
  const [editEmail, setEditEmail] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editVerified, setEditVerified] = useState(false);

  // Password form
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fetchUser = () => {
    if (!token || !id) return;
    setLoading(true);
    api<any>(`/admin/users/${id}`, { token })
      .then(setUser)
      .catch((e) => setError(e?.message || 'Failed to load user'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUser(); }, [token, id]);

  const flash = (msg: string) => {
    setSaved(msg);
    setTimeout(() => setSaved(''), 3000);
  };

  const openEditProfile = () => {
    if (!user) return;
    setError('');
    setEditEmail(user.email || '');
    if (user.provider) {
      setEditCompany(user.provider.company_name || '');
      setEditDescription(user.provider.description || '');
      setEditPhone(user.provider.phone || '');
      setEditCountry(user.provider.country || '');
      setEditVerified(!!user.provider.verified);
    }
    if (user.creator) {
      setEditDisplayName(user.creator.display_name || '');
      setEditPhone(user.creator.phone || '');
      setEditBio(user.creator.bio || '');
      setEditVerified(!!user.creator.verified);
    }
    if (user.customer) {
      setEditFirstName(user.customer.first_name || '');
      setEditLastName(user.customer.last_name || '');
      setEditPhone(user.customer.phone || '');
    }
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!token || !user) return;
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, any> = { email: editEmail };
      if (user.role === 'PROVIDER') {
        payload.company_name = editCompany;
        payload.description = editDescription || null;
        payload.country = editCountry;
        payload.phone = editPhone || null;
        payload.verified = editVerified;
      } else if (user.role === 'CREATOR') {
        payload.display_name = editDisplayName;
        payload.bio = editBio || null;
        payload.phone = editPhone || null;
        payload.verified = editVerified;
      } else if (user.role === 'CUSTOMER') {
        payload.first_name = editFirstName;
        payload.last_name = editLastName;
        payload.phone = editPhone || null;
      }
      await api(`/admin/users/${id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify(payload),
      });
      setShowEditProfile(false);
      flash('Profile updated');
      fetchUser();
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!token) return;
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await api(`/admin/users/${id}/password`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ password: newPassword }),
      });
      setShowResetPassword(false);
      setNewPassword('');
      setConfirmPassword('');
      flash('Password reset. Active sessions invalidated.');
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!token) return;
    try {
      await api(`/admin/users/${id}/status`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ status }),
      });
      flash(`Status changed to ${status}`);
      fetchUser();
    } catch (err: any) {
      setError(err?.message || 'Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await api(`/admin/users/${id}`, { method: 'DELETE', token });
      router.push('/admin/users');
    } catch (err: any) {
      setError(err?.message || 'Failed to delete user');
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!user) return <p className="text-center py-12 text-muted-foreground">User not found</p>;

  const statusColors: Record<string, string> = { ACTIVE: 'bg-emerald-50 text-emerald-700', PENDING: 'bg-amber-50 text-amber-700', SUSPENDED: 'bg-red-50 text-red-700', BANNED: 'bg-red-100 text-red-800' };
  const roleColors: Record<string, string> = { ADMIN: 'bg-zinc-100 text-zinc-700', PROVIDER: 'bg-blue-50 text-blue-700', CREATOR: 'bg-purple-50 text-purple-700', CUSTOMER: 'bg-emerald-50 text-emerald-700' };

  const isSelf = currentUser?.id === user.id;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">User Details</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Badge variant="outline" className={`text-[10px] font-semibold ${roleColors[user.role] || ''}`}>{user.role}</Badge>
        <Badge variant="outline" className={`text-[10px] font-semibold ${statusColors[user.status] || ''}`}>{user.status}</Badge>
      </div>

      {saved && <div className="bg-emerald-50 text-emerald-700 text-xs p-3 rounded-lg border border-emerald-200">{saved}</div>}
      {error && !showEditProfile && !showResetPassword && !showDelete && (
        <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200">{error}</div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card className="shadow-none col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Account Information</CardTitle>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={openEditProfile}>
                  <Pencil className="w-3 h-3 mr-1" /> Edit Profile
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => { setError(''); setShowResetPassword(true); }}>
                  <Key className="w-3 h-3 mr-1" /> Reset Password
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Email</p>
                  <p className="text-sm">{user.email}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Role</p>
                  <p className="text-sm">{user.role}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Joined</p>
                  <p className="text-sm">{new Date(user.created_at).toLocaleDateString()} ({new Date(user.created_at).toLocaleTimeString()})</p>
                </div>
              </div>
              <div className="space-y-3">
                {user.provider && (
                  <>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Company Name</p>
                      <p className="text-sm">{user.provider.company_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Country</p>
                      <p className="text-sm">{user.provider.country}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Phone</p>
                      <p className="text-sm">{user.provider.phone || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Verified</p>
                      <p className="text-sm">{user.provider.verified ? 'Yes' : 'No'}</p>
                    </div>
                    {user.provider.description && (
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Description</p>
                        <p className="text-sm">{user.provider.description}</p>
                      </div>
                    )}
                  </>
                )}
                {user.creator && (
                  <>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Display Name</p>
                      <p className="text-sm">{user.creator.display_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Phone</p>
                      <p className="text-sm">{user.creator.phone || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Verified</p>
                      <p className="text-sm">{user.creator.verified ? 'Yes' : 'No'}</p>
                    </div>
                    {user.creator.bio && (
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Bio</p>
                        <p className="text-sm">{user.creator.bio}</p>
                      </div>
                    )}
                  </>
                )}
                {user.customer && (
                  <>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Full Name</p>
                      <p className="text-sm">{user.customer.first_name} {user.customer.last_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Phone</p>
                      <p className="text-sm">{user.customer.phone || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Addresses</p>
                      <p className="text-sm">{user.customer.addresses?.length || 0} saved</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Status</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Badge variant="outline" className={`text-xs font-semibold w-full justify-center py-1.5 ${statusColors[user.status] || ''}`}>
                {user.status}
              </Badge>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {user.status === 'PENDING' && (
                <Button size="sm" className="w-full text-xs" onClick={() => handleStatusChange('ACTIVE')}>Activate Account</Button>
              )}
              {user.status === 'ACTIVE' && user.role !== 'ADMIN' && (
                <Button variant="outline" size="sm" className="w-full text-xs text-amber-600" onClick={() => handleStatusChange('SUSPENDED')}>Suspend Account</Button>
              )}
              {user.status === 'SUSPENDED' && (
                <Button variant="outline" size="sm" className="w-full text-xs text-emerald-600" onClick={() => handleStatusChange('ACTIVE')}>Reactivate Account</Button>
              )}
              {user.status === 'BANNED' && (
                <Button variant="outline" size="sm" className="w-full text-xs text-emerald-600" onClick={() => handleStatusChange('ACTIVE')}>Unban Account</Button>
              )}
              {user.status !== 'BANNED' && user.role !== 'ADMIN' && (
                <>
                  <Separator />
                  <Button variant="outline" size="sm" className="w-full text-xs text-red-600" onClick={() => handleStatusChange('BANNED')}>Ban Account</Button>
                </>
              )}
              {!isSelf && (
                <>
                  <Separator />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => { setError(''); setShowDelete(true); }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Delete User
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {user.customer?.addresses?.length > 0 && (
            <Card className="shadow-none">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Addresses</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {user.customer.addresses.map((addr: any) => (
                  <div key={addr.id} className="text-xs p-2 bg-zinc-50 rounded border space-y-0.5">
                    {addr.label && <Badge variant="secondary" className="text-[9px] mb-1">{addr.label}</Badge>}
                    <p className="font-medium">{addr.full_name}</p>
                    <p>{addr.line1}</p>
                    {addr.line2 && <p>{addr.line2}</p>}
                    <p>{addr.city}, {addr.postal_code} {addr.country_code}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit User Profile</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {error && (
              <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200">{error}</div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input className="h-9 text-sm" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
            </div>

            {user.provider && (
              <>
                <Separator />
                <p className="text-xs font-semibold text-muted-foreground">Provider Info</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Company Name</Label>
                    <Input className="h-9 text-sm" value={editCompany} onChange={e => setEditCompany(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Country</Label>
                    <Input className="h-9 text-sm" value={editCountry} onChange={e => setEditCountry(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Phone</Label>
                    <Input className="h-9 text-sm" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                  </div>
                  <label className="flex items-center gap-2 mt-6 text-xs">
                    <input
                      type="checkbox"
                      checked={editVerified}
                      onChange={(e) => setEditVerified(e.target.checked)}
                    />
                    Verified
                  </label>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <textarea rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editDescription} onChange={e => setEditDescription(e.target.value)} />
                </div>
              </>
            )}

            {user.creator && (
              <>
                <Separator />
                <p className="text-xs font-semibold text-muted-foreground">Creator Info</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Display Name</Label>
                    <Input className="h-9 text-sm" value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Phone</Label>
                    <Input className="h-9 text-sm" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={editVerified}
                    onChange={(e) => setEditVerified(e.target.checked)}
                  />
                  Verified
                </label>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bio</Label>
                  <textarea rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editBio} onChange={e => setEditBio(e.target.value)} />
                </div>
              </>
            )}

            {user.customer && (
              <>
                <Separator />
                <p className="text-xs font-semibold text-muted-foreground">Customer Info</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">First Name</Label>
                    <Input className="h-9 text-sm" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Last Name</Label>
                    <Input className="h-9 text-sm" value={editLastName} onChange={e => setEditLastName(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone</Label>
                  <Input className="h-9 text-sm" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowEditProfile(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetPassword} onOpenChange={(o) => { setShowResetPassword(o); if (!o) { setNewPassword(''); setConfirmPassword(''); setError(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{user.email}</strong>. Active sessions will be revoked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error && (
              <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200">{error}</div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">New Password</Label>
              <Input type="password" className="h-9 text-sm" placeholder="Minimum 8 characters"
                value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Confirm Password</Label>
              <Input type="password" className="h-9 text-sm" placeholder="Re-enter password"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setShowResetPassword(false); setNewPassword(''); setConfirmPassword(''); }}>Cancel</Button>
            <Button size="sm" onClick={handleResetPassword} disabled={saving || newPassword.length < 8}>
              {saving ? 'Resetting...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" /> Delete User
            </DialogTitle>
            <DialogDescription>
              This permanently removes <strong>{user.email}</strong> and all related data
              (profile, addresses, sessions). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200">{error}</div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
              disabled={saving}
            >
              {saving ? 'Deleting...' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
