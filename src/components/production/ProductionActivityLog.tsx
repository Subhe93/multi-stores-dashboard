'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, History, Loader2 } from 'lucide-react';
import { useApiError } from '@/lib/useApiError';
import { cn } from '@/lib/utils';
import { productionApi, type ProductionEvent } from './production.api';

const KNOWN_ACTIONS = ['CHECK', 'UNCHECK', 'ADD', 'REMOVE', 'BULK', 'VALUE_CHANGED', 'STALE', 'COMPLETED', 'AUTO_ADVANCE'];

interface ProductionActivityLogProps {
  token: string;
  orderId: string;
  /** Bumped by the checklist after each write; reloads the log while open. */
  version: number;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null;
}

/** Collapsible audit log of the checklist (GET production/my/orders/:id/events, newest first). */
export function ProductionActivityLog({ token, orderId, version }: ProductionActivityLogProps) {
  const t = useTranslations('creator.production');
  const tc = useTranslations('creator');
  const apiError = useApiError();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<ProductionEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    productionApi
      .events(token, orderId)
      .then((rows) => {
        if (!cancelled) {
          setEvents(rows ?? []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(apiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apiError is a fresh closure each render
  }, [open, token, orderId, version]);

  const describe = (e: ProductionEvent): string => {
    const p = e.payload ?? {};
    const label = [str(p.label), str(p.value)].filter(Boolean).join(': ');
    switch (e.action) {
      case 'BULK':
        return t('events.BULK', { count: Number(p.count ?? 0), done: p.done ? 'yes' : 'no' });
      case 'VALUE_CHANGED': {
        const to = (p.to ?? {}) as Record<string, unknown>;
        return t('events.VALUE_CHANGED', { label: [str(to.label), str(to.value)].filter(Boolean).join(': ') });
      }
      case 'AUTO_ADVANCE': {
        const status = str(p.to) ?? str(p.status) ?? '';
        return t('events.AUTO_ADVANCE', { status: status && tc.has(`orderStatus.${status}`) ? tc(`orderStatus.${status}`) : status });
      }
      default:
        return KNOWN_ACTIONS.includes(e.action) ? t(`events.${e.action}`, { label }) : e.action;
    }
  };

  return (
    <div className="border-t pt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center gap-2 rounded-md px-1 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        <History className="size-3.5" />
        <span className="flex-1 text-start">{t('activity')}</span>
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-1 pb-1 pt-1">
          {loading && !events ? (
            <div className="flex justify-center py-3">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : !events || events.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('activityEmpty')}</p>
          ) : (
            <ol className="max-h-72 space-y-1.5 overflow-y-auto">
              {events.map((e) => (
                <li key={e.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-zinc-300" />
                  <div className="min-w-0">
                    <p className="break-words">{describe(e)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {e.actor_name || (e.actor_id ? t('someone') : t('system'))} · {new Date(e.created_at).toLocaleString(locale)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
