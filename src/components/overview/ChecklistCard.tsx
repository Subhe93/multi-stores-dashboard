'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import type { OverviewSetup } from './overview.api';
import type { MyStoreSummary } from '@/lib/useStorefrontUrl';
import { effectiveStoreStatus } from '@/lib/useStorefrontUrl';
import { computeSetupChecklist, setupStepHref, type OnboardingSurvey } from '@/lib/storeStatus';
import { hasSurveyAnswers, PREVIEWED_KEY, resolveOnboardingSurvey, SETUP_DISMISS_KEY } from '@/lib/onboardingSurvey';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { OwnKeyTestModeHint } from '@/components/payments/own-key/OwnKeyTestModeHint';

const subscribeNoop = () => () => {};

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
const readDismissed = () => readFlag(SETUP_DISMISS_KEY);
const readPreviewed = () => readFlag(PREVIEWED_KEY);
// Browser copy of the survey, read once (SSR → none); the server profile
// (`GET /auth/me` → creator.onboarding_profile) wins when it has answers.
let localSurveyCache: OnboardingSurvey | null = null;
const readLocalSurvey = () => (localSurveyCache ??= resolveOnboardingSurvey(null));

interface ChecklistCardProps {
  store: MyStoreSummary;
  /** Overview `setup` signals (shipping / payments); absent on the fallback path. */
  setup?: OverviewSetup | null;
  independent: boolean;
  storeUrl?: string | null;
}

/**
 * Setup checklist (PLAN §2.4): verify email · create store · first product ·
 * theme · shipping · payments · trader details · legal pages (independent)
 * · preview · request go-live,
 * computed from the API go-live checklist plus the overview setup signals.
 * Collapsible; dismissable per browser (Settings → "Show setup guide"
 * reopens it). Hidden once every step is done.
 */
export function ChecklistCard({ store, setup, independent, storeUrl }: ChecklistCardProps) {
  const t = useTranslations('creator.overview.setup');
  const storedDismissed = useSyncExternalStore(subscribeNoop, readDismissed, () => true);
  const previewed = useSyncExternalStore(subscribeNoop, readPreviewed, () => false);
  const { user } = useAuth();
  const localSurvey = useSyncExternalStore(subscribeNoop, readLocalSurvey, () => null);
  const profile = user?.creator?.onboarding_profile;
  const survey = hasSurveyAnswers(profile) ? resolveOnboardingSurvey(profile) : localSurvey;
  const [dismissedNow, setDismissedNow] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const dismissed = storedDismissed || dismissedNow;

  const steps = computeSetupChecklist(
    {
      status: effectiveStoreStatus(store),
      checklist: store.golive_checklist,
      setup: { has_shipping: setup?.has_shipping, has_payment: setup?.has_payment },
      previewed,
      independent,
    },
    survey,
  );
  const done = steps.filter((s) => s.done).length;

  if (dismissed || done === steps.length) return null;

  const dismiss = () => {
    setDismissedNow(true);
    try {
      window.localStorage.setItem(SETUP_DISMISS_KEY, '1');
    } catch {
      // Storage unavailable: hidden for this visit only.
    }
  };

  const next = steps.find((s) => !s.done);

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="overview-setup-title">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-controls="overview-setup-list"
          className="group flex min-w-0 items-start gap-2 text-start"
        >
          <ChevronDown className={cn('mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform', collapsed && '-rotate-90 rtl:rotate-90')} aria-hidden="true" />
          <span className="min-w-0">
            <h2 id="overview-setup-title" className="text-sm font-semibold">{t('title')}</h2>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t('progress', { done, total: steps.length })}
              {collapsed && next ? ` · ${t('nextUp', { step: t(`items.${next.key}`) })}` : ''}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="-me-1 -mt-1 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label={t('dismiss')}
          title={t('dismissHint')}
        >
          <X className="size-4" />
        </button>
      </div>
      <div
        className="mx-4 mt-3 h-1.5 overflow-hidden rounded-full bg-(--viz-track)"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={done}
        aria-label={t('title')}
      >
        <div className="h-full rounded-full bg-(--viz-accent) transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      {!collapsed && (
        <ul id="overview-setup-list" className="mt-2 grid gap-x-2 px-2 pb-2 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((item) => {
            const href = setupStepHref(item.key, independent, storeUrl);
            const external = href.startsWith('http');
            const inner = (
              <>
                <span
                  className={
                    item.done
                      ? 'flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white'
                      : 'flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-zinc-300'
                  }
                  aria-hidden="true"
                >
                  {item.done && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className={item.done ? 'flex-1 text-muted-foreground line-through' : 'flex-1 font-medium'}>
                  {t(`items.${item.key}`)}
                  {!item.done && item.required && (
                    <span className="ms-1.5 rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-800 no-underline">{t('required')}</span>
                  )}
                  <span className="sr-only"> — {item.done ? t('done') : t('todo')}</span>
                </span>
                {!item.done && <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" aria-hidden="true" />}
              </>
            );
            const cls = 'group flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition hover:bg-zinc-50';
            return (
              <li key={item.key}>
                {external ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className={cls} onClick={() => { try { window.localStorage.setItem(PREVIEWED_KEY, '1'); } catch { /* ignore */ } }}>
                    {inner}
                  </a>
                ) : (
                  <Link href={href} className={cls}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!collapsed && store.golive_checklist?.payments_hint === 'OWN_KEY_TEST_MODE' && (
        <OwnKeyTestModeHint className="mx-4 mb-4" />
      )}
    </section>
  );
}
