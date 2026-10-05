'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import type { ThemePresetChrome, ThemePresetSummary } from '@/lib/themes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThemePreviewCard } from './ThemePreviewCard';

type LocalizedString = Record<string, string>;

export function loc(s: LocalizedString | undefined, primary: string): string {
  if (!s) return '';
  return s[primary] || s.en || Object.values(s)[0] || '';
}

// Chrome flags shown as chips, in display order. `footer_columns` is a layout
// detail already visible in the mock, so it is not listed as a feature.
const CHIP_FLAGS: Array<{ key: keyof ThemePresetChrome; label: 'announcement' | 'sticky' | 'mega' | 'bottomNav' | 'social' | 'payment' }> = [
  { key: 'announcement_bar', label: 'announcement' },
  { key: 'sticky_header', label: 'sticky' },
  { key: 'mega_menu', label: 'mega' },
  { key: 'mobile_bottom_nav', label: 'bottomNav' },
  { key: 'social_icons', label: 'social' },
  { key: 'payment_icons', label: 'payment' },
];

const SWATCH_KEYS = ['primary', 'secondary', 'accent', 'background', 'surface', 'text'] as const;

interface ThemeCardProps {
  preset: ThemePresetSummary;
  primaryLocale: string;
  isCurrent: boolean;
  onApply: (preset: ThemePresetSummary) => void;
}

export function ThemeCard({ preset, primaryLocale, isCurrent, onApply }: ThemeCardProps) {
  const t = useTranslations('creator.themes');
  const name = loc(preset.name, primaryLocale);
  const description = loc(preset.description, primaryLocale);
  const chips = CHIP_FLAGS.filter((f) => preset.chrome[f.key]);

  return (
    <Card className={`overflow-hidden shadow-none transition hover:shadow-md ${isCurrent ? 'ring-2 ring-indigo-500/60' : ''}`}>
      <CardContent className="space-y-3 p-4">
        <ThemePreviewCard preset={preset} label={name} />

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{name}</h3>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed line-clamp-3">{description}</p>
            )}
          </div>
          {isCurrent && (
            <Badge className="shrink-0 bg-indigo-600 text-white">
              <Check />
              {t('current')}
            </Badge>
          )}
        </div>

        {/* Swatch dots */}
        <div className="flex items-center gap-1.5">
          {SWATCH_KEYS.map((key) => (
            <span
              key={key}
              title={`${key}: ${preset.swatch[key]}`}
              className="size-4 rounded-full border border-black/10"
              style={{ backgroundColor: preset.swatch[key] }}
            />
          ))}
        </div>

        {/* Chrome feature chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <Badge key={chip.key} variant="outline" className="text-[10px] font-normal">
                {t(`chips.${chip.label}`)}
              </Badge>
            ))}
          </div>
        )}

        {preset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {preset.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <Button size="sm" className="w-full" disabled={isCurrent} onClick={() => onApply(preset)}>
          {isCurrent ? t('current') : t('apply')}
        </Button>
      </CardContent>
    </Card>
  );
}
