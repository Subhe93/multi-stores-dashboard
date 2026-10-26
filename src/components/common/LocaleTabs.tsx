'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// Native language names shown on the tabs (never translated: a merchant
// recognises "Svenska" faster than "Swedish" rendered in another UI locale).
export const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
  tr: 'Türkçe',
  de: 'Deutsch',
  fr: 'Français',
  sv: 'Svenska',
  es: 'Español',
};

export function localeName(code: string): string {
  return LOCALE_NAMES[code] || code.toUpperCase();
}

// Strip tags + collapse whitespace so rich-text base values can be previewed
// inside a placeholder, then truncate with an ellipsis.
export function previewText(value: string | null | undefined, max = 48): string {
  const plain = (value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max).trimEnd()}…`;
}

// Build a "filled" map for LocaleTabs from a per-locale record and a predicate
// deciding whether that locale's entry counts as translated.
export function filledLocales<T>(
  locales: string[],
  data: Record<string, T | undefined>,
  isFilled: (entry: T | undefined) => boolean,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const l of locales) out[l] = isFilled(data[l]);
  return out;
}

// Placeholder for a secondary-locale field: "Translation of: <base value>"
// when the base is filled, otherwise "Translation (<Language>)". Primary
// locale fields keep their own placeholder (passed as `primaryPlaceholder`).
export function useTranslationPlaceholder() {
  const t = useTranslations('common.locale');
  return useCallback(
    (opts: {
      locale: string;
      primaryLocale: string;
      baseValue: string | null | undefined;
      primaryPlaceholder?: string;
      max?: number;
    }): string => {
      const { locale, primaryLocale, baseValue, primaryPlaceholder = '', max } = opts;
      if (locale === primaryLocale) return primaryPlaceholder;
      const preview = previewText(baseValue, max);
      return preview
        ? t('translationOf', { value: preview })
        : t('translationIn', { language: localeName(locale) });
    },
    [t],
  );
}

// Muted chip shown next to a secondary-locale field whose displayed value is
// only the base-language fallback (nothing translated yet).
export function SameAsBaseChip({ className }: { className?: string }) {
  const t = useTranslations('common.locale');
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-dashed border-zinc-300 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500',
        className,
      )}
    >
      {t('sameAsBase')}
    </span>
  );
}

export interface LocaleTabsProps {
  /** Active locale (controlled). */
  value: string;
  onChange: (locale: string) => void;
  /** All content locales; the primary is always rendered first. */
  locales: string[];
  primaryLocale: string;
  /** Translation status per locale: true = filled, false/undefined = empty. */
  filled?: Record<string, boolean>;
  /** Visual style: underline tabs (card headers) or pill group (toolbars). */
  variant?: 'underline' | 'pill';
  /** Show the explanatory hint under the tabs (default true). */
  hint?: boolean;
  /** Render even when only one locale exists (default: hidden). */
  showSingle?: boolean;
  className?: string;
  /** Optional label overrides per locale code. */
  labels?: Record<string, string>;
}

export function LocaleTabs({
  value,
  onChange,
  locales,
  primaryLocale,
  filled,
  variant = 'underline',
  hint = true,
  showSingle = false,
  className,
  labels,
}: LocaleTabsProps) {
  const t = useTranslations('common.locale');
  const ordered = [primaryLocale, ...locales.filter((l) => l && l !== primaryLocale)];
  if (ordered.length <= 1 && !showSingle) return null;

  const nameOf = (code: string) => labels?.[code] || localeName(code);
  const isPill = variant === 'pill';

  return (
    <div className={cn('space-y-2', className)}>
      <div
        role="tablist"
        className={cn(
          'flex items-center',
          isPill ? 'w-fit gap-1 rounded-md bg-zinc-100 p-0.5' : 'gap-0 border-b',
        )}
      >
        {ordered.map((locale) => {
          const isActive = locale === value;
          const isPrimary = locale === primaryLocale;
          const isFilled = !!filled?.[locale];
          return (
            <button
              key={locale}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(locale)}
              title={isPrimary ? undefined : isFilled ? t('translated') : t('notTranslated')}
              className={cn(
                'flex items-center gap-1.5 text-xs font-medium transition',
                isPill
                  ? cn(
                      'rounded px-2.5 py-1 text-[11px]',
                      isActive ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900',
                    )
                  : cn(
                      '-mb-px border-b-2 px-3 py-1.5',
                      isActive ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600',
                    ),
              )}
            >
              <span>{nameOf(locale)}</span>
              <span className="text-zinc-300" aria-hidden>·</span>
              {isPrimary ? (
                <span className="rounded bg-zinc-900 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-white">
                  {t('base')}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-normal text-zinc-400">
                  {t('translation')}
                  <span
                    aria-hidden
                    className={cn(
                      'inline-block size-1.5 rounded-full border',
                      isFilled ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-400 bg-transparent',
                    )}
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {hint && (
        <p className="text-[11px] leading-snug text-zinc-500">
          {t('hint', { language: nameOf(primaryLocale) })}
        </p>
      )}
    </div>
  );
}
