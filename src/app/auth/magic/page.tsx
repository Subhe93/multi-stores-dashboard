'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, LinkIcon, LoaderCircle, RotateCw, ShieldCheck, Store, WifiOff, CircleAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth, type AuthTokens } from '@/lib/auth';
import { classifyMagicError, hasMagicToken, readMagicToken, roleHomePath, stripMagicToken, type MagicFailure } from '@/lib/magicLogin';
import { usePlatformName } from '@/lib/usePlatformName';
import { DashboardLocaleSwitcher } from '@/components/common/DashboardLocaleSwitcher';
import { cn } from '@/lib/utils';
import { BrandPanel, MobileBrandBand } from '../login/BrandPanel';

type Phase = 'loading' | 'customer' | MagicFailure;

// One request per token for the lifetime of the page. The token is single use,
// so React strict mode's double effect (or a remount) must reuse the same
// in-flight request instead of firing a second one that would always fail.
const exchanges = new Map<string, Promise<AuthTokens>>();

function exchangeToken(token: string): Promise<AuthTokens> {
  let pending = exchanges.get(token);
  if (!pending) {
    pending = api<AuthTokens>('/auth/magic-login', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    // Only a definitive "invalid" answer is final; a network failure, throttle
    // or server error may be retried with the same token.
    pending.catch((err) => {
      if (classifyMagicError(err) !== 'invalid') exchanges.delete(token);
    });
    exchanges.set(token, pending);
  }
  return pending;
}

export default function MagicLoginPage() {
  const { loginWithTokens } = useAuth();
  const platformName = usePlatformName();
  const t = useTranslations('auth.magic');
  const tl = useTranslations('auth.login');
  const [phase, setPhase] = useState<Phase>('loading');
  const [attempt, setAttempt] = useState(0);
  // Read once: the URL is cleaned right after, so later effect runs use the ref.
  const tokenRef = useRef<string | null | undefined>(undefined);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Latest loginWithTokens without making it an effect dependency (a new
  // identity must not re-run the exchange).
  const loginRef = useRef(loginWithTokens);
  useEffect(() => {
    loginRef.current = loginWithTokens;
  }, [loginWithTokens]);

  useEffect(() => {
    if (tokenRef.current === undefined) {
      const { pathname, search, hash } = window.location;
      tokenRef.current = readMagicToken(search, hash);
      // Drop the secret from the address bar and history straight away.
      if (hasMagicToken(search, hash)) {
        window.history.replaceState(window.history.state, '', stripMagicToken(pathname, search, hash));
      }
    }
    const token = tokenRef.current;

    let cancelled = false;
    // A missing or malformed token is reported exactly like a used one.
    const exchange = token ? exchangeToken(token) : Promise.reject({ code: 'MAGIC_LINK_INVALID' });
    exchange
      .then(async (data) => {
        if (cancelled) return;
        // Customer accounts sign in on their store, never on the dashboard.
        if (!roleHomePath(data.user?.role)) {
          setPhase('customer');
          return;
        }
        await loginRef.current(data);
      })
      .catch((err) => {
        if (!cancelled) setPhase(classifyMagicError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Move focus to the result so screen-reader and keyboard users notice it.
  useEffect(() => {
    if (phase !== 'loading') headingRef.current?.focus();
  }, [phase]);

  const retry = useCallback(() => {
    setPhase('loading');
    setAttempt((n) => n + 1);
  }, []);

  const view = {
    loading: { icon: LoaderCircle, tone: 'neutral', title: t('signingIn'), body: t('signingInHint') },
    invalid: { icon: LinkIcon, tone: 'warn', title: t('invalidTitle'), body: t('invalidBody') },
    customer: { icon: Store, tone: 'neutral', title: t('customerTitle'), body: t('customerBody') },
    network: { icon: WifiOff, tone: 'warn', title: t('networkTitle'), body: t('networkBody') },
    error: { icon: CircleAlert, tone: 'warn', title: t('errorTitle'), body: t('errorBody') },
  }[phase];
  const Icon = view.icon;
  const canRetry = phase === 'network' || phase === 'error';

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
          <div key={phase} className="login-rise w-full max-w-[380px]" aria-live="polite">
            <span
              aria-hidden="true"
              className={cn(
                'inline-flex size-12 items-center justify-center rounded-2xl border',
                view.tone === 'warn'
                  ? 'border-amber-200 bg-amber-50 text-amber-600'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-700',
              )}
            >
              <Icon className={cn('size-5', phase === 'loading' && 'animate-spin')} />
            </span>

            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-6 text-[26px] leading-tight font-semibold tracking-tight text-zinc-950 outline-none"
            >
              {view.title}
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-500">{view.body}</p>

            {phase !== 'loading' && (
              <div className="mt-8 space-y-3">
                {canRetry && (
                  <button
                    type="button"
                    onClick={retry}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 text-[15px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_20px_-8px_rgba(9,9,11,0.6)] transition-[background-color,transform] outline-none hover:bg-zinc-800 focus-visible:ring-4 focus-visible:ring-zinc-900/20 active:translate-y-px"
                  >
                    <RotateCw className="size-4" aria-hidden="true" />
                    {t('retry')}
                  </button>
                )}
                {phase !== 'customer' && (
                  <Link
                    href="/auth/login"
                    className={cn(
                      'group inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-medium transition-[background-color,border-color,transform] outline-none focus-visible:ring-4 focus-visible:ring-zinc-900/20 active:translate-y-px',
                      canRetry
                        ? 'border border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50'
                        : 'bg-zinc-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_20px_-8px_rgba(9,9,11,0.6)] hover:bg-zinc-800',
                    )}
                  >
                    {t('goToLogin')}
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                )}
              </div>
            )}

            <p className="mt-8 flex items-center gap-2 border-t border-zinc-100 pt-6 text-xs text-zinc-500">
              <ShieldCheck className="size-4 shrink-0 text-zinc-400" aria-hidden="true" />
              {tl('secureNote')}
            </p>
          </div>
        </div>

        <footer className="px-6 pb-6 text-xs text-zinc-500 sm:px-10">
          © {new Date().getFullYear()} <bdi>{platformName}</bdi>. {tl('rights')}
        </footer>
      </main>
    </div>
  );
}
