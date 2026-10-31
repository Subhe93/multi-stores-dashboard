'use client';

import { useTranslations } from 'next-intl';
import { Check, CreditCard, Globe, ShoppingBag, Store, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Up to two initials from the platform name, used for the CSS monogram mark. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? 'M').slice(0, 2);
  return letters.toUpperCase();
}

/** Champagne-toned monogram tile built purely in CSS (no logo asset). */
export function Monogram({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-semibold tracking-tight text-zinc-950',
        'bg-[linear-gradient(135deg,#f6ead2_0%,#d9bb84_55%,#b8935a_100%)]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_6px_16px_-6px_rgba(201,166,104,0.55)]',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

// Fine noise texture as an inline SVG data URI (no external asset).
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

/**
 * Decorative brand panel for the login page: dark, textured backdrop with an
 * illustrative commerce composition (product card, order toast, revenue card).
 * All numbers inside the mock-ups are illustrative UI, not platform statistics.
 */
export function BrandPanel({ platformName }: { platformName: string }) {
  const t = useTranslations('auth.login');

  const features = [
    { icon: Store, label: t('featureStores') },
    { icon: CreditCard, label: t('featurePayments') },
    { icon: Globe, label: t('featureMarkets') },
  ];

  return (
    <section className="relative hidden min-h-screen w-[55%] flex-col overflow-hidden bg-zinc-950 text-white lg:flex">
      {/* Backdrop: glows, grid and noise */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 inset-s-[-10%] size-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(217,187,132,0.22),transparent)]" />
        <div className="absolute -bottom-48 inset-e-[-12%] size-[680px] rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.20),transparent)]" />
        <div className="absolute top-1/3 inset-e-[18%] size-[360px] rounded-full bg-[radial-gradient(closest-side,rgba(16,185,129,0.10),transparent)]" />
        <div
          className="absolute inset-0 opacity-[0.07] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_45%,black,transparent)]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div className="absolute inset-0 opacity-[0.18] mix-blend-overlay" style={{ backgroundImage: NOISE }} />
      </div>

      <div className="relative z-10 flex flex-1 flex-col px-12 py-10 xl:px-16">
        {/* Wordmark */}
        <div className="flex items-center gap-3">
          <Monogram name={platformName} />
          <span className="text-[15px] font-semibold tracking-tight">{platformName}</span>
        </div>

        {/* Headline */}
        <div className="mt-14 max-w-xl xl:mt-16 [@media(max-height:820px)]:mt-8">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-[#e8d3a8]">
            <span className="size-1.5 rounded-full bg-[#d9bb84]" />
            {t('eyebrow')}
          </p>
          <h2 className="mt-5 bg-[linear-gradient(180deg,#ffffff_0%,#d4d4d8_100%)] bg-clip-text text-4xl leading-[1.12] font-semibold tracking-tight text-transparent xl:text-[44px]">
            {t('headline')}
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-zinc-400">{t('subline')}</p>
        </div>

        {/* Commerce composition (decorative) */}
        <div className="flex flex-1 items-center justify-center py-6">
          {/* Fixed-size scene scaled to the available space; the wrapper reserves the scaled height. */}
          <div className="flex h-[260px] w-full items-center justify-center xl:h-[324px] min-[1400px]:h-[360px] [@media(max-height:820px)]:h-[260px]">
            <CommerceScene />
          </div>
        </div>

        {/* Feature points */}
        <ul className="grid grid-cols-3 gap-6 border-t border-white/10 pt-7">
          {features.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-[#e8d3a8]">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="text-[13px] leading-snug text-zinc-300">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Floating UI mock-ups: product card, order toast, revenue sparkline, status chips. */
function CommerceScene() {
  const t = useTranslations('auth.login');

  return (
    <div
      aria-hidden="true"
      className="relative h-[360px] w-[600px] shrink-0 scale-[0.72] select-none xl:scale-[0.9] min-[1400px]:scale-100 [@media(max-height:820px)]:scale-[0.72]"
    >
      {/* Product card */}
      <div className="login-float absolute top-3 inset-s-[35%] w-[224px]">
        <div className="rounded-2xl bg-white p-2.5 text-zinc-900 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.08)]">
          <div className="relative h-[150px] overflow-hidden rounded-xl bg-[linear-gradient(160deg,#f3ece1_0%,#e4d6c1_60%,#d6c3a6_100%)]">
            <span className="absolute top-2.5 inset-s-2.5 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
              {t('mockInStock')}
            </span>
            {/* Tote bag illustration */}
            <svg viewBox="0 0 120 120" className="absolute inset-x-0 bottom-0 mx-auto h-[132px] w-[132px]">
              <ellipse cx="60" cy="108" rx="34" ry="4" fill="#b59a74" opacity="0.35" />
              <path d="M44 42 C44 24, 76 24, 76 42" fill="none" stroke="#8a6d47" strokeWidth="3.2" strokeLinecap="round" />
              <path d="M30 44 H90 L95 104 H25 Z" fill="#fbf7f0" />
              <path d="M30 44 H90 L95 104 H25 Z" fill="url(#tote)" />
              <path d="M30 44 H90" stroke="#d8c6a8" strokeWidth="1.2" />
              <rect x="49" y="66" width="22" height="14" rx="2" fill="none" stroke="#c7ab7f" strokeWidth="1.2" />
              <defs>
                <linearGradient id="tote" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#ffffff" stopOpacity="0.2" />
                  <stop offset="1" stopColor="#c9b28c" stopOpacity="0.35" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="px-1.5 pt-3 pb-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold">{t('mockProduct')}</span>
              <span className="text-[13px] font-semibold tabular-nums" dir="ltr">349 kr</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-[#e9dcc6] ring-2 ring-zinc-900 ring-offset-1" />
              <span className="size-3 rounded-full bg-zinc-800" />
              <span className="size-3 rounded-full bg-[#7c8a6a]" />
            </div>
            <div className="mt-3 rounded-lg bg-zinc-950 py-2 text-center text-[11px] font-medium text-white">
              {t('mockAddToCart')}
            </div>
          </div>
        </div>
      </div>

      {/* New-order toast */}
      <div className="login-float-slow absolute top-0 inset-e-0 z-10 w-[236px]">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/80 p-3 shadow-[0_20px_40px_-16px_rgba(0,0,0,0.8)] backdrop-blur-md">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
            <ShoppingBag className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[12px] font-semibold text-white">{t('mockNewOrder')}</span>
              <span className="login-pulse-dot size-1.5 shrink-0 rounded-full bg-emerald-400" />
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-zinc-400">
              <span className="tabular-nums" dir="ltr">#1042 · 349 kr</span>
              <span>{t('mockJustNow')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue card */}
      <div className="login-float-late absolute bottom-0 inset-s-0 w-[208px]">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 shadow-[0_24px_48px_-18px_rgba(0,0,0,0.85)] backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-400">{t('mockRevenue')}</span>
            <span className="rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 tabular-nums" dir="ltr">
              +18%
            </span>
          </div>
          <div className="mt-1 text-xl font-semibold tracking-tight text-white tabular-nums" dir="ltr">
            24 580 kr
          </div>
          <div className="text-[10px] text-zinc-500">{t('mockLast7Days')}</div>
          <svg viewBox="0 0 200 56" className="mt-3 h-14 w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#34d399" stopOpacity="0.35" />
                <stop offset="1" stopColor="#34d399" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 44 C14 42, 22 34, 36 36 S 60 46, 74 38 S 100 22, 116 28 S 142 34, 156 20 S 184 10, 200 6 L200 56 L0 56 Z"
              fill="url(#spark-fill)"
            />
            <path
              d="M0 44 C14 42, 22 34, 36 36 S 60 46, 74 38 S 100 22, 116 28 S 142 34, 156 20 S 184 10, 200 6"
              fill="none"
              stroke="#34d399"
              strokeWidth="2"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>

      {/* Status chips */}
      <div className="login-float-slow absolute bottom-20 inset-e-0">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/85 py-1.5 ps-1.5 pe-3 text-[11px] font-medium text-zinc-200 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.8)] backdrop-blur-md">
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-400 text-zinc-950">
            <Check className="size-3" strokeWidth={3} />
          </span>
          {t('mockPaid')}
        </div>
      </div>
      <div className="login-float absolute top-[24%] inset-s-[3%]">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/85 py-1.5 ps-2 pe-3 text-[11px] font-medium text-zinc-200 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.8)] backdrop-blur-md">
          <Truck className="size-3.5 text-[#e8d3a8]" />
          {t('mockShipped')}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact brand band shown above the form on small screens, where the full
 * brand panel is hidden. `children` is rendered at the end (language switcher).
 */
export function MobileBrandBand({ platformName, children }: { platformName: string; children?: React.ReactNode }) {
  const t = useTranslations('auth.login');

  return (
    <section className="relative overflow-hidden rounded-2xl bg-zinc-950 px-5 pt-5 pb-6 text-white lg:hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 inset-s-[-20%] size-[320px] rounded-full bg-[radial-gradient(closest-side,rgba(217,187,132,0.24),transparent)]" />
        <div className="absolute -bottom-32 inset-e-[-25%] size-[340px] rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.22),transparent)]" />
        <div
          className="absolute inset-0 opacity-[0.07] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_40%,black,transparent)]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
      </div>
      <div className="relative flex items-center gap-3">
        <Monogram name={platformName} className="size-8 rounded-lg text-[12px]" />
        <span className="text-[15px] font-semibold tracking-tight">{platformName}</span>
        <div className="ms-auto">{children}</div>
      </div>
      <p className="relative mt-6 text-xl leading-snug font-semibold tracking-tight">{t('headline')}</p>
      <div
        aria-hidden="true"
        className="relative mt-4 inline-flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] py-2 ps-2 pe-3.5 backdrop-blur"
      >
        <span className="inline-flex size-7 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
          <ShoppingBag className="size-3.5" />
        </span>
        <span className="text-[12px] font-medium text-white">{t('mockNewOrder')}</span>
        <span className="text-[12px] text-zinc-400 tabular-nums" dir="ltr">
          #1042 · 349 kr
        </span>
        <span className="login-pulse-dot size-1.5 rounded-full bg-emerald-400" />
      </div>
    </section>
  );
}
