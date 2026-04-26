'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckSquare, Clock, Package } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '');
function resolveUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

interface PendingCustomProduct {
  id: string;
  submitted_at: string | null;
  pricing_type: string;
  final_price: number;
  margin_amount: number | null;
  product: {
    id: string;
    base_price: number;
    translations: { locale: string; title: string }[];
    images: { url: string }[];
  };
  creator: { display_name: string };
  translations: { locale: string; title: string }[];
  mockup_images: { url: string }[];
}

export default function ProviderReviewsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<PendingCustomProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api<{ data: PendingCustomProduct[] }>('/custom-products/pending-reviews', { token })
      .then((res) => setItems(res?.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const formatDate = (s?: string | null) => {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Custom Product Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Review and approve custom products created by creators using your products
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Loading...</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
            <CheckSquare className="size-6" />
          </div>
          <p className="text-sm font-medium">No pending reviews</p>
          <p className="mt-1 text-xs text-muted-foreground">
            All custom products are up to date
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const title = item.translations?.find((t) => t.locale === 'en')?.title
              || item.translations?.[0]?.title
              || 'Untitled';
            const baseTitle = item.product.translations?.find((t) => t.locale === 'en')?.title
              || item.product.translations?.[0]?.title;
            const imgUrl = item.mockup_images?.[0]?.url || item.product.images?.[0]?.url;

            return (
              <Card
                key={item.id}
                className="shadow-none cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/provider/reviews/${item.id}`)}
              >
                <CardContent className="p-3">
                  <div className="aspect-square w-full rounded-lg overflow-hidden bg-zinc-100 mb-3">
                    {imgUrl ? (
                      <img
                        src={resolveUrl(imgUrl)}
                        alt={title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-300">
                        <Package className="w-12 h-12" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-semibold truncate">{title}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    by {item.creator.display_name}
                  </p>
                  {baseTitle && (
                    <p className="text-[10px] text-muted-foreground truncate mt-1">
                      Base: {baseTitle}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    Submitted {formatDate(item.submitted_at)}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}