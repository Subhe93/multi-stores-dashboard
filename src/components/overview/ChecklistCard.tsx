'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Check, ChevronRight, X } from 'lucide-react';
import type { OverviewSetup } from './overview.api';

const DISMISS_KEY = 'ms-overview-setup-dismissed';

const subscribeNoop = () => () => {};

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

type SetupKey = keyof OverviewSetup;

interface ChecklistCardProps {
  setup: OverviewSetup;
  independent: boolean;
}

/**
 * Store setup progress. Only items the API reports are listed; the card is
 * hidden once everything is done or the creator dismisses it (remembered per
 * browser — storage failures just keep it visible).
 */
export function ChecklistCard({ setup, independent }: ChecklistCardProps) {
  const t = useTranslations('creator.overview.setup');
  // Stored flag read without an effect; hidden during SSR so a dismissed card
  // never flashes. `dismissedNow` covers the click before storage is re-read.
  const storedDismissed = useSyncExternalStore(subscribeNoop, readDismissed, () => true);
  const [dismissedNow, setDismissedNow] = useState(false);
  const dismissed = storedDismissed || dismissedNow;

  const routes: Record<SetupKey, string> = {
    has_products: independent ? '/creator/products/own/new' : '/creator/custom-products/new',
    has_logo: '/creator/store',
    has_payment: '/creator/settings?tab=payments',
    has_shipping: '/creator/shipping',
    has_domain: '/creator/store',
    has_published_theme: '/creator/themes',
  };
  const order: SetupKey[] = [
    'has_products',
    'has_logo',
    'has_payment',
    'has_shipping',
    'has_published_theme',
    'has_domain',
  ];
  const items = order
    .filter((k) => typeof setup[k] === 'boolean')
    .map((k) => ({ key: k, done: !!setup[k], href: routes[k] }));
  const done = items.filter((i) => i.done).length;

  if (dismissed || !items.length || done === items.length) return null;

  const dismiss = () => {
    setDismissedNow(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Storage unavailable: hidden for this visit only.
    }
  };

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="overview-setup-title">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <h2 id="overview-setup-title" className="text-sm font-semibold">{t('title')}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('progress', { done, total: items.length })}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="-me-1 -mt-1 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label={t('dismiss')}
        >
          <X className="size-4" />
        </button>
      </div>
      <div
        className="mx-4 mt-3 h-1.5 overflow-hidden rounded-full bg-(--viz-track)"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={done}
        aria-label={t('title')}
      >
        <div
          className="h-full rounded-full bg-(--viz-accent) transition-all"
          style={{ width: `${(done / items.length) * 100}%` }}
        />
      </div>
      <ul className="mt-2 grid gap-x-2 px-2 pb-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="group flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition hover:bg-zinc-50"
            >
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
                <span className="sr-only"> — {item.done ? t('done') : t('todo')}</span>
              </span>
              {!item.done && (
                <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" aria-hidden="true" />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
