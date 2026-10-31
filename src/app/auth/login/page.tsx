'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, CircleAlert, Eye, EyeOff, LoaderCircle, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { usePlatformName } from '@/lib/usePlatformName';
import { useApiError } from '@/lib/useApiError';
import { Input } from '@/components/ui/input';
import { DashboardLocaleSwitcher } from '@/components/common/DashboardLocaleSwitcher';
import { BrandPanel, MobileBrandBand } from './BrandPanel';

const inputClass =
  'h-11 rounded-xl border-zinc-200 bg-white ps-10 text-[15px] shadow-xs transition-[border-color,box-shadow] placeholder:text-zinc-400 hover:border-zinc-300 focus-visible:border-zinc-900 focus-visible:ring-4 focus-visible:ring-zinc-900/10 md:text-sm';

export default function LoginPage() {
  const { login } = useAuth();
  const platformName = usePlatformName();
  const apiError = useApiError();
  const t = useTranslations('auth.login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Move focus to the error so screen-reader and keyboard users notice it.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      // fetch() rejects with a TypeError when the API is unreachable.
      setError(err instanceof TypeError ? t('networkError') : apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      <BrandPanel platformName={platformName} />

      <main className="relative flex min-h-screen flex-1 flex-col">
        <div className="px-4 pt-4 sm:px-6 sm:pt-6 lg:hidden">
          <MobileBrandBand platformName={platformName}>
            <DashboardLocaleSwitcher className="w-32 [&_option]:text-zinc-900 [&_select]:border-white/15 [&_select]:bg-white/10 [&_select]:text-white [&_select]:hover:border-white/30 [&_svg]:text-zinc-300" />
          </MobileBrandBand>
        </div>

        <header className="hidden items-center px-10 pt-6 lg:flex">
          <DashboardLocaleSwitcher className="ms-auto w-36" />
        </header>

        <div className="flex flex-1 justify-center px-6 pt-9 pb-10 sm:px-10 lg:items-center lg:py-10">
          <div className="login-rise w-full max-w-[380px]">
            <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-zinc-950">{t('title')}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-500">{t('subtitle')}</p>

            <form onSubmit={handleSubmit} className="mt-9 space-y-5">
              {error && (
                <div
                  ref={errorRef}
                  role="alert"
                  tabIndex={-1}
                  className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 outline-none focus-visible:ring-4 focus-visible:ring-red-500/15"
                >
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="login-email" className="text-sm font-medium text-zinc-800">
                  {t('email')}
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute inset-s-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
                    aria-hidden="true"
                  />
                  <Input
                    ref={emailRef}
                    id="login-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    aria-invalid={error ? true : undefined}
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="login-password" className="text-sm font-medium text-zinc-800">
                  {t('password')}
                </label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute inset-s-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
                    aria-hidden="true"
                  />
                  <Input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('passwordPlaceholder')}
                    aria-invalid={error ? true : undefined}
                    required
                    className={`${inputClass} pe-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={t('showPassword')}
                    aria-pressed={showPassword}
                    title={showPassword ? t('hidePassword') : t('showPassword')}
                    className="absolute inset-e-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition-colors outline-none hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-900/20"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="group relative mt-2 inline-flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-zinc-950 text-[15px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_20px_-8px_rgba(9,9,11,0.6)] transition-[background-color,transform] outline-none hover:bg-zinc-800 focus-visible:ring-4 focus-visible:ring-zinc-900/20 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                    {t('submitting')}
                  </>
                ) : (
                  <>
                    {t('submit')}
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                      aria-hidden="true"
                    />
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 flex items-center gap-2 border-t border-zinc-100 pt-6 text-xs text-zinc-500">
              <ShieldCheck className="size-4 shrink-0 text-zinc-400" aria-hidden="true" />
              {t('secureNote')}
            </p>
          </div>
        </div>

        <footer className="px-6 pb-6 text-xs text-zinc-500 sm:px-10">
          © {new Date().getFullYear()} <bdi>{platformName}</bdi>. {t('rights')}
        </footer>
      </main>
    </div>
  );
}
