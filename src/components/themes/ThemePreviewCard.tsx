'use client';

import { useTranslations } from 'next-intl';
import type { ThemePresetSummary } from '@/lib/themes';

interface ThemePreviewCardProps {
  preset: ThemePresetSummary;
  /** Localized preset name, used for the accessible label. */
  label: string;
}

// Font stacks are quoted and given a generic fallback so the mock degrades
// gracefully without loading Google Fonts.
function fontStack(name: string): string {
  const generic = /serif|garamond|playfair|lora|merriweather|georgia/i.test(name) && !/sans/i.test(name)
    ? 'serif'
    : 'sans-serif';
  return `'${name.replace(/'/g, '')}', ${generic}`;
}

/**
 * Pure-CSS mock of a storefront painted with the preset's swatch, fonts and
 * chrome flags. No real content is shown — just abstract lines and blocks.
 */
export function ThemePreviewCard({ preset, label }: ThemePreviewCardProps) {
  const t = useTranslations('creator.themes');
  const { swatch, fonts, chrome } = preset;
  const footerBg = chrome.footer_columns ? swatch.text : swatch.secondary;

  return (
    <div className="space-y-2">
      <div
        role="img"
        aria-label={label}
        className="flex aspect-[4/3] w-full flex-col overflow-hidden rounded-lg border border-zinc-200"
        style={{ backgroundColor: swatch.background }}
      >
        {/* Announcement strip */}
        {chrome.announcement_bar && (
          <div className="flex h-[5%] items-center justify-center" style={{ backgroundColor: swatch.accent }}>
            <span className="h-[2px] w-1/3 rounded-full bg-white/70" />
          </div>
        )}

        {/* Header bar */}
        <div
          className="flex h-[11%] items-center gap-2 px-3"
          style={{ backgroundColor: swatch.background, borderBottom: `1px solid ${swatch.text}1a` }}
        >
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: swatch.primary }} />
          <div className="ms-1 flex flex-1 items-center gap-1.5">
            <span className="h-[2px] w-[12%] rounded-full" style={{ backgroundColor: swatch.text }} />
            <span className="h-[2px] w-[9%] rounded-full" style={{ backgroundColor: swatch.text }} />
            <span className="h-[2px] w-[11%] rounded-full" style={{ backgroundColor: swatch.text }} />
          </div>
          <span className="size-1.5 rounded-full opacity-70" style={{ backgroundColor: swatch.text }} />
          <span className="size-1.5 rounded-full opacity-70" style={{ backgroundColor: swatch.text }} />
        </div>

        {/* Hero */}
        <div className="flex flex-1 flex-col justify-center gap-1.5 px-3 py-2" style={{ backgroundColor: swatch.surface }}>
          <span
            className="block truncate text-[11px] font-semibold leading-none"
            style={{ color: swatch.text, fontFamily: fontStack(fonts.heading) }}
          >
            Aa
          </span>
          <span className="h-[3px] w-3/5 rounded-full" style={{ backgroundColor: swatch.text }} />
          <span className="h-[2px] w-4/5 rounded-full opacity-50" style={{ backgroundColor: swatch.text }} />
          <span className="h-[2px] w-2/3 rounded-full opacity-50" style={{ backgroundColor: swatch.text }} />
          <span
            className="mt-1 inline-flex h-3 w-[28%] items-center justify-center rounded-sm"
            style={{ backgroundColor: swatch.primary }}
          >
            <span className="h-[2px] w-1/2 rounded-full bg-white/90" />
          </span>
        </div>

        {/* Product tiles */}
        <div className="grid h-[24%] grid-cols-2 gap-2 px-3 py-1.5" style={{ backgroundColor: swatch.background }}>
          {[0, 1].map((i) => (
            <div key={i} className="flex min-h-0 flex-col gap-1">
              <div className="min-h-0 flex-1 rounded-sm" style={{ backgroundColor: swatch.surface, border: `1px solid ${swatch.text}14` }} />
              <span className="h-[2px] w-3/4 rounded-full" style={{ backgroundColor: swatch.text }} />
              <span className="h-[2px] w-1/3 rounded-full" style={{ backgroundColor: swatch.accent }} />
            </div>
          ))}
        </div>

        {/* Footer strip */}
        <div className="flex h-[13%] items-center gap-3 px-3" style={{ backgroundColor: footerBg }}>
          {(chrome.footer_columns ? [0, 1, 2] : [0]).map((i) => (
            <div key={i} className="flex flex-1 flex-col gap-1">
              <span className="h-[2px] w-2/3 rounded-full bg-white/50" />
              <span className="h-[2px] w-1/2 rounded-full bg-white/25" />
            </div>
          ))}
          {chrome.social_icons && (
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-1.5 rounded-full bg-white/60" />
              ))}
            </div>
          )}
          {chrome.payment_icons && (
            <div className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-2.5 rounded-[1px] bg-white/40" />
              ))}
            </div>
          )}
        </div>

        {/* Mobile bottom nav */}
        {chrome.mobile_bottom_nav && (
          <div
            className="flex h-[6%] items-center justify-around"
            style={{ backgroundColor: swatch.background, borderTop: `1px solid ${swatch.text}1a` }}
          >
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="size-1.5 rounded-full"
                style={{ backgroundColor: i === 0 ? swatch.primary : swatch.text, opacity: i === 0 ? 1 : 0.4 }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Font names (not loaded — just labelled) */}
      <p className="truncate text-[11px] text-muted-foreground">
        <span className="font-medium text-zinc-700">{t('headingFont')}:</span> {fonts.heading}
        <span className="mx-1.5 text-zinc-300">·</span>
        <span className="font-medium text-zinc-700">{t('bodyFont')}:</span> {fonts.body}
      </p>
    </div>
  );
}
