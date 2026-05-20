'use client';

// Full editor for the store's THEME TOKENS (theme_customizations) — the
// token-shape overrides an imported template populates and that both the live
// preview and the storefront merge onto the active theme. Lets the creator
// fully tune the custom theme's palette and fonts. Edits preview live via
// onChange and persist via onSave (PUT /stores/my/theme-selection).

import { useState } from 'react';
import { Loader2, Palette, RotateCcw, X } from 'lucide-react';
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

// ── Token shape (subset of the storefront's ThemeTokens we expose) ──
export interface ThemeTokenCustomizations {
  colors?: Partial<Record<'primary' | 'secondary' | 'accent' | 'background' | 'surface' | 'text', string>>;
  typography?: { fontFamily?: { heading?: string; body?: string } };
  [key: string]: unknown; // preserve unrelated keys (muted/border/primaryContrast…)
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

const FONT_OPTIONS = [
  'Inter', 'Roboto', 'Poppins', 'Montserrat', 'Playfair Display', 'Lato', 'Open Sans',
  'Cairo', 'Tajawal', 'IBM Plex Sans Arabic', 'Noto Sans', 'Noto Serif', 'Merriweather',
].map((f) => ({ value: f, label: f }));

type ColorKey = 'primary' | 'secondary' | 'accent' | 'background' | 'surface' | 'text';

const COLOR_FIELDS: { key: ColorKey; en: string; ar: string; placeholder: string }[] = [
  { key: 'primary', en: 'Primary', ar: 'الأساسي', placeholder: '#2563eb' },
  { key: 'secondary', en: 'Secondary', ar: 'الثانوي', placeholder: '#1e40af' },
  { key: 'accent', en: 'Accent', ar: 'التمييز', placeholder: '#f59e0b' },
  { key: 'background', en: 'Background', ar: 'الخلفية', placeholder: '#ffffff' },
  { key: 'surface', en: 'Surface', ar: 'السطح', placeholder: '#f5f5f5' },
  { key: 'text', en: 'Text', ar: 'النص', placeholder: '#111827' },
];

export function ThemeCustomizer({ locale = 'en', value, onChange, onSave, trigger }: ThemeCustomizerProps) {
  const ar = locale === 'ar';
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ThemeTokenCustomizations>(value);
  const [saving, setSaving] = useState(false);

  const apply = (next: ThemeTokenCustomizations) => {
    setDraft(next);
    onChange(next); // live preview
  };

  const setColor = (key: ColorKey, v: string) => {
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

  const handleReset = () => apply({});

  const handleSave = async () => {
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
        if (o) setDraft(value);
        else onChange(value); // closing via overlay/esc reverts unsaved preview
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            {ar ? 'تخصيص الثيم' : 'Customize theme'}
          </DialogTitle>
          <DialogDescription>
            {ar
              ? 'عدّل ألوان وخطوط ثيم متجرك. تظهر التغييرات في المعاينة فوراً.'
              : "Tune your store theme's colors and fonts. Changes preview instantly."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1 max-h-[60vh] overflow-y-auto">
          {/* Colors */}
          <section className="space-y-2">
            <div className="text-[10.5px] uppercase tracking-[0.12em] font-bold text-zinc-500">
              {ar ? 'الألوان' : 'Colors'}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {COLOR_FIELDS.map((f) => (
                <ColorField
                  key={f.key}
                  label={ar ? f.ar : f.en}
                  value={draft.colors?.[f.key] || ''}
                  placeholder={f.placeholder}
                  onChange={(v) => setColor(f.key, v)}
                />
              ))}
            </div>
          </section>

          {/* Fonts */}
          <section className="space-y-2">
            <div className="text-[10.5px] uppercase tracking-[0.12em] font-bold text-zinc-500">
              {ar ? 'الخطوط' : 'Fonts'}
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-[11.5px] text-zinc-700">{ar ? 'خط العناوين' : 'Heading font'}</Label>
                <SearchableSelect
                  value={draft.typography?.fontFamily?.heading || ''}
                  onChange={(v) => setFont('heading', v)}
                  options={[{ value: '', label: ar ? 'افتراضي الثيم' : 'Theme default' }, ...FONT_OPTIONS]}
                  placeholder={ar ? 'افتراضي الثيم' : 'Theme default'}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11.5px] text-zinc-700">{ar ? 'خط النص' : 'Body font'}</Label>
                <SearchableSelect
                  value={draft.typography?.fontFamily?.body || ''}
                  onChange={(v) => setFont('body', v)}
                  options={[{ value: '', label: ar ? 'افتراضي الثيم' : 'Theme default' }, ...FONT_OPTIONS]}
                  placeholder={ar ? 'افتراضي الثيم' : 'Theme default'}
                />
              </div>
            </div>
          </section>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="text-zinc-500">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            {ar ? 'إعادة لإعدادات الثيم' : 'Reset to theme'}
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
              {ar ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  {ar ? 'جارٍ الحفظ…' : 'Saving…'}
                </>
              ) : (
                ar ? 'حفظ' : 'Save'
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
          <button type="button" onClick={() => onChange('')} className="text-zinc-400 hover:text-zinc-900 shrink-0" title="Clear">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
