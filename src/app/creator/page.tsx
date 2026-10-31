'use client';

import { Suspense, useCallback, useSyncExternalStore } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useCurrency } from '@/lib/useCurrency';
import { useStoreType } from '@/lib/useStoreType';
import { useStorefrontUrl } from '@/lib/useStorefrontUrl';
import { OverviewView, type OverviewState } from '@/components/overview/OverviewView';
import { parseRange, DEFAULT_RANGE, type OverviewRange } from '@/components/overview/overview.api';
import { useOverview } from '@/components/overview/useOverview';

const subscribeNoop = () => () => {};
const localHour = () => new Date().getHours();

function CreatorOverviewInner() {
  const { token, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const range = parseRange(searchParams.get('range'));
  const { storeType, loading: storeTypeLoading } = useStoreType();
  const independent = storeType === 'INDEPENDENT';
  const { currency } = useCurrency();
  const { baseUrl } = useStorefrontUrl();
  // Client-only: the greeting depends on the viewer's local time (null on the server).
  const hour = useSyncExternalStore(subscribeNoop, localHour, () => null);

  const { result, error, loading, updatedAt, refetch } = useOverview(token, range, {
    independent,
    // The fallback path needs the store type to pick the products endpoint.
    enabled: !storeTypeLoading || storeType != null,
  });

  const setRange = useCallback(
    (r: OverviewRange) => {
      const params = new URLSearchParams(searchParams.toString());
      if (r === DEFAULT_RANGE) params.delete('range');
      else params.set('range', r);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const state: OverviewState = result
    ? { status: 'ready', result }
    : error
      ? { status: 'error', message: error }
      : { status: 'loading' };

  return (
    <OverviewView
      range={range}
      onRangeChange={setRange}
      state={state}
      refreshing={!!result && loading}
      refreshFailed={!!result && !!error}
      updatedAt={updatedAt}
      onRefresh={refetch}
      name={user?.creator?.display_name ?? null}
      storeUrl={baseUrl}
      independent={independent}
      currency={currency}
      hour={hour}
    />
  );
}

export default function CreatorOverview() {
  return (
    <Suspense fallback={null}>
      <CreatorOverviewInner />
    </Suspense>
  );
}
