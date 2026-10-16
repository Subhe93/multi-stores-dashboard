'use client';

import { ListChecks, Loader2 } from 'lucide-react';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppTurnedOff } from '@/components/apps/AppTurnedOff';
import { useAuth } from '@/lib/auth';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';

/**
 * Gate of the full-screen production routes (outside the creator shell, like
 * `/builder`): creators only, and only while the production app is on.
 */
export function ProductionRouteGuard({ children }: { children: (token: string) => React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['CREATOR']}>
      <Inner>{children}</Inner>
    </ProtectedRoute>
  );
}

function Inner({ children }: { children: (token: string) => React.ReactNode }) {
  const { token } = useAuth();
  const { apps, loading } = useStoreApps();
  if (!token) return null;
  if (loading && !apps) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAppEnabled(apps, 'production')) {
    return (
      <div className="mx-auto max-w-lg p-4 pt-16">
        <AppTurnedOff icon={ListChecks} />
      </div>
    );
  }
  return <>{children(token)}</>;
}
