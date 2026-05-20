'use client';

import { useState } from 'react';
import { Link2, Link2Off, Monitor, RotateCcw, Smartphone, Tablet } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ImageField } from './fields/FieldRenderer';

// Mirror of multi-stores-web/src/themes/sectionStyle.ts — kept in sync manually
// so the dashboard can type the form correctly without crossing app boundaries.
export type SpaceToken = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SpaceValue = SpaceToken | number;       // token OR raw pixels
export type WidthToken = 'full' | 'container' | 'narrow';
export type RadiusToken = 'none' | 'sm' | 'md' | 'lg';
export type BackgroundToken = 'transparent' | 'surface' | 'primary' | 'accent' | 'custom' | 'image';
export type Breakpoint = 'desktop' | 'tablet' | 'mobile';
export type AnimateToken = 'none' | 'fade-up' | 'fade-in';

export type Responsive<T> = T | Partial<Record<Breakpoint, T>>;

export interface SidesSpacing {
  top?: SpaceValue;
  right?: SpaceValue;
  bottom?: SpaceValue;
  left?: SpaceValue;
}

export interface SectionStyle {
  padding?: Responsive<SidesSpacing>;
  margin?: Responsive<SidesSpacing>;
  width?: Responsive<WidthToken>;
  radius?: Responsive<RadiusToken>;
  background?: Responsive<BackgroundToken>;
  background_color?: Responsive<string>;
  // Background image + overlay (flat, applies to every breakpoint that selects
  // the 'image' background). Mirrors multi-stores-web/src/themes/sectionStyle.ts.
  background_image?: string;
  background_overlay_color?: string;
  background_overlay_opacity?: number; // 0–100
  text_color?: Responsive<string>;
  animate?: AnimateToken;
  hide_on?: Breakpoint[];
  // Legacy fields kept here for the type, so older _style payloads pass through
  // unchanged. The storefront resolver reads them; the panel no longer writes.
  padding_top?: Responsive<SpaceToken>;
  padding_bottom?: Responsive<SpaceToken>;
  margin_top?: Responsive<SpaceToken>;
  margin_bottom?: Responsive<SpaceToken>;
}

interface StylePanelProps {
  value: SectionStyle | undefined;
  onChange: (next: SectionStyle) => void;
  locale: string;
  token: string;
  apiBase: string;
}

const SPACE_TOKEN_PX: Record<SpaceToken, number> = {
  none: 0, xs: 8, sm: 16, md: 32, lg: 64, xl: 96,
};

const SPACE_OPTIONS: { v: SpaceToken; label: string }[] = [
  { v: 'none', label: '0' },
  { v: 'xs', label: 'XS' },
  { v: 'sm', label: 'S' },
  { v: 'md', label: 'M' },
  { v: 'lg', label: 'L' },
  { v: 'xl', label: 'XL' },
];

function spaceValueToPx(v: SpaceValue | undefined): number | '' {
  if (v === undefined) return '';
  return typeof v === 'number' ? v : SPACE_TOKEN_PX[v];
}

// ── Responsive value helpers ───────────────────────────────────────────

function pickResponsive<T>(field: Responsive<T> | undefined, bp: Breakpoint): T | undefined {
  if (field === undefined) return undefined;
  if (typeof field === 'object' && field !== null && !Array.isArray(field)) {
    return (field as Partial<Record<Breakpoint, T>>)[bp];
  }
  return bp === 'desktop' ? (field as T) : undefined;
}

// Cascade: mobile inherits from tablet inherits from desktop. Use when the
// panel needs to show what the user *will see* at the active breakpoint.
function resolveResponsive<T>(field: Responsive<T> | undefined, bp: Breakpoint): T | undefined {
  if (bp === 'mobile') {
    return pickResponsive(field, 'mobile')
      ?? pickResponsive(field, 'tablet')
      ?? pickResponsive(field, 'desktop');
  }
  if (bp === 'tablet') {
    return pickResponsive(field, 'tablet') ?? pickResponsive(field, 'desktop');
  }
  return pickResponsive(field, 'desktop');
}

