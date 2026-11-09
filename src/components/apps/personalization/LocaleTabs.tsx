'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';

interface LocaleTabsProps {
  primary: string;
  secondary: readonly string[];
  active: string;
  onChange: (locale: string) => void;
  /** Shown after the tabs while a secondary locale is active. */
  hint?: string;
}

/** Store-locale names in the dashboard UI language (code fallback). */
export function useLocaleName() {
  const uiLocale = useLocale();
  return useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([uiLocale], { type: 'language' });
    } catch {
      names = null;
    }
    return (code: string) => {
      try {
        return names?.of(code) ?? code.toUpperCase();
      } catch {
        return code.toUpperCase();
      }
    };
  }, [uiLocale]);
}

/**
 * Store-locale switcher of the per-locale texts (ValueMetaDialog, the card
 * option settings): one tab per content locale, the primary one marked as
 * the default. Renders nothing for a single-locale store.
 */
export function LocaleTabs({ primary, secondary, active, onChange, hint }: LocaleTabsProps) {
  const t = useTranslations('variant.valueMeta');
  const localeName = useLocaleName();
  if (secondary.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-medium text-muted-foreground">{t('textsLocale')}</span>
      <div role="tablist" aria-label={t('textsLocale')} className="inline-flex flex-wrap rounded-md border bg-background p-0.5">
        {[primary, ...secondary].map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={active === l}
            onClick={() => onChange(l)}
            className={`rounded px-2.5 py-1 text-xs transition ${
              active === l ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {localeName(l)}
            {l === primary && <span className="ms-1 opacity-70">({t('primaryLocale')})</span>}
          </button>
        ))}
      </div>
      {hint && active !== primary && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
