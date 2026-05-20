'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Loader2, Palette, Sparkles } from 'lucide-react';
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
  /** True when the store has imported a template / has theme overrides. */
  isCustomized?: boolean;
  onApply: (themeKey: string) => Promise<void> | void;
  trigger?: React.ReactNode;
}

// Sentinel value for the "Custom" (imported-template) card.
const CUSTOM = '__custom__';

export function ThemeSwitcher({
  currentThemeKey,
  locale = 'en',
  isCustomized = false,
  onApply,
  trigger,
}: ThemeSwitcherProps) {
  const ar = locale === 'ar';
  const [open, setOpen] = useState(false);
  // When the store is customized, the "Custom" card represents the live look.
  const [selected, setSelected] = useState(isCustomized ? CUSTOM : currentThemeKey);
  const [applying, setApplying] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const reset = () => {
    setSelected(isCustomized ? CUSTOM : currentThemeKey);
    setConfirming(false);
  };

  // Applying a real theme replaces the current look. Confirm first when the
  // store is customized (an imported template / manual overrides would be lost).
  const requestApply = () => {
    if (selected === CUSTOM) return;
    if (selected === currentThemeKey && !isCustomized) {
      setOpen(false);
      return;
    }
    if (isCustomized) {
      setConfirming(true);
      return;
    }
    void doApply();
  };

  const doApply = async () => {
    setApplying(true);
    try {
      await onApply(selected);
      setOpen(false);
      setConfirming(false);
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
        if (o) reset();
      }}
    >
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button variant="outline" size="sm">
              <Palette className="w-3.5 h-3.5 mr-1.5" />
              {ar ? 'تغيير الثيم' : 'Change Theme'}
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{ar ? 'اختر ثيماً' : 'Choose a theme'}</DialogTitle>
          <DialogDescription>
            {ar
              ? 'يطبّق الثيم تخطيطه وألوانه وخطوطه على متجرك. اختيار ثيم جاهز يستبدل تخصيصاتك الحالية.'
              : "Themes apply their layout, colors and typography to your store. Choosing a preset replaces your current customizations."}
          </DialogDescription>
        </DialogHeader>

        {confirming ? (
          // ── Replace confirmation ──────────────────────────
          <div className="py-4 flex flex-col items-center text-center gap-3">
            <div className="w-11 h-11 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1 max-w-md">
              <p className="text-sm font-semibold text-zinc-900">
                {ar ? 'استبدال التخصيص الحالي؟' : 'Replace your current customization?'}
              </p>
              <p className="text-[12.5px] text-muted-foreground leading-snug">
                {ar
                  ? 'متجرك مخصّص حالياً (حسب تيمبليت مستورد أو تعديلاتك). تطبيق هذا الثيم سيستبدل الألوان والخطوط بإعدادات الثيم. لا يؤثر على منتجاتك أو محتوى صفحاتك.'
                  : "Your store is currently customized (from an imported template or your edits). Applying this theme will replace its colors and fonts with the theme's defaults. Your products and page content are not affected."}
              </p>
            </div>
          </div>
        ) : (
          // ── Theme grid ────────────────────────────────────
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-2">
            {isCustomized && (
              <button
                type="button"
                onClick={() => setSelected(CUSTOM)}
                className={cn(
                  'group relative flex flex-col rounded-xl border-2 text-left transition overflow-hidden',
                  selected === CUSTOM ? 'border-zinc-900 ring-2 ring-zinc-900/10' : 'border-zinc-200 hover:border-zinc-400',
                )}
              >
                <div className="h-32 p-3 flex flex-col justify-between bg-linear-to-br from-zinc-50 to-zinc-100">
                  <Sparkles className="w-4 h-4 text-zinc-400" />
                  <div className="text-base font-semibold text-zinc-800 leading-tight">{ar ? 'تصميمك' : 'Your design'}</div>
                </div>
                <div className="p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{ar ? 'مخصّص' : 'Custom'}</span>
                    <span className="text-[10px] uppercase tracking-wide text-emerald-600 font-medium">
                      {ar ? 'الحالي' : 'Current'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {ar ? 'حسب التيمبليت المستورد — عدّله من لوحة التصميم.' : 'From your imported template — edit it in the design panel.'}
                  </p>
                </div>
                {selected === CUSTOM && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </button>
            )}
            {THEME_CATALOG.map((theme) => {
              const isSelected = selected === theme.key;
              const isCurrent = !isCustomized && currentThemeKey === theme.key;
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
                          {ar ? 'الحالي' : 'Current'}
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
        )}

        <DialogFooter>
          {confirming ? (
            <>
              <Button variant="outline" type="button" onClick={() => setConfirming(false)} disabled={applying}>
                {ar ? 'رجوع' : 'Back'}
              </Button>
              <Button type="button" onClick={doApply} disabled={applying}>
                {applying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    {ar ? 'جارٍ التطبيق…' : 'Applying…'}
                  </>
                ) : (
                  ar ? 'استبدال وتطبيق' : 'Replace & apply'
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={applying}>
                {ar ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                type="button"
                onClick={requestApply}
                disabled={applying || selected === CUSTOM || (selected === currentThemeKey && !isCustomized)}
              >
                {applying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    {ar ? 'جارٍ التطبيق…' : 'Applying…'}
                  </>
                ) : (
                  ar ? 'تطبيق الثيم' : 'Apply theme'
                )}
              </Button>
            </>
          )}
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
