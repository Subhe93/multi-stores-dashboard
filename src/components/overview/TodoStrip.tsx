'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronRight, CircleCheck, CreditCard, FileEdit, Hourglass, PackageOpen, PackageX } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { OverviewTodo } from './overview.api';

interface TodoItem {
  key: string;
  count: number;
  label: string;
  href: string;
  icon: LucideIcon;
  tone: 'attention' | 'neutral';
}

/**
 * Shopify-style "things to do": one chip per non-zero count, linking to the
 * list it concerns. Only filters that the target pages actually read are used
 * (/creator/products/own?status=…); the orders list has no status URL filter,
 * so order chips open the list itself.
 */
export function TodoStrip({ todo, independent }: { todo: OverviewTodo; independent: boolean }) {
  const t = useTranslations('creator.overview.todo');
  const productsList = independent ? '/creator/products/own' : '/creator/custom-products';
  const statusLink = (status: string) =>
    independent ? `/creator/products/own?status=${status}` : '/creator/custom-products';

  const items: TodoItem[] = (
    [
      {
        key: 'unfulfilled',
        count: todo.unfulfilled_orders ?? 0,
        label: t('unfulfilled', { count: todo.unfulfilled_orders ?? 0 }),
        href: '/creator/orders',
        icon: PackageOpen,
        tone: 'attention',
      },
      {
        key: 'pendingPayment',
        count: todo.pending_payment_orders ?? 0,
        label: t('pendingPayment', { count: todo.pending_payment_orders ?? 0 }),
        href: '/creator/orders',
        icon: CreditCard,
        tone: 'attention',
      },
      {
        key: 'lowStock',
        count: todo.low_stock_products ?? 0,
        label: t('lowStock', { count: todo.low_stock_products ?? 0 }),
        href: productsList,
        icon: PackageX,
        tone: 'attention',
      },
      {
        key: 'pendingReview',
        count: todo.pending_review_products ?? 0,
        label: t('pendingReview', { count: todo.pending_review_products ?? 0 }),
        href: statusLink('PENDING_REVIEW'),
        icon: Hourglass,
        tone: 'neutral',
      },
      {
        key: 'drafts',
        count: todo.draft_products ?? 0,
        label: t('drafts', { count: todo.draft_products ?? 0 }),
        href: statusLink('DRAFT'),
        icon: FileEdit,
        tone: 'neutral',
      },
    ] satisfies TodoItem[]
  ).filter((i) => i.count > 0);

  if (!items.length) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
        <CircleCheck className="size-4 text-emerald-600" aria-hidden="true" />
        {t('allDone')}
      </div>
    );
  }

  return (
    <nav aria-label={t('title')}>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                className="group inline-flex h-9 items-center gap-2 rounded-lg border bg-card ps-2.5 pe-2 text-sm font-medium text-foreground transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span
                  className={
                    item.tone === 'attention'
                      ? 'flex size-5 items-center justify-center rounded-md bg-amber-100 text-amber-800'
                      : 'flex size-5 items-center justify-center rounded-md bg-zinc-100 text-zinc-600'
                  }
                  aria-hidden="true"
                >
                  <Icon className="size-3.5" />
                </span>
                {item.label}
                <ChevronRight
                  className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TodoStripSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {[140, 170, 150].map((w) => (
        <div key={w} className="h-9 animate-pulse rounded-lg bg-muted" style={{ width: w }} />
      ))}
    </div>
  );
}
