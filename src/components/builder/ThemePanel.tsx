'use client';

// Theme/Design panel — replaces the SectionList in the builder's left pane
// when the creator switches to "Design" mode. Consolidates everything that
// used to live on /creator/store under the "Theme", "Branding", "Typography"
// and "Header" cards, plus reuses the ThemeSwitcher template picker.
//
// Edits flow through `onLocalChange` so the live preview updates instantly,
// and through `onSave` (debounced by the parent) to persist to the API.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ChevronDown, Loader2, Palette, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ThemeSwitcher } from '@/components/creator/ThemeSwitcher';
import { ThemeCustomizer, type ThemeTokenCustomizations } from './ThemeCustomizer';
import { findTheme } from '@/lib/themes-catalog';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────

export interface TypographyStyle {
  fontFamily?: string;
  color?: string;
  fontSize?: number;
}

export interface ThemeCustomizations {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  typography?: {
    heading?: TypographyStyle;
    body?: TypographyStyle;
    button?: TypographyStyle;
    link?: TypographyStyle;
    header?: TypographyStyle;
  };
  header?: { showStoreName?: boolean; logoSize?: number };
  // Pass-through (preserved on save so we don't drop unrelated fields).
  [key: string]: unknown;
}

interface ThemePanelProps {
  token: string;
  apiBase: string;
  primaryLocale: string;
  themeKey: string;
  customizations: ThemeCustomizations;
  logoUrl: string;
  faviconUrl: string;
  /** Called on every change so the live preview can react instantly. */
  onLocalChange: (next: { themeKey: string; customizations: ThemeCustomizations; logoUrl: string; faviconUrl: string }) => void;
  /** Persist the customization payload (excluding theme_key — that goes via onApplyTheme). */
  onSaveCustomizations: (customizations: ThemeCustomizations, branding: { logo_url: string; favicon_url: string }) => Promise<void>;
  /** Apply a different template (separate API). */
  onApplyTheme: (themeKey: string) => Promise<void>;
  /** True when the store carries theme overrides (e.g. an imported template). */
  isCustomized?: boolean;
  /** Token-shape theme overrides (colors / fonts) edited via the Customize popup. */
  themeTokens: ThemeTokenCustomizations;
  /** Live-preview callback for token edits. */
  onTokensChange: (next: ThemeTokenCustomizations) => void;
  /** Persist callback for token edits (PUT theme-selection). */
  onTokensSave: (next: ThemeTokenCustomizations) => Promise<void>;
}

const FONT_OPTIONS = [
  'Inter', 'Roboto', 'Poppins', 'Montserrat', 'Playfair Display', 'Lato', 'Open Sans',
  'Cairo', 'Tajawal', 'IBM Plex Sans Arabic', 'Noto Sans', 'Noto Serif', 'Merriweather',
];
const FONT_SELECT_OPTIONS = FONT_OPTIONS.map((f) => ({ value: f, label: f }));

type TypographyKey = 'heading' | 'body' | 'button' | 'link' | 'header';

const TYPOGRAPHY_FIELDS: { key: TypographyKey; label: { en: string; ar: string }; hint: string }[] = [
  { key: 'heading', label: { en: 'Headings', ar: 'العناوين' }, hint: 'h1 / h2 / h3' },
  { key: 'body', label: { en: 'Paragraphs', ar: 'الفقرات' }, hint: 'p / li / span' },
  { key: 'button', label: { en: 'Buttons', ar: 'الأزرار' }, hint: 'button labels' },
  { key: 'link', label: { en: 'Links', ar: 'الروابط' }, hint: 'a tags' },
  { key: 'header', label: { en: 'Header bar', ar: 'الهيدر' }, hint: 'top nav' },
];

// Debounce window for autosave. Long enough to coalesce a flurry of slider
// drags into one request; short enough to feel snappy.
const AUTOSAVE_DEBOUNCE_MS = 700;

// ─────────────────────────────────────────────────────────────

