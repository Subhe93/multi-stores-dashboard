'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/common/DataTable';
import { SearchableSelect } from '@/components/common/SearchableSelect';
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
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  provider?: { company_name: string; verified: boolean };
  creator?: { display_name: string; verified: boolean };
  customer?: { first_name: string; last_name: string };
}

const roleColors: Record<string, string> = {
  PROVIDER: 'bg-blue-50 text-blue-700 border-blue-200',
  CREATOR: 'bg-purple-50 text-purple-700 border-purple-200',
  CUSTOMER: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ADMIN: 'bg-zinc-100 text-zinc-700 border-zinc-200',
};

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  SUSPENDED: 'bg-red-50 text-red-700 border-red-200',
  BANNED: 'bg-red-100 text-red-800 border-red-300',
};

const ROLE_OPTIONS = [
  { value: 'CUSTOMER', label: 'Customer', description: 'Buyer / shopper account' },
  { value: 'PROVIDER', label: 'Provider', description: 'Supplier / vendor account' },
  { value: 'CREATOR', label: 'Creator', description: 'Storefront / content creator' },
  { value: 'ADMIN', label: 'Admin', description: 'Full platform access' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'BANNED', label: 'Banned' },
];

export default function AdminUsers() {
  const { token } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    first_name: '',
    last_name: '',
    company_name: '',
    country: 'US',
    display_name: '',
    phone: '',
    verified: false,
  });

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = async (p = 1, role?: string, status?: string, search?: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (role) params.set('role', role);
      if (status) params.set('status', status);
      if (search) params.set('search', search);

      const res = await api<any>(`/admin/users?${params}`, { token });
      setUsers(res?.data || []);
      setMeta(res?.meta || null);
      setPage(p);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, [token]);

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleFilter = (filter: string) => {
    setActiveFilter(filter);
    const map: Record<string, { role?: string; status?: string }> = {
      All: {}, Providers: { role: 'PROVIDER' }, Creators: { role: 'CREATOR' },
      Customers: { role: 'CUSTOMER' }, Admins: { role: 'ADMIN' }, Pending: { status: 'PENDING' },
    };
    const f = map[filter] || {};
    fetchUsers(1, f.role, f.status);
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    if (!token) return;
    try {
      await api(`/admin/users/${userId}/status`, { method: 'PUT', token, body: JSON.stringify({ status: newStatus }) });
      flashSuccess('Status updated');
      fetchUsers(page);
    } catch (err: any) {
      setError(err?.message || 'Failed to update status');
    }
  };

  const resetForm = () => {
    setForm({
      email: '',
      password: '',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      first_name: '',
      last_name: '',
      company_name: '',
      country: 'US',
      display_name: '',
      phone: '',
      verified: false,
    });
    setError('');
  };

  const handleCreate = async () => {
    if (!token) return;
    setError('');
    if (!form.email.trim() || !form.password) {
      setError('Email and password are required');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setCreating(true);
    try {
      const payload: Record<string, any> = {
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        status: form.status,
        phone: form.phone || undefined,
      };
      if (form.role === 'CUSTOMER') {
        payload.first_name = form.first_name;
        payload.last_name = form.last_name;
      } else if (form.role === 'PROVIDER') {
        payload.company_name = form.company_name || 'New Company';
        payload.country = form.country || 'US';
        payload.verified = form.verified;
      } else if (form.role === 'CREATOR') {
        payload.display_name = form.display_name || 'New Creator';
        payload.verified = form.verified;
      }
      await api('/admin/users', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      });
      setShowCreate(false);
      resetForm();
      flashSuccess('User created');
      fetchUsers(1);
    } catch (err: any) {
      setError(err?.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/admin/users/${deleteTarget.id}`, { method: 'DELETE', token });
      flashSuccess('User deleted');
      setDeleteTarget(null);
      fetchUsers(page);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const getName = (u: User) => {
    if (u.provider) return u.provider.company_name;
    if (u.creator) return u.creator.display_name;
    if (u.customer) return `${u.customer.first_name} ${u.customer.last_name}`;
    return u.email;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">Manage platform users</p>
        </div>
        <Button size="sm" className="h-8 text-xs" onClick={() => { resetForm(); setShowCreate(true); }}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> New User
        </Button>
      </div>

      {success && <div className="bg-emerald-50 text-emerald-700 text-xs p-3 rounded-lg border border-emerald-200">{success}</div>}
      {error && !showCreate && !deleteTarget && (
        <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200">{error}</div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {['All', 'Providers', 'Creators', 'Customers', 'Admins', 'Pending'].map((tab) => (
          <Button key={tab} variant={activeFilter === tab ? 'default' : 'ghost'} size="sm" className="h-8 text-xs"
            onClick={() => handleFilter(tab)}>{tab}</Button>
        ))}
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'Name', sortable: true, render: (item: User) => (
            <button onClick={() => router.push(`/admin/users/${item.id}`)} className="text-left hover:underline">
              <p className="text-sm font-medium">{getName(item)}</p>
              <p className="text-[10px] text-muted-foreground">{item.email}</p>
            </button>
          )},
          { key: 'role', label: 'Role', sortable: true, render: (item: User) => (
            <Badge variant="outline" className={`text-[10px] font-semibold ${roleColors[item.role] || ''}`}>{item.role}</Badge>
          )},
          { key: 'status', label: 'Status', sortable: true, render: (item: User) => (
            <Badge variant="outline" className={`text-[10px] font-semibold ${statusColors[item.status] || ''}`}>{item.status}</Badge>
          )},
          { key: 'created_at', label: 'Joined', sortable: true, render: (item: User) => (
            <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
          )},
          { key: 'actions', label: '', render: (item: User) => (
            <div className="flex gap-1 justify-end">
              {item.status === 'ACTIVE' && item.role !== 'ADMIN' && (
                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => handleStatusChange(item.id, 'SUSPENDED')}>Suspend</Button>
              )}
              {item.status === 'SUSPENDED' && (
                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => handleStatusChange(item.id, 'ACTIVE')}>Reactivate</Button>
              )}
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => router.push(`/admin/users/${item.id}`)}>Edit</Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setDeleteTarget(item)}
                title="Delete user"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )},
        ]}
        data={users}
        pagination={meta}
        onPageChange={(p) => fetchUsers(p)}
        searchPlaceholder="Search by email..."
        onSearch={(q) => fetchUsers(1, undefined, undefined, q)}
        emptyMessage={loading ? 'Loading...' : 'No users found'}
      />

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Create any type of account. The new user can sign in immediately if status is <strong>Active</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {error && (
              <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200">{error}</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Email *</Label>
                <Input
                  type="email"
                  className="h-9 text-sm"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Password * (min 8)</Label>
                <Input
                  type="password"
                  className="h-9 text-sm"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Strong password"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Role *</Label>
                <SearchableSelect
                  options={ROLE_OPTIONS}
                  value={form.role}
                  onChange={(v) => setForm({ ...form, role: v })}
                  placeholder="Select role"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <SearchableSelect
                  options={STATUS_OPTIONS}
                  value={form.status}
                  onChange={(v) => setForm({ ...form, status: v })}
                  placeholder="Select status"
                />
              </div>
            </div>

            <Separator />

            {form.role === 'CUSTOMER' && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">Customer profile</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">First Name</Label>
                    <Input className="h-9 text-sm" value={form.first_name}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Last Name</Label>
                    <Input className="h-9 text-sm" value={form.last_name}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone</Label>
                  <Input className="h-9 text-sm" value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
            )}

            {form.role === 'PROVIDER' && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">Provider profile</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Company Name</Label>
                    <Input className="h-9 text-sm" value={form.company_name}
                      onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Country (ISO)</Label>
                    <Input className="h-9 text-sm" value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Phone</Label>
                    <Input className="h-9 text-sm" value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <label className="flex items-center gap-2 mt-6 text-xs">
                    <input
                      type="checkbox"
                      checked={form.verified}
                      onChange={(e) => setForm({ ...form, verified: e.target.checked })}
                    />
                    Mark as verified
                  </label>
                </div>
              </div>
            )}

            {form.role === 'CREATOR' && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">Creator profile</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Display Name</Label>
                    <Input className="h-9 text-sm" value={form.display_name}
                      onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Phone</Label>
                    <Input className="h-9 text-sm" value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={form.verified}
                    onChange={(e) => setForm({ ...form, verified: e.target.checked })}
                  />
                  Mark as verified
                </label>
              </div>
            )}

            {form.role === 'ADMIN' && (
              <div className="bg-amber-50 text-amber-700 text-xs p-3 rounded-lg border border-amber-200 flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Admin users have full platform access. Create only when necessary.</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); resetForm(); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" /> Delete User
            </DialogTitle>
            <DialogDescription>
              This permanently removes <strong>{deleteTarget?.email}</strong> and all related data
              (profile, addresses, sessions). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200">{error}</div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
