'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Store as StoreIcon, ImageIcon, ExternalLink, Search, Package2, BadgeCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface ProviderStore {
  id: string;
  slug: string;
  custom_domain?: string | null;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  is_active: boolean;
  created_at: string;
  products_using_count: number;
  creator: {
    display_name: string;
    avatar_url?: string | null;
    verified: boolean;
  };
  language_config?: { primary_locale: string } | null;
}

export default function ProviderStores() {
  const { token } = useAuth();
  const router = useRouter();
  const [stores, setStores] = useState<ProviderStore[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchStores = async (page = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<any>(`/providers/me/stores?page=${page}&limit=20`, { token });
      setStores(res?.data || []);
      setMeta(res?.meta || null);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStores(); }, [token]);

  const filtered = search
    ? stores.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.creator.display_name.toLowerCase().includes(search.toLowerCase()) ||
        s.slug.toLowerCase().includes(search.toLowerCase()),
      )
    : stores;

  if (!loading && stores.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Stores using your products</h1>
          <p className="text-sm text-muted-foreground">Creators who imported your products into their stores</p>
        </div>
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
              <StoreIcon className="w-6 h-6 text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">No stores yet</p>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Once a creator imports one of your products into their store, it will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Stores using your products</h1>
        <p className="text-sm text-muted-foreground">
          {meta?.total ?? 0} store{(meta?.total ?? 0) === 1 ? '' : 's'} importing products from you
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Search by store, creator, or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      <Card className="shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-zinc-50/50">
              <tr>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">Store</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">Creator</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">Your products</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">Status</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">Created</th>
                <th className="w-16 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">No stores match your search</td></tr>
              ) : (
                filtered.map(store => (
                  <tr
                    key={store.id}
                    className="hover:bg-zinc-50 transition cursor-pointer"
                    onClick={() => router.push(`/provider/stores/${store.id}`)}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-md bg-zinc-100 border overflow-hidden flex items-center justify-center shrink-0">
                          {store.logo_url
                            ? <img src={store.logo_url} alt="" className="h-full w-full object-cover" />
                            : <ImageIcon className="w-3.5 h-3.5 text-zinc-300" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{store.name}</p>
                          <p className="text-[10px] text-muted-foreground">/{store.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{store.creator.display_name}</span>
                        {store.creator.verified && (
                          <BadgeCheck className="w-3 h-3 text-emerald-500" aria-label="Verified" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[10px]">
                        <Package2 className="w-3 h-3 mr-1" />
                        {store.products_using_count}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${
                          store.is_active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                        }`}
                      >
                        {store.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(store.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/provider/stores/${store.id}`);
                        }}
                      >
                        View <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-2">
            <span className="text-xs text-muted-foreground">{meta.total} stores</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={meta.page <= 1} onClick={() => fetchStores(meta.page - 1)}>Prev</Button>
              <span className="text-xs px-2 py-1">{meta.page} / {meta.totalPages}</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={meta.page >= meta.totalPages} onClick={() => fetchStores(meta.page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
