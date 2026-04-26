'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail, Phone, CheckCircle2, Clock, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import Link from 'next/link';

interface Store {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
}

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003';

function storeUrl(slug: string): string {
  const u = new URL(WEB_ORIGIN);
  return `${u.protocol}//${slug}.${u.host}`;
}

export default function CreatorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [creator, setCreator] = useState<any>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const [slug, setSlug] = useState('');
  const [savingSlug, setSavingSlug] = useState(false);
  const [slugMsg, setSlugMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const fetchCreator = () => {
    if (!token || !id) return;
    api<any>(`/creators/${id}`, { token })
      .then(setCreator)
      .catch(console.error);
  };

  const fetchStore = () => {
    if (!token || !id) return;
    api<Store>(`/stores/by-creator/${id}`, { token })
      .then((s) => { setStore(s); setSlug(s.slug); })
      .catch(() => setStore(null));
  };

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    Promise.all([
      api<any>(`/creators/${id}`, { token }).then(setCreator).catch(console.error),
      api<Store>(`/stores/by-creator/${id}`, { token })
        .then((s) => { setStore(s); setSlug(s.slug); })
        .catch(() => setStore(null)),
    ]).finally(() => setLoading(false));
  }, [token, id]);

  const handleVerify = async () => {
    if (!token) return;
    await api(`/creators/${id}/verify`, { method: 'PUT', token });
    fetchCreator();
  };

  const handleSaveSlug = async () => {
    if (!token || !store || savingSlug) return;
    const next = slug.trim().toLowerCase();
    if (!next || next === store.slug) return;
    setSavingSlug(true);
    setSlugMsg(null);
    try {
      const updated = await api<Store>(`/stores/by-creator/${id}`, {
        method: 'PUT', token,
        body: JSON.stringify({ slug: next }),
      });
      setStore(updated);
      setSlug(updated.slug);
      setSlugMsg({ kind: 'ok', text: 'Slug updated' });
    } catch (err: any) {
      setSlugMsg({ kind: 'err', text: err?.message || 'Failed to update slug' });
    } finally {
      setSavingSlug(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!creator) return <p className="text-center py-12 text-muted-foreground">Creator not found</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/creators" className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{creator.display_name}</h1>
            <p className="text-sm text-muted-foreground">{creator.user?.email}</p>
          </div>
        </div>
        {creator.verified
          ? <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" />Verified</Badge>
          : <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
        }
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="shadow-none">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Creator Info</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" />{creator.user?.email}</div>
            {creator.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" />{creator.phone}</div>}
            {creator.bio && <div><p className="text-xs text-muted-foreground font-medium mb-1">Bio</p><p className="text-muted-foreground">{creator.bio}</p></div>}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!creator.verified && (
              <Button size="sm" className="w-full" onClick={handleVerify}>Verify Creator</Button>
            )}
            <p className="text-[10px] text-muted-foreground">Joined {new Date(creator.created_at).toLocaleDateString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-semibold">Store</CardTitle>
          {store && (
            <a href={storeUrl(store.slug)} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="h-7 text-[11px]">
                <ExternalLink className="w-3 h-3 mr-1" /> Visit
              </Button>
            </a>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!store ? (
            <p className="text-sm text-muted-foreground">This creator hasn't set up a store yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Store Name</Label>
                  <Input className="h-8 text-sm" value={store.name} disabled readOnly />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <div className="h-8 flex items-center">
                    {store.is_active
                      ? <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
                      : <Badge variant="outline" className="text-[10px] bg-zinc-50 text-zinc-600 border-zinc-200">Inactive</Badge>}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Slug</Label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center flex-1">
                    <Input
                      className="h-8 text-sm rounded-r-none border-r-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="store-slug"
                    />
                    <span className="h-8 px-3 flex items-center bg-zinc-50 border border-zinc-200 rounded-r-md text-xs text-muted-foreground whitespace-nowrap">.platform.com</span>
                  </div>
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={handleSaveSlug}
                    disabled={savingSlug || !slug.trim() || slug.trim() === store.slug}
                  >
                    {savingSlug ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving</> : 'Save'}
                  </Button>
                </div>
                {slugMsg && (
                  <p className={`text-[11px] ${slugMsg.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{slugMsg.text}</p>
                )}
                <p className="text-[11px] text-muted-foreground">Lowercase letters, digits and hyphens only.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
