'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
};

export default function AdminUsers() {
  const { token } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);

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

  const handleFilter = (filter: string) => {
    setActiveFilter(filter);
    const map: Record<string, { role?: string; status?: string }> = {
      All: {}, Providers: { role: 'PROVIDER' }, Creators: { role: 'CREATOR' },
      Customers: { role: 'CUSTOMER' }, Pending: { status: 'PENDING' },
    };
    const f = map[filter] || {};
    fetchUsers(1, f.role, f.status);
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    if (!token) return;
    await api(`/admin/users/${userId}/status`, { method: 'PUT', token, body: JSON.stringify({ status: newStatus }) });
    fetchUsers(page);
  };

  const getName = (u: User) => {
    if (u.provider) return u.provider.company_name;
    if (u.creator) return u.creator.display_name;
    if (u.customer) return `${u.customer.first_name} ${u.customer.last_name}`;
    return u.email;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">Manage platform users</p>
      </div>

      <div className="flex gap-1.5">
        {['All', 'Providers', 'Creators', 'Customers', 'Pending'].map((tab) => (
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
            <div className="flex gap-1">
              {item.status === 'ACTIVE' && item.role !== 'ADMIN' && (
                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => handleStatusChange(item.id, 'SUSPENDED')}>Suspend</Button>
              )}
              {item.status === 'SUSPENDED' && (
                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => handleStatusChange(item.id, 'ACTIVE')}>Reactivate</Button>
              )}
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => router.push(`/admin/users/${item.id}`)}>View</Button>
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
    </div>
  );
}
