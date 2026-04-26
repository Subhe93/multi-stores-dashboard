'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/auth/login');
      return;
    }

    // Redirect to the correct dashboard based on role
    const roleRoutes: Record<string, string> = {
      ADMIN: '/admin',
      PROVIDER: '/provider',
      CREATOR: '/creator',
    };
    router.push(roleRoutes[user.role] || '/auth/login');
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );
}