export function ThemePanel({
  token,
  apiBase,
  primaryLocale,
  themeKey,
  customizations,
  logoUrl,
  faviconUrl,
  onLocalChange,
  onSaveCustomizations,
  onApplyTheme,
  isCustomized = false,
  themeTokens,
  onTokensChange,
  onTokensSave,
}: ThemePanelProps) {
  const ar = primaryLocale === 'ar';

  // Controlled component: values live on the parent, we read them as props.
  // The only local UI state is the transient "Saved" tick. Mirroring props
  // into useState here used to cause a setState-in-render warning because
  // every edit synchronously called onLocalChange (parent setState) from
  // inside setC's updater function.
  const [savedTick, setSavedTick] = useState(false);

  // ── Autosave queue ──────────────────────────────────────
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ c: ThemeCustomizations; logo: string; favicon: string } | null>(null);

  const queueSave = useCallback(
    (nextC: ThemeCustomizations, nextLogo: string, nextFavicon: string) => {
      pending.current = { c: nextC, logo: nextLogo, favicon: nextFavicon };
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(async () => {
        const p = pending.current;
        if (!p) return;
        pending.current = null;
        try {
          await onSaveCustomizations(p.c, { logo_url: p.logo, favicon_url: p.favicon });
          setSavedTick(true);
          setTimeout(() => setSavedTick(false), 1500);
        } catch (err) {
          console.error('Theme save failed', err);
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [onSaveCustomizations],
  );

  // Flush on unmount so a quick mode switch doesn't drop the last edit.
  useEffect(() => {
    return () => {
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        if (pending.current) {
          void onSaveCustomizations(pending.current.c, {
            logo_url: pending.current.logo,
            favicon_url: pending.current.favicon,
          });
        }
      }
    };
  }, [onSaveCustomizations]);

  // ── Generic field setters ───────────────────────────────
  // All setters are pure event handlers (run during commit, not render) so
  // it's safe for them to call onLocalChange which updates the parent.

  const c = customizations;
  const logo = logoUrl;
  const favicon = faviconUrl;

  const set = useCallback(
    (patch: Partial<ThemeCustomizations>) => {
      const next = { ...c, ...patch };
      onLocalChange({ themeKey, customizations: next, logoUrl: logo, faviconUrl: favicon });
      queueSave(next, logo, favicon);
    },
    [c, themeKey, logo, favicon, onLocalChange, queueSave],
  );

  const setTypo = useCallback(
    (element: TypographyKey, prop: keyof TypographyStyle, value: TypographyStyle[typeof prop]) => {
      const typo = { ...(c.typography || {}) };
      typo[element] = { ...(typo[element] || {}), [prop]: value };
      const next = { ...c, typography: typo };
      onLocalChange({ themeKey, customizations: next, logoUrl: logo, faviconUrl: favicon });
      queueSave(next, logo, favicon);
    },
    [c, themeKey, logo, favicon, onLocalChange, queueSave],
  );

  const setHeader = useCallback(
    (patch: Partial<NonNullable<ThemeCustomizations['header']>>) => {
      const header = { ...(c.header || {}), ...patch };
      const next = { ...c, header };
      onLocalChange({ themeKey, customizations: next, logoUrl: logo, faviconUrl: favicon });
      queueSave(next, logo, favicon);
    },
    [c, themeKey, logo, favicon, onLocalChange, queueSave],
  );

  const setLogoUrl = useCallback(
    (url: string) => {
      onLocalChange({ themeKey, customizations: c, logoUrl: url, faviconUrl: favicon });
      queueSave(c, url, favicon);
    },
    [themeKey, c, favicon, onLocalChange, queueSave],
  );

  const setFaviconUrl = useCallback(
    (url: string) => {
      onLocalChange({ themeKey, customizations: c, logoUrl: logo, faviconUrl: url });
      queueSave(c, logo, url);
    },
    [themeKey, c, logo, onLocalChange, queueSave],
  );

  // ── Template apply (separate API) ───────────────────────
  const handleApplyTemplate = useCallback(
    async (newKey: string) => {
      await onApplyTheme(newKey);
      // The parent will pass the new themeKey back via prop; the live preview
      // refreshes via the parent's state.
    },
    [onApplyTheme],
  );

  const t = findTheme(themeKey);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* ── Header strip ────────────────────────────────── */}
      <header className="px-3 py-2.5 border-b border-zinc-200/80 bg-linear-to-b from-zinc-50/80 to-white flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 rounded-md bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
            <Palette className="size-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold text-zinc-900 leading-tight">
              {ar ? 'تصميم المتجر' : 'Store design'}
            </div>
            <div className="text-[10px] text-zinc-500 leading-tight">
              {ar ? 'يطبق على كل الصفحات' : 'Applies to every page'}
            </div>
          </div>
        </div>
        {savedTick && (
          <span className="text-[10px] font-medium text-emerald-600 inline-flex items-center gap-1 shrink-0">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {ar ? 'محفوظ' : 'Saved'}
          </span>
        )}
      </header>

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto inspector-scroll p-3 space-y-3">
        {/* ── Template picker ───────────────────────────── */}
        <Group title={ar ? 'القالب' : 'Template'}>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="size-3 rounded-full ring-1 ring-zinc-200" style={{ background: t.swatch.primary }} />
              <span className="size-3 rounded-full ring-1 ring-zinc-200" style={{ background: t.swatch.secondary }} />
              <span className="size-3 rounded-full ring-1 ring-zinc-200" style={{ background: t.swatch.accent }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11.5px] font-medium text-zinc-900 truncate flex items-center gap-1.5">
                {isCustomized ? (ar ? 'مخصّص' : 'Custom') : (t.label[primaryLocale] || t.label.en)}
                {isCustomized && (
                  <span className="text-[8.5px] uppercase tracking-wide px-1 py-px rounded bg-indigo-50 text-indigo-600 font-bold shrink-0">
                    {ar ? 'تيمبليت' : 'Template'}
                  </span>
                )}
              </div>
              <div className="text-[9.5px] text-zinc-500 truncate">
                {isCustomized ? (ar ? `مبني على ${t.label[primaryLocale] || t.label.en}` : `Based on ${t.label.en}`) : t.fontHeading}
              </div>
            </div>
            <ThemeSwitcher
              currentThemeKey={themeKey}
              locale={primaryLocale}
              isCustomized={isCustomized}
              onApply={handleApplyTemplate}
              trigger={
                <Button size="sm" variant="outline" className="h-7 text-[11px] shrink-0">
                  {ar ? 'تغيير' : 'Change'}
                </Button>
              }
            />
          </div>

          {/* Full token-level editor for the theme's palette + fonts (previews live). */}
          <ThemeCustomizer
            locale={primaryLocale}
            value={themeTokens}
            onChange={onTokensChange}
            onSave={onTokensSave}
            trigger={
              <Button size="sm" variant="outline" className="w-full h-8 text-[11px] mt-2 gap-1.5">
                <Palette className="size-3.5" />
                {ar ? 'تخصيص الثيم (ألوان وخطوط)' : 'Customize theme (colors & fonts)'}
              </Button>
            }
          />
        </Group>

        {/* ── Brand override (advanced) ─────────────────── */}
        {/* The theme palette is edited via "Customize theme" above (previews
            live). These are optional hard overrides for the storefront brand
            colour, kept for advanced use. */}
        <Group title={ar ? 'تجاوز لون العلامة (متقدّم)' : 'Brand override (advanced)'} defaultOpen={false}>
          <p className="text-[10px] text-zinc-400 leading-snug mb-1">
            {ar
              ? 'اترك هذه فارغة لاستخدام ألوان الثيم. املأها فقط لفرض لون علامة محدّد.'
              : 'Leave empty to use the theme colors. Fill only to force a specific brand color.'}
          </p>
          <ColorRow
            label={ar ? 'الأساسي' : 'Primary'}
            value={c.primaryColor || ''}
            placeholder="#2563eb"
            onChange={(v) => set({ primaryColor: v })}
          />
          <ColorRow
            label={ar ? 'الثانوي' : 'Secondary'}
            value={c.secondaryColor || ''}
            placeholder="#1e40af"
            onChange={(v) => set({ secondaryColor: v })}
          />
        </Group>

        {/* ── Default font ──────────────────────────────── */}
        <Group title={ar ? 'الخط الافتراضي' : 'Default font'}>
          <SearchableSelect
            value={c.fontFamily || ''}
            onChange={(v) => set({ fontFamily: v })}
            options={FONT_SELECT_OPTIONS}
            placeholder={ar ? 'اختر خط…' : 'Select font…'}
          />
          <p className="text-[10px] text-zinc-400 leading-snug mt-1.5">
            {ar
              ? 'يُستخدم حين لا يكون لعنصر معيّن خط مخصّص أدناه.'
              : 'Used when no per-element font is set below.'}
          </p>
        </Group>

        {/* ── Per-element typography ────────────────────── */}
        <Group title={ar ? 'الخطوط لكل عنصر' : 'Typography'} defaultOpen={false}>
          <div className="space-y-3">
            {TYPOGRAPHY_FIELDS.map(({ key, label, hint }) => {
              const value = c.typography?.[key] || {};
              const previewFont = value.fontFamily || c.fontFamily || 'inherit';
              const previewColor = value.color || '#111827';
              const previewSize = value.fontSize ? `${value.fontSize}px` : '13px';
              return (
                <div key={key} className="rounded-md border border-zinc-200 p-2 space-y-1.5 bg-zinc-50/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11.5px] font-medium text-zinc-800">
                        {label[ar ? 'ar' : 'en']}
                      </div>
                      <div className="text-[9.5px] text-zinc-400">{hint}</div>
                    </div>
                    <span
                      className="text-[12px] truncate ms-2"
                      style={{ fontFamily: previewFont, color: previewColor, fontSize: previewSize }}
                    >
                      Aa
                    </span>
                  </div>
                  <SearchableSelect
                    value={value.fontFamily || ''}
                    onChange={(v) => setTypo(key, 'fontFamily', v)}
                    options={[{ value: '', label: ar ? 'وراثة الخط الافتراضي' : 'Inherit default' }, ...FONT_SELECT_OPTIONS]}
                    placeholder={ar ? 'وراثة' : 'Inherit'}
                  />
                  <div className="grid grid-cols-[1fr_auto] gap-1.5">
                    <ColorRow
                      label=""
                      value={value.color || ''}
                      placeholder={ar ? 'وراثة' : 'inherit'}
                      onChange={(v) => setTypo(key, 'color', v)}
                      compact
                    />
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={8}
                        max={96}
                        step={1}
                        className="h-8 w-16 text-[11px] text-center font-mono"
                        value={value.fontSize ?? ''}
                        placeholder="px"
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') return setTypo(key, 'fontSize', undefined);
                          const n = Number(raw);
                          if (Number.isFinite(n) && n > 0) setTypo(key, 'fontSize', n);
                        }}
                      />
                      {value.fontSize !== undefined && (
                        <button
                          type="button"
                          onClick={() => setTypo(key, 'fontSize', undefined)}
                          className="text-zinc-400 hover:text-zinc-900"
                          title={ar ? 'مسح' : 'Clear'}
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Group>

        {/* ── Header layout ─────────────────────────────── */}
        <Group title={ar ? 'الهيدر' : 'Header'}>
          <div className="flex items-center justify-between min-h-9">
            <span className="text-[11.5px] font-medium text-zinc-700">
              {ar ? 'إظهار اسم المتجر' : 'Show store name'}
            </span>
            <Switch
              checked={c.header?.showStoreName !== false}
              onChange={(b) => setHeader({ showStoreName: b })}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11.5px] font-medium text-zinc-700">
                {ar ? 'حجم الشعار' : 'Logo size'}
              </Label>
              <span className="text-[10.5px] font-mono text-zinc-500">{c.header?.logoSize ?? 32}px</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={16}
                max={96}
                step={1}
                value={c.header?.logoSize ?? 32}
                onChange={(e) => setHeader({ logoSize: Number(e.target.value) })}
                className="flex-1 accent-indigo-600"
              />
              <Input
                type="number"
                min={16}
                max={128}
                className="h-7 w-14 text-[11px] text-center"
                value={c.header?.logoSize ?? 32}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n > 0) setHeader({ logoSize: n });
                }}
              />
            </div>
          </div>
        </Group>

        {/* ── Logo & Favicon ────────────────────────────── */}
        <Group title={ar ? 'الشعار والـ Favicon' : 'Logo & favicon'} defaultOpen={false}>
          <div className="grid grid-cols-2 gap-2">
            <ImageUpload
              token={token}
              apiBase={apiBase}
              folder="logos"
              url={logo}
              onChange={setLogoUrl}
              label={ar ? 'الشعار' : 'Logo'}
            />
            <ImageUpload
              token={token}
              apiBase={apiBase}
              folder="favicons"
              url={favicon}
              onChange={setFaviconUrl}
              label={ar ? 'Favicon' : 'Favicon'}
              square
            />
          </div>
        </Group>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function Group({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-lg border border-zinc-200/80 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-zinc-50/70 hover:bg-zinc-100/70 transition border-b border-zinc-200/60"
      >
        <span className="text-[10.5px] uppercase tracking-[0.12em] font-bold text-zinc-700">
          {title}
        </span>
        <ChevronDown className={cn('size-3.5 text-zinc-400 transition-transform', !open && '-rotate-90')} />
      </button>
      {open && <div className="p-3 space-y-2.5">{children}</div>}
    </section>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-indigo-100',
        checked ? 'bg-indigo-600' : 'bg-zinc-200',
      )}
    >
      <span
        className={cn(
          'inline-block size-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4.5 rtl:-translate-x-4.5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

function ColorRow({
  label,
  value,
  placeholder,
  onChange,
  compact,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'flex items-center gap-1.5' : 'flex items-center justify-between gap-2'}>
      {label && (
        <Label className="text-[11.5px] font-medium text-zinc-700 shrink-0">{label}</Label>
      )}
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-8 cursor-pointer rounded border border-zinc-200 bg-white p-0.5 shrink-0"
        />
        <Input
          className="h-7 w-22 text-[11px] font-mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-zinc-400 hover:text-zinc-900 shrink-0"
            title="Clear"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function ImageUpload({
  token,
  apiBase,
  folder,
  url,
  onChange,
  label,
  square = false,
}: {
  token: string;
  apiBase: string;
  folder: string;
  url: string;
  onChange: (url: string) => void;
  label: string;
  square?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const resolved = url.startsWith('http') ? url : url ? `${apiBase.replace(/\/api$/, '')}${url}` : '';

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${apiBase}/uploads?folder=${folder}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const json = await res.json();
      onChange(json.data?.url || json.url);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-[10.5px] text-zinc-600 font-medium">{label}</Label>
      <label
        className={cn(
          'relative block w-full rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50/50 hover:border-zinc-300 hover:bg-zinc-50 cursor-pointer overflow-hidden group transition',
          square ? 'aspect-square' : 'aspect-4/3',
        )}
      >
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-4 animate-spin text-zinc-400" />
          </div>
        ) : resolved ? (
          <img src={resolved} alt={label} className="absolute inset-0 w-full h-full object-contain p-1.5" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-zinc-400">
            <Camera className="size-4" />
            <span className="text-[10px] font-medium">Upload</span>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
          }}
        />
      </label>
      {url && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-[10px] text-zinc-500 hover:text-red-600 inline-flex items-center gap-1"
        >
          <X className="size-3" /> Remove
        </button>
      )}
    </div>
  );
}
