'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, MapPin, Phone, CheckCircle2, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function ProviderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [provider, setProvider] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProvider = () => {
    if (!token || !id) return;
    api<any>(`/providers/${id}`, { token })
      .then(setProvider)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProvider(); }, [token, id]);

  const handleVerify = async () => {
    if (!token) return;
    await api(`/providers/${id}/verify`, { method: 'PUT', token });
    fetchProvider();
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!provider) return <p className="text-center py-12 text-muted-foreground">Provider not found</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/providers" className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{provider.company_name}</h1>
            <p className="text-sm text-muted-foreground">{provider.user?.email}</p>
          </div>
        </div>
        {provider.verified
          ? <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" />Verified</Badge>
          : <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
        }
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="shadow-none">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Company Info</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" />{provider.user?.email}</div>
            <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" />{provider.country}</div>
            {provider.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" />{provider.phone}</div>}
            {provider.description && <p className="text-muted-foreground">{provider.description}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!provider.verified && (
              <Button size="sm" className="w-full" onClick={handleVerify}>Verify Provider</Button>
            )}
            <p className="text-[10px] text-muted-foreground">Joined {new Date(provider.created_at).toLocaleDateString()}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