function setResponsive<T>(
  field: Responsive<T> | undefined,
  bp: Breakpoint,
  val: T | undefined,
): Responsive<T> | undefined {
  let obj: Partial<Record<Breakpoint, T>>;
  if (field === undefined) {
    obj = {};
  } else if (typeof field === 'object' && field !== null && !Array.isArray(field)) {
    obj = { ...(field as Partial<Record<Breakpoint, T>>) };
  } else {
    obj = { desktop: field as T };
  }
  if (val === undefined) delete obj[bp];
  else obj[bp] = val;
  const keys = Object.keys(obj);
  if (keys.length === 0) return undefined;
  // Collapse to a bare value when only desktop is set — matches the legacy
  // shape so older readers stay happy.
  if (keys.length === 1 && obj.desktop !== undefined) return obj.desktop;
  return obj;
}

function hasOwnResponsive<T>(field: Responsive<T> | undefined, bp: Breakpoint): boolean {
  return pickResponsive(field, bp) !== undefined;
}

function inheritedSource<T>(field: Responsive<T> | undefined, bp: Breakpoint): Breakpoint | null {
  if (hasOwnResponsive(field, bp)) return null;
  if (bp === 'mobile' && hasOwnResponsive(field, 'tablet')) return 'tablet';
  if ((bp === 'mobile' || bp === 'tablet') && hasOwnResponsive(field, 'desktop')) return 'desktop';
  return null;
}

// ── SidesSpacing helpers (per side, per breakpoint cascade) ────────────

function pickSidesAt(field: Responsive<SidesSpacing> | undefined, bp: Breakpoint): SidesSpacing | undefined {
  const v = pickResponsive(field, bp);
  return v;
}

function resolveSidesAt(field: Responsive<SidesSpacing> | undefined, bp: Breakpoint): SidesSpacing {
  // Per-side cascade: each side independently falls back to the wider breakpoint.
  const sides: SidesSpacing = {};
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    sides[side] = resolveSideAt(field, side, bp);
  }
  return sides;
}

function resolveSideAt(
  field: Responsive<SidesSpacing> | undefined,
  side: 'top' | 'right' | 'bottom' | 'left',
  bp: Breakpoint,
): SpaceValue | undefined {
  const chain: Breakpoint[] =
    bp === 'mobile' ? ['mobile', 'tablet', 'desktop']
    : bp === 'tablet' ? ['tablet', 'desktop']
    : ['desktop'];
  for (const b of chain) {
    const s = pickResponsive(field, b);
    if (s && s[side] !== undefined) return s[side];
  }
  return undefined;
}

// ── Component ───────────────────────────────────────────────────────────

