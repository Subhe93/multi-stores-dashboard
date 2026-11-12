'use client';

// Full editor for the store's THEME TOKENS (theme_customizations) — the
// token-shape overrides an imported template populates and that both the live
// preview and the storefront merge onto the active theme. Lets the creator
// fully tune the custom theme's palette and fonts. Edits preview live via
// onChange and persist via onSave (PUT /stores/my/theme-selection).

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Loader2, Palette, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { GOOGLE_FONT_OPTIONS } from '@/lib/google-fonts';
import { CUSTOM_CSS_MAX_LENGTH, customCssOf, isCustomCssTooLong, withCustomCss } from '@/lib/customCss';
import { cn } from '@/lib/utils';

// ── Token shape (subset of the storefront's ThemeTokens we expose) ──
export interface ThemeTokenCustomizations {
  colors?: Partial<Record<ColorKey | TextColorKey, string>>;
  typography?: { fontFamily?: { heading?: string; body?: string } };
  /** Product page: colour swatch shape (storefront `--theme-swatch-radius`). */
  product?: { swatchShape?: SwatchShape };
  /**
   * Store-wide custom CSS (owner content, not a token). The storefront
   * sanitizes it and renders it on every page of the store.
   */
  customCss?: string;
  [key: string]: unknown; // preserve unrelated keys (muted/border…)
}

interface ThemeCustomizerProps {
  locale?: string;
  value: ThemeTokenCustomizations;
  /** Live-preview callback — fired on every edit. */
  onChange: (next: ThemeTokenCustomizations) => void;
  /** Persist callback — fired on Save. */
  onSave: (next: ThemeTokenCustomizations) => Promise<void> | void;
  trigger: React.ReactNode;
}

// Every Google Fonts family, popularity-ordered (shared catalog).
const FONT_OPTIONS = GOOGLE_FONT_OPTIONS;

type ColorKey = 'primary' | 'secondary' | 'accent' | 'background' | 'surface' | 'text';
type SwatchShape = 'circle' | 'square';
// Text-on-colour tokens; empty = automatic on the storefront (readable
// contrast for the *Contrast keys, the primary colour for price).
type TextColorKey = 'primaryContrast' | 'accentContrast' | 'price' | 'priceBg' | 'priceShadow' | 'sale' | 'link';

// Color token keys (used as logic + theme token keys) paired with a default
// placeholder. Human-readable labels come from the translator, keyed by token.
const COLOR_FIELDS: { key: ColorKey; placeholder: string }[] = [
  { key: 'primary', placeholder: '#2563eb' },
  { key: 'secondary', placeholder: '#1e40af' },
  { key: 'accent', placeholder: '#f59e0b' },
  { key: 'background', placeholder: '#ffffff' },
  { key: 'surface', placeholder: '#f5f5f5' },
  { key: 'text', placeholder: '#111827' },
];

const TEXT_COLOR_FIELDS: { key: TextColorKey; placeholderKey: 'color.auto' | 'color.priceAuto' | 'color.linkAuto' | 'color.none' | 'color.saleAuto' }[] = [
  { key: 'primaryContrast', placeholderKey: 'color.auto' },
  { key: 'accentContrast', placeholderKey: 'color.auto' },
  { key: 'price', placeholderKey: 'color.priceAuto' },
  { key: 'priceBg', placeholderKey: 'color.none' },
  { key: 'priceShadow', placeholderKey: 'color.none' },
  { key: 'sale', placeholderKey: 'color.saleAuto' },
  { key: 'link', placeholderKey: 'color.linkAuto' },
];

