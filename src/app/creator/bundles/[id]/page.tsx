'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { BundleForm } from '@/components/creator/bundles/BundleForm';
import type { Bundle } from '@/components/creator/bundles/types';

export default function EditBundlePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !id) return;
    let cancelled = false;
    api<Bundle>(`/bundles/${id}`, { token })
      .then((data) => {
        if (!cancelled) setBundle(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load bundle');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="text-sm text-destructive">{error || 'Bundle not found.'}</p>
        <button
          type="button"
          onClick={() => router.push('/creator/bundles')}
          className="text-xs text-primary hover:underline"
        >
          Back to bundles
        </button>
      </div>
    );
  }

  return <BundleForm mode="edit" initial={bundle} />;
}