export function StylePanel({ value, onChange, locale, token, apiBase }: StylePanelProps) {
  const v = value || {};
  const ar = locale === 'ar';
  const [device, setDevice] = useState<Breakpoint>('desktop');

  const t = {
    layout: ar ? 'التخطيط' : 'Layout',
    background: ar ? 'الخلفية' : 'Background',
    spacing: ar ? 'المسافات' : 'Spacing',
    animation: ar ? 'الحركة' : 'Animation',
    visibility: ar ? 'الظهور' : 'Visibility',
    width: ar ? 'العرض' : 'Width',
    radius: ar ? 'الزوايا' : 'Corner radius',
    textColor: ar ? 'لون النص' : 'Text color',
    customColor: ar ? 'لون مخصص' : 'Custom color',
    padding: ar ? 'الحشو الداخلي (Padding)' : 'Padding',
    margin: ar ? 'الهامش الخارجي (Margin)' : 'Margin',
    reset: ar ? 'استعادة' : 'Reset',
    full: ar ? 'كامل' : 'Full bleed',
    container: ar ? 'الحاوية' : 'Container',
    narrow: ar ? 'ضيّق' : 'Narrow',
    none: ar ? 'بدون' : 'None',
    transparent: ar ? 'شفاف' : 'Transparent',
    surface: ar ? 'سطح الثيم' : 'Theme surface',
    primary: ar ? 'الأساسي' : 'Primary',
    accent: ar ? 'التمييز' : 'Accent',
    custom: ar ? 'مخصص' : 'Custom',
    image: ar ? 'صورة' : 'Image',
    backgroundImage: ar ? 'صورة الخلفية' : 'Background image',
    overlayColor: ar ? 'لون الطبقة' : 'Overlay color',
    overlayOpacity: ar ? 'شفافية الطبقة' : 'Overlay opacity',
    imageAllDevices: ar
      ? 'الصورة والطبقة تنطبق على كل الأجهزة.'
      : 'Image and overlay apply to all devices.',
    noAnimation: ar ? 'بدون' : 'None',
    fadeIn: ar ? 'تلاشٍ' : 'Fade in',
    fadeUp: ar ? 'تلاشٍ + صعود' : 'Fade up',
    inheritText: ar ? 'من الثيم' : 'From theme',
    desktop: ar ? 'سطح المكتب' : 'Desktop',
    tablet: ar ? 'تابلت' : 'Tablet',
    mobile: ar ? 'جوال' : 'Mobile',
    inherits: ar ? 'موروث من' : 'Inherits from',
    clearForDevice: ar ? 'إزالة لهذا الجهاز' : 'Clear for this device',
    hideOn: ar ? 'إخفاء على' : 'Hide on',
    hideHint: ar
      ? 'يُخفي السكشن تماماً على الأجهزة المحددة.'
      : 'Section is removed from view on the selected devices.',
    responsiveHint: ar
      ? 'حرر كل جهاز على حدة. الأصغر يرث من الأكبر.'
      : 'Edit each device independently. Smaller inherits from larger.',
    link: ar ? 'ربط الجهات' : 'Link sides',
    unlink: ar ? 'فك الربط' : 'Unlink sides',
    sideTop: ar ? 'أعلى' : 'Top',
    sideRight: ar ? 'يمين' : 'Right',
    sideBottom: ar ? 'أسفل' : 'Bottom',
    sideLeft: ar ? 'يسار' : 'Left',
    presets: ar ? 'تعبئة سريعة' : 'Quick fill',
  };

  // Generic responsive setter — writes to the active breakpoint. We accept
  // `unknown` here because each caller already knows the value type for the
  // specific key; a stricter generic chases the Responsive<T> conditional in
  // ways TypeScript's inference can't follow cleanly.
  function setR(key: keyof SectionStyle, val: unknown) {
    const current = v[key] as Responsive<unknown> | undefined;
    const next = setResponsive(current, device, val);
    onChange({ ...v, [key]: next as never });
  }

  // Clear the override for active breakpoint on a responsive field.
  function clearR(key: keyof SectionStyle) {
    const current = v[key] as Responsive<unknown> | undefined;
    const next = setResponsive(current, device, undefined);
    onChange({ ...v, [key]: next as never });
  }

  // Non-responsive setter (animate).
  function setFlat<K extends keyof SectionStyle>(key: K, val: SectionStyle[K]) {
    onChange({ ...v, [key]: val });
  }

  // SidesSpacing setter for a single side at active breakpoint.
  function setSide(
    key: 'padding' | 'margin',
    side: 'top' | 'right' | 'bottom' | 'left',
    val: SpaceValue | undefined,
  ) {
    const currentField = v[key];
    const currentAtBp = pickSidesAt(currentField, device) || {};
    const nextAtBp: SidesSpacing = { ...currentAtBp };
    if (val === undefined) delete nextAtBp[side];
    else nextAtBp[side] = val;
    const nextField = setResponsive(currentField, device, Object.keys(nextAtBp).length ? nextAtBp : undefined);
    onChange({ ...v, [key]: nextField });
  }

  // Set ALL four sides at active breakpoint (used by the "fill all" presets).
  function setAllSides(key: 'padding' | 'margin', val: SpaceValue) {
    const sides: SidesSpacing = { top: val, right: val, bottom: val, left: val };
    const nextField = setResponsive(v[key], device, sides);
    onChange({ ...v, [key]: nextField });
  }

  // Visibility toggle.
  function toggleHideOn(bp: Breakpoint) {
    const cur = new Set(v.hide_on || []);
    if (cur.has(bp)) cur.delete(bp);
    else cur.add(bp);
    onChange({ ...v, hide_on: cur.size ? Array.from(cur) : undefined });
  }

  function reset() {
    onChange({});
  }

  return (
    <div className="space-y-5">
      {/* Device tabs — drives which breakpoint the responsive fields target.
          Animate and hide_on ignore the tab (they're not per-device fields). */}
      <DeviceTabs value={device} onChange={setDevice} labels={t} />

      {/* Visibility group — flat array of breakpoints to display:none. */}
      <Group title={t.visibility} hint={t.hideHint}>
        <FieldRow label={t.hideOn}>
          <div className="inline-flex items-center gap-1">
            <DeviceCheckbox
              active={!!v.hide_on?.includes('desktop')}
              onToggle={() => toggleHideOn('desktop')}
              Icon={Monitor}
              label={t.desktop}
            />
            <DeviceCheckbox
              active={!!v.hide_on?.includes('tablet')}
              onToggle={() => toggleHideOn('tablet')}
              Icon={Tablet}
              label={t.tablet}
            />
            <DeviceCheckbox
              active={!!v.hide_on?.includes('mobile')}
              onToggle={() => toggleHideOn('mobile')}
              Icon={Smartphone}
              label={t.mobile}
            />
          </div>
        </FieldRow>
      </Group>

      {/* Layout group */}
      <Group title={t.layout} hint={t.responsiveHint}>
        <ResponsiveSeg
          label={t.width}
          field={v.width}
          device={device}
          options={[
            { value: 'full', label: t.full },
            { value: 'container', label: t.container },
            { value: 'narrow', label: t.narrow },
          ]}
          defaultVal="full"
          onPick={(val) => setR('width', val as WidthToken)}
          onClear={() => clearR('width')}
          labels={t}
        />
        <ResponsiveSeg
          label={t.radius}
          field={v.radius}
          device={device}
          options={[
            { value: 'none', label: t.none },
            { value: 'sm', label: 'sm' },
            { value: 'md', label: 'md' },
            { value: 'lg', label: 'lg' },
          ]}
          defaultVal="none"
          onPick={(val) => setR('radius', val as RadiusToken)}
          onClear={() => clearR('radius')}
          labels={t}
        />
      </Group>

      {/* Background group */}
      <Group title={t.background} hint={t.responsiveHint}>
        <ResponsiveSeg
          label={t.background}
          field={v.background}
          device={device}
          options={[
            { value: 'transparent', label: t.transparent },
            { value: 'surface', label: t.surface },
            { value: 'primary', label: t.primary },
            { value: 'accent', label: t.accent },
            { value: 'custom', label: t.custom },
            { value: 'image', label: t.image },
          ]}
          defaultVal="transparent"
          small
          stacked
          onPick={(val) => setR('background', val as BackgroundToken)}
          onClear={() => clearR('background')}
          labels={t}
        />
        {resolveResponsive(v.background, device) === 'custom' && (
          <ResponsiveColor
            label={t.customColor}
            field={v.background_color}
            device={device}
            placeholder="#ffffff"
            onPick={(c) => setR('background_color', c)}
            onClear={() => clearR('background_color')}
            labels={t}
          />
        )}
        {resolveResponsive(v.background, device) === 'image' && (
          <div className="space-y-2.5 rounded-md border border-zinc-100 bg-zinc-50/30 p-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-600">{t.backgroundImage}</Label>
              <ImageField
                value={v.background_image || ''}
                onChange={(url) => setFlat('background_image', url || undefined)}
                token={token}
                apiBase={apiBase}
                locale={locale}
              />
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-3">
              <Label className="text-xs text-zinc-600">{t.overlayColor}</Label>
              <ColorPick
                value={v.background_overlay_color || ''}
                onChange={(c) => setFlat('background_overlay_color', c || undefined)}
                placeholder="#000000"
              />
            </div>
            <OpacitySlider
              label={t.overlayOpacity}
              value={v.background_overlay_opacity ?? 0}
              onChange={(n) => setFlat('background_overlay_opacity', n || undefined)}
            />
            <p className="text-[9.5px] text-zinc-400 italic">{t.imageAllDevices}</p>
          </div>
        )}
        <ResponsiveColor
          label={t.textColor}
          field={v.text_color}
          device={device}
          placeholder={t.inheritText}
          onPick={(c) => setR('text_color', c)}
          onClear={() => clearR('text_color')}
          labels={t}
        />
      </Group>

      {/* Spacing group — 4-sided, per device. */}
      <Group title={t.spacing} hint={t.responsiveHint}>
        <SidesField
          label={t.padding}
          field={v.padding}
          device={device}
          onSetSide={(side, val) => setSide('padding', side, val)}
          onFillAll={(val) => setAllSides('padding', val)}
          onClear={() => clearR('padding')}
          labels={t}
        />
        <SidesField
          label={t.margin}
          field={v.margin}
          device={device}
          onSetSide={(side, val) => setSide('margin', side, val)}
          onFillAll={(val) => setAllSides('margin', val)}
          onClear={() => clearR('margin')}
          labels={t}
        />
      </Group>

      {/* Animation group — single value (not per-device). */}
      <Group title={t.animation}>
        <FieldRow label={t.animation}>
          <SegSelect
            value={v.animate || 'none'}
            onChange={(val) => setFlat('animate', val as AnimateToken)}
            options={[
              { value: 'none', label: t.noAnimation },
              { value: 'fade-in', label: t.fadeIn },
              { value: 'fade-up', label: t.fadeUp },
            ]}
          />
        </FieldRow>
      </Group>

      <div className="pt-2 border-t flex justify-end">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-900"
        >
          <RotateCcw className="size-3" />
          {t.reset}
        </button>
      </div>
    </div>
  );
}

