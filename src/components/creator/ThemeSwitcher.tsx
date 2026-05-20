'use client';

import { useState } from 'react';
import { Check, Loader2, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { THEME_CATALOG, type ThemeCatalogEntry } from '@/lib/themes-catalog';

interface ThemeSwitcherProps {
  currentThemeKey: string;
  locale?: string;
  onApply: (themeKey: string) => Promise<void> | void;
  trigger?: React.ReactNode;
}

export function ThemeSwitcher({
  currentThemeKey,
  locale = 'en',
  onApply,
  trigger,
}: ThemeSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(currentThemeKey);
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    if (selected === currentThemeKey) {
      setOpen(false);
      return;
    }
    setApplying(true);
    try {
      await onApply(selected);
      setOpen(false);
    } finally {
      setApplying(false);
    }
  };

  const labelOf = (t: ThemeCatalogEntry) => t.label[locale] || t.label.en;
  const descOf = (t: ThemeCatalogEntry) => t.description[locale] || t.description.en;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setSelected(currentThemeKey);
      }}
    >
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button variant="outline" size="sm">
              <Palette className="w-3.5 h-3.5 mr-1.5" />
              Change Theme
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose a theme</DialogTitle>
          <DialogDescription>
            Themes change your storefront layout, default colors, and typography.
            Your color and font overrides are preserved when you switch.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-2">
          {THEME_CATALOG.map((theme) => {
            const isSelected = selected === theme.key;
            const isCurrent = currentThemeKey === theme.key;
            return (
              <button
                key={theme.key}
                type="button"
                onClick={() => setSelected(theme.key)}
                className={cn(
                  'group relative flex flex-col rounded-xl border-2 text-left transition overflow-hidden',
                  isSelected
                    ? 'border-zinc-900 ring-2 ring-zinc-900/10'
                    : 'border-zinc-200 hover:border-zinc-400',
                )}
              >
                <ThemePreview theme={theme} />
                <div className="p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{labelOf(theme)}</span>
                    {isCurrent && (
                      <span className="text-[10px] uppercase tracking-wide text-emerald-600 font-medium">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {descOf(theme)}
                  </p>
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => setOpen(false)}
            disabled={applying}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={applying || selected === currentThemeKey}
          >
            {applying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Applying…
              </>
            ) : (
              'Apply theme'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Mini preview built from the theme's swatch + heading font. Stays self-contained
// so the dashboard doesn't have to load the storefront's section components.
function ThemePreview({ theme }: { theme: ThemeCatalogEntry }) {
  const { primary, secondary, accent, background } = theme.swatch;
  const isDarkBg = isDark(background);
  const text = isDarkBg ? '#ffffff' : '#0f172a';
  return (
    <div
      className="h-32 p-3 flex flex-col justify-between"
      style={{ background, color: text }}
    >
      <div className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: primary }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: secondary }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
      </div>
      <div>
        <div
          className="text-base font-semibold leading-tight"
          style={{ fontFamily: `"${theme.fontHeading}", serif` }}
        >
          Aa Heading
        </div>
        <div
          className="mt-1 inline-block text-[10px] px-2 py-0.5 rounded"
          style={{ background: primary, color: isDark(primary) ? '#fff' : '#000' }}
        >
          Shop now
        </div>
      </div>
    </div>
  );
}

function isDark(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length !== 3 && c.length !== 6) return false;
  const r = parseInt(c.length === 3 ? c[0] + c[0] : c.slice(0, 2), 16);
  const g = parseInt(c.length === 3 ? c[1] + c[1] : c.slice(2, 4), 16);
  const b = parseInt(c.length === 3 ? c[2] + c[2] : c.slice(4, 6), 16);
  // Relative luminance.
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}
