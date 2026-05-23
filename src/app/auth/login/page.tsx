'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/useApiError';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const { login } = useAuth();
  const apiError = useApiError();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <Card className="w-full max-w-sm shadow-none">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-bold">Multi-Stores</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to your dashboard</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg border border-red-200">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@multistores.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            {/* Quick login buttons for testing */}
            <div className="pt-2 border-t">
              <p className="text-[10px] text-muted-foreground text-center mb-2">Quick login (dev only)</p>
              <div className="grid grid-cols-3 gap-2">
                <Button type="button" variant="outline" size="sm" className="text-[10px] h-7"
                  onClick={() => { setEmail('admin@multistores.com'); setPassword('admin123456'); }}>
                  Admin
                </Button>
                <Button type="button" variant="outline" size="sm" className="text-[10px] h-7"
                  onClick={() => { setEmail('provider@test.com'); setPassword('provider123'); }}>
                  Provider
                </Button>
                <Button type="button" variant="outline" size="sm" className="text-[10px] h-7"
                  onClick={() => { setEmail('creator@test.com'); setPassword('creator123'); }}>
                  Creator
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