// ── Building blocks ─────────────────────────────────────────────────────

function DeviceTabs({
  value,
  onChange,
  labels,
}: {
  value: Breakpoint;
  onChange: (v: Breakpoint) => void;
  labels: { desktop: string; tablet: string; mobile: string };
}) {
  const tabs: { key: Breakpoint; label: string; Icon: typeof Monitor }[] = [
    { key: 'desktop', label: labels.desktop, Icon: Monitor },
    { key: 'tablet', label: labels.tablet, Icon: Tablet },
    { key: 'mobile', label: labels.mobile, Icon: Smartphone },
  ];
  return (
    <div className="flex items-center justify-center gap-1 p-1 rounded-md bg-zinc-50 border border-zinc-200">
      {tabs.map(({ key, label, Icon }) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            title={label}
            className={cn(
              'flex items-center justify-center gap-1.5 px-2.5 py-1 text-[11px] rounded transition flex-1',
              active ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900',
            )}
          >
            <Icon className="size-3.5" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function DeviceCheckbox({
  active,
  onToggle,
  Icon,
  label,
}: {
  active: boolean;
  onToggle: () => void;
  Icon: typeof Monitor;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded border text-[10.5px] transition',
        active
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900',
      )}
    >
      <Icon className="size-3" />
      <span>{label}</span>
    </button>
  );
}

function ResponsiveSeg<T extends string>({
  label,
  field,
  device,
  options,
  defaultVal,
  small,
  stacked,
  onPick,
  onClear,
  labels,
}: {
  label: string;
  field: Responsive<T> | undefined;
  device: Breakpoint;
  options: { value: T; label: string }[];
  defaultVal: T;
  small?: boolean;
  /** Render label on its own line and the segmented selector full-width below.
   *  Use for fields with many options or long labels that overflow the inline row. */
  stacked?: boolean;
  onPick: (v: T) => void;
  onClear: () => void;
  labels: { inherits: string; desktop: string; tablet: string; mobile: string; clearForDevice: string };
}) {
  const own = hasOwnResponsive(field, device);
  const resolved = (resolveResponsive(field, device) as T | undefined) ?? defaultVal;
  const inheritedFrom = inheritedSource(field, device);
  const clearButton =
    own && device !== 'desktop' ? (
      <button
        type="button"
        onClick={onClear}
        title={labels.clearForDevice}
        className="text-[10px] text-zinc-400 hover:text-zinc-700"
      >
        <RotateCcw className="size-3" />
      </button>
    ) : null;

  if (stacked) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2 min-w-0">
          <div className="flex flex-col gap-0.5 min-w-0">
            <Label className="text-xs text-zinc-600">{label}</Label>
            {inheritedFrom && (
              <span className="text-[9.5px] text-zinc-400 truncate">
                {labels.inherits} {labels[inheritedFrom]}
              </span>
            )}
          </div>
          {clearButton}
        </div>
        <SegSelect
          value={resolved}
          onChange={onPick}
          options={options}
          small={small}
          muted={!own}
          fullWidth
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      <div className="flex flex-col gap-0.5 min-w-0">
        <Label className="text-xs text-zinc-600">{label}</Label>
        {inheritedFrom && (
          <span className="text-[9.5px] text-zinc-400 truncate">
            {labels.inherits} {labels[inheritedFrom]}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <SegSelect value={resolved} onChange={onPick} options={options} small={small} muted={!own} />
        {clearButton}
      </div>
    </div>
  );
}

function ResponsiveColor({
  label,
  field,
  device,
  placeholder,
  onPick,
  onClear,
  labels,
}: {
  label: string;
  field: Responsive<string> | undefined;
  device: Breakpoint;
  placeholder?: string;
  onPick: (c: string) => void;
  onClear: () => void;
  labels: { inherits: string; desktop: string; tablet: string; mobile: string; clearForDevice: string };
}) {
  const own = hasOwnResponsive(field, device);
  const resolved = resolveResponsive(field, device) || '';
  const inheritedFrom = inheritedSource(field, device);
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      <div className="flex flex-col gap-0.5 min-w-0">
        <Label className="text-xs text-zinc-600">{label}</Label>
        {inheritedFrom && (
          <span className="text-[9.5px] text-zinc-400 truncate">
            {labels.inherits} {labels[inheritedFrom]}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <ColorPick value={resolved} onChange={onPick} placeholder={placeholder} muted={!own} />
        {own && (
          <button
            type="button"
            onClick={onClear}
            title={labels.clearForDevice}
            className="text-[10px] text-zinc-400 hover:text-zinc-700"
          >
            <RotateCcw className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// 4-sided spacing editor. Numeric inputs per side, token presets fill all,
// and a link toggle that mirrors edits across the four inputs.
function SidesField({
  label,
  field,
  device,
  onSetSide,
  onFillAll,
  onClear,
  labels,
}: {
  label: string;
  field: Responsive<SidesSpacing> | undefined;
  device: Breakpoint;
  onSetSide: (side: 'top' | 'right' | 'bottom' | 'left', val: SpaceValue | undefined) => void;
  onFillAll: (val: SpaceValue) => void;
  onClear: () => void;
  labels: {
    inherits: string; desktop: string; tablet: string; mobile: string;
    sideTop: string; sideRight: string; sideBottom: string; sideLeft: string;
    link: string; unlink: string; presets: string; clearForDevice: string;
  };
}) {
  const sidesResolved = resolveSidesAt(field, device);
  const own = hasOwnResponsive(field, device);
  const inheritedFrom = inheritedSource(field, device);

  // Initial link state: linked when all 4 sides resolve to the same value.
  const allEqual =
    sidesResolved.top === sidesResolved.right &&
    sidesResolved.right === sidesResolved.bottom &&
    sidesResolved.bottom === sidesResolved.left;
  const [linked, setLinked] = useState<boolean>(allEqual);

  const handleSide = (side: 'top' | 'right' | 'bottom' | 'left', val: SpaceValue | undefined) => {
    if (linked && val !== undefined) {
      onFillAll(val);
    } else {
      onSetSide(side, val);
    }
  };

  return (
    <div className="space-y-1.5 rounded-md border border-zinc-100 bg-zinc-50/30 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <Label className="text-xs text-zinc-700">{label}</Label>
          {inheritedFrom && !own && (
            <span className="text-[9.5px] text-zinc-400 truncate">
              {labels.inherits} {labels[inheritedFrom]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setLinked((p) => !p)}
            title={linked ? labels.unlink : labels.link}
            className={cn(
              'p-1 rounded transition',
              linked ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-zinc-900',
            )}
          >
            {linked ? <Link2 className="size-3" /> : <Link2Off className="size-3" />}
          </button>
          {own && device !== 'desktop' && (
            <button
              type="button"
              onClick={onClear}
              title={labels.clearForDevice}
              className="p-1 text-zinc-400 hover:text-zinc-900"
            >
              <RotateCcw className="size-3" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <SideInput name={labels.sideTop[0]} title={labels.sideTop} value={sidesResolved.top} muted={!own} onChange={(v) => handleSide('top', v)} />
        <SideInput name={labels.sideRight[0]} title={labels.sideRight} value={sidesResolved.right} muted={!own} onChange={(v) => handleSide('right', v)} />
        <SideInput name={labels.sideBottom[0]} title={labels.sideBottom} value={sidesResolved.bottom} muted={!own} onChange={(v) => handleSide('bottom', v)} />
        <SideInput name={labels.sideLeft[0]} title={labels.sideLeft} value={sidesResolved.left} muted={!own} onChange={(v) => handleSide('left', v)} />
      </div>

      <div className="flex items-center gap-2 pt-0.5">
        <span className="text-[9.5px] text-zinc-400 shrink-0">{labels.presets}:</span>
        <div className="inline-flex items-center rounded-md border border-zinc-200 bg-white p-0.5">
          {SPACE_OPTIONS.map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => onFillAll(o.v)}
              className="text-[10px] px-1.5 py-0.5 rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition font-medium"
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SideInput({
  name,
  title,
  value,
  muted,
  onChange,
}: {
  name: string;
  title: string;
  value: SpaceValue | undefined;
  muted?: boolean;
  onChange: (v: SpaceValue | undefined) => void;
}) {
  const px = spaceValueToPx(value);
  return (
    <label className="flex flex-col items-center gap-0.5" title={title}>
      <input
        type="number"
        min={0}
        value={px === '' ? '' : px}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') onChange(undefined);
          else {
            const n = Number(raw);
            if (Number.isFinite(n)) onChange(n);
          }
        }}
        className={cn(
          'w-full h-7 text-center text-[11px] font-mono rounded border border-zinc-200 bg-white outline-none focus:border-zinc-900 transition',
          muted ? 'text-zinc-500' : 'text-zinc-900',
        )}
      />
      <span className="text-[9px] uppercase tracking-wider text-zinc-400">{name}</span>
    </label>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[10px] uppercase tracking-[0.12em] font-semibold text-zinc-500">{title}</h3>
        {hint && <span className="text-[9.5px] text-zinc-400 italic">{hint}</span>}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      <Label className="text-xs text-zinc-600">{label}</Label>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

// Inline segmented selector. `muted` softens the active chip when the value
// is inherited from a wider breakpoint instead of explicitly set here.
// `fullWidth` makes the chips share the row equally (used in stacked layout
// when the field needs the whole panel width).
function SegSelect<T extends string>({
  value,
  onChange,
  options,
  small,
  muted,
  fullWidth,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  small?: boolean;
  muted?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-zinc-200 bg-white p-0.5',
        fullWidth ? 'grid w-full' : 'inline-flex items-center max-w-full overflow-x-auto',
      )}
      style={fullWidth ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o) => {
        const isActive = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'transition rounded-[4px] font-medium truncate',
              fullWidth ? 'min-w-0' : 'shrink-0',
              small ? 'text-[10px] px-1.5 py-1' : 'text-[11px] px-2 py-1',
              isActive
                ? muted
                  ? 'bg-zinc-200 text-zinc-700'
                  : 'bg-zinc-900 text-white'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Overlay opacity slider (0–100). Paired with the overlay color above it.
function OpacitySlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      <Label className="text-xs text-zinc-600">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-28 accent-zinc-900 cursor-pointer"
        />
        <span className="w-9 text-end text-[11px] font-mono text-zinc-600 tabular-nums">
          {value}%
        </span>
      </div>
    </div>
  );
}

function ColorPick({
  value,
  onChange,
  placeholder,
  muted,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  muted?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-1.5', muted && 'opacity-70')}>
      <input
        type="color"
        value={value || '#ffffff'}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-8 cursor-pointer rounded border border-zinc-200 bg-white p-0.5"
      />
      <Input
        className="h-7 text-[11px] font-mono w-24"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || '#000'}
      />
    </div>
  );
}