export function ThemeCustomizer({ locale = 'en', value, onChange, onSave, trigger }: ThemeCustomizerProps) {
  // `locale` is the store-content locale (kept for callers); chrome text below
  // is translated via the dashboard UI locale.
  void locale;
  const t = useTranslations('builder');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ThemeTokenCustomizations>(value);
  const [saving, setSaving] = useState(false);
  // Custom CSS section: collapsed until opened, or open when CSS already exists.
  const [cssOpen, setCssOpen] = useState(false);

  const apply = (next: ThemeTokenCustomizations) => {
    setDraft(next);
    onChange(next); // live preview
  };

  const setColor = (key: ColorKey | TextColorKey, v: string) => {
    const colors = { ...(draft.colors || {}) };
    if (v) colors[key] = v;
    else delete colors[key];
    apply({ ...draft, colors });
  };

  const setFont = (key: 'heading' | 'body', v: string) => {
    const fontFamily = { ...(draft.typography?.fontFamily || {}) };
    if (v) fontFamily[key] = v;
    else delete fontFamily[key];
    apply({ ...draft, typography: { ...draft.typography, fontFamily } });
  };

  const setSwatchShape = (v: string) => {
    const product = { ...(draft.product || {}) };
    if (v === 'circle' || v === 'square') product.swatchShape = v;
    else delete product.swatchShape;
    if (Object.keys(product).length) apply({ ...draft, product });
    else {
      const next = { ...draft };
      delete next.product;
      apply(next);
    }
  };

  // Blank text deletes the key (same idea as setSwatchShape).
  const setCustomCss = (v: string) => apply(withCustomCss(draft, v));

  const customCss = customCssOf(draft);
  const cssTooLong = isCustomCssTooLong(customCss);

  // Resets the look tokens only: the custom CSS is owner content and stays.
  const handleReset = () => apply(withCustomCss({}, customCss));

  const handleSave = async () => {
    // Over the cap: the message under the field explains what to do.
    if (cssTooLong) {
      setCssOpen(true);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    onChange(value); // revert the live preview to the persisted value
    setDraft(value);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setDraft(value);
          setCssOpen(customCssOf(value) !== '');
        }
        else onChange(value); // closing via overlay/esc reverts unsaved preview
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            {t('customizeTheme')}
          </DialogTitle>
          <DialogDescription>
            {t('customizeThemeDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1 max-h-[60vh] overflow-y-auto">
          {/* Colors */}
          <section className="space-y-2">
            <div className="text-[10.5px] uppercase tracking-[0.12em] font-bold text-zinc-500">
              {t('colors')}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {COLOR_FIELDS.map((f) => (
                <ColorField
                  key={f.key}
                  label={t(`color.${f.key}`)}
                  value={draft.colors?.[f.key] || ''}
                  placeholder={f.placeholder}
                  onChange={(v) => setColor(f.key, v)}
                />
              ))}
            </div>
          </section>

          {/* Text on colours (empty = automatic) */}
          <section className="space-y-2">
            <div className="text-[10.5px] uppercase tracking-[0.12em] font-bold text-zinc-500">
              {t('textColors')}
            </div>
            <p className="text-[11px] text-zinc-500">{t('textColorsHint')}</p>
            <div className="grid grid-cols-2 gap-2.5">
              {TEXT_COLOR_FIELDS.map((f) => (
                <ColorField
                  key={f.key}
                  label={t(`color.${f.key}`)}
                  value={draft.colors?.[f.key] || ''}
                  placeholder={t(f.placeholderKey)}
                  onChange={(v) => setColor(f.key, v)}
                />
              ))}
            </div>
          </section>

          {/* Fonts */}
          <section className="space-y-2">
            <div className="text-[10.5px] uppercase tracking-[0.12em] font-bold text-zinc-500">
              {t('fonts')}
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-[11.5px] text-zinc-700">{t('headingFont')}</Label>
                <SearchableSelect
                  value={draft.typography?.fontFamily?.heading || ''}
                  onChange={(v) => setFont('heading', v)}
                  options={[{ value: '', label: t('themeDefault') }, ...FONT_OPTIONS]}
                  placeholder={t('themeDefault')}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11.5px] text-zinc-700">{t('bodyFont')}</Label>
                <SearchableSelect
                  value={draft.typography?.fontFamily?.body || ''}
                  onChange={(v) => setFont('body', v)}
                  options={[{ value: '', label: t('themeDefault') }, ...FONT_OPTIONS]}
                  placeholder={t('themeDefault')}
                />
              </div>
            </div>
          </section>

          {/* Product page controls */}
          <section className="space-y-2">
            <div className="text-[10.5px] uppercase tracking-[0.12em] font-bold text-zinc-500">
              {t('productPage')}
            </div>
            <div className="space-y-1">
              <Label className="text-[11.5px] text-zinc-700">{t('swatchShape')}</Label>
              <SearchableSelect
                value={draft.product?.swatchShape || ''}
                onChange={setSwatchShape}
                options={[
                  { value: '', label: t('themeDefault') },
                  { value: 'circle', label: t('swatchCircle') },
                  { value: 'square', label: t('swatchSquare') },
                ]}
                placeholder={t('themeDefault')}
              />
              <p className="text-[11px] text-zinc-500">{t('swatchShapeHint')}</p>
            </div>
          </section>

          {/* Store-wide custom CSS (collapsible, advanced) */}
          <section className="space-y-2">
            <button
              type="button"
              onClick={() => setCssOpen((o) => !o)}
              aria-expanded={cssOpen}
              aria-controls="theme-custom-css"
              className="flex w-full items-center justify-between gap-2 text-[10.5px] uppercase tracking-[0.12em] font-bold text-zinc-500 hover:text-zinc-800"
            >
              <span>{t('customCss')}</span>
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', cssOpen && 'rotate-180')} />
            </button>
            {cssOpen && (
              <div id="theme-custom-css" className="space-y-1">
                <p className="text-[11px] text-zinc-500">{t('customCssHint')}</p>
                {/* Code is always left-to-right, also in an RTL dashboard. */}
                <textarea
                  dir="ltr"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  rows={8}
                  value={customCss}
                  onChange={(e) => setCustomCss(e.target.value)}
                  placeholder={'.store-root h1 {\n  letter-spacing: 0.02em;\n}'}
                  aria-label={t('customCss')}
                  aria-invalid={cssTooLong}
                  aria-describedby="theme-custom-css-count"
                  className={cn(
                    'block w-full resize-y rounded-md border bg-white px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-left text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:ring-2',
                    cssTooLong
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-zinc-200 focus:border-indigo-500 focus:ring-indigo-500/20',
                  )}
                />
                <div className="flex items-start justify-between gap-3">
                  <p className={cn('text-[11px]', cssTooLong ? 'text-red-600' : 'text-zinc-500')} role={cssTooLong ? 'alert' : undefined}>
                    {cssTooLong
                      ? t('customCssTooLong', { max: CUSTOM_CSS_MAX_LENGTH, over: customCss.length - CUSTOM_CSS_MAX_LENGTH })
                      : t('customCssEmptyHint')}
                  </p>
                  <span
                    id="theme-custom-css-count"
                    dir="ltr"
                    className={cn('shrink-0 font-mono text-[11px] tabular-nums', cssTooLong ? 'text-red-600 font-semibold' : 'text-zinc-400')}
                  >
                    {customCss.length} / {CUSTOM_CSS_MAX_LENGTH}
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="text-zinc-500">
            <RotateCcw className="w-3.5 h-3.5 me-1.5" />
            {t('resetToTheme')}
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
              {tc('cancel')}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || cssTooLong}>
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" />
                  {tc('saving')}
                </>
              ) : (
                tc('save')
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColorField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations('builder');
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-zinc-600">{label}</Label>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-8 cursor-pointer rounded border border-zinc-200 bg-white p-0.5 shrink-0"
        />
        <Input
          className="h-7 flex-1 text-[11px] font-mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {value && (
          <button type="button" onClick={() => onChange('')} className="text-zinc-400 hover:text-zinc-900 shrink-0" title={t('clear')}>
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
