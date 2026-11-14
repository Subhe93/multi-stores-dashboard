'use client';

// Editor for the `imageSize` field type: one `image_size` object holding the
// image width / height / alignment per breakpoint plus flat max width, fit
// and focal point. Spec: plans/image-sizing/SPEC.md (section 5).
//
// While `image_size` is empty the editor shows the equivalent of the legacy
// keys (aspect / fit / width_px) of the section or block, and writes the full
// seeded object on the first edit.

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import type { LocalizedString } from '@/lib/section-schemas';
import {
  type Breakpoint,
  type Responsive,
  hasOwnResponsive,
  inheritedSource,
  resolveResponsive,
  setResponsive,
} from '@/lib/responsive';
import {
  IMAGE_RATIOS,
  IMAGE_SIZE_DEFAULTS,
  IMAGE_SIZE_LIMITS,
  clampImageSizeNumber,
  compactImageSize,
  imageSizeControlsAt,
  imageSizeEditorValue,
  isRtlContentLocale,
  type ImageAlign,
  type ImageFit,
  type ImageHeightMode,
  type ImagePosition,
  type ImageRatio,
  type ImageSizeFlatKey,
  type ImageSizePerBpKey,
  type ImageSizeSettings,
  type ImageWidthMode,
} from '@/lib/imageSize';
import { DeviceTabs, SegSelect } from '../responsiveControls';
import { useUiLabel } from '../useUiLabel';
import { cn } from '@/lib/utils';

// Builder chrome labels (dashboard UI locale via useUiLabel).
const L = {
  width: { en: 'Width', ar: 'العرض', tr: 'Genişlik', de: 'Breite', fr: 'Largeur', sv: 'Bredd' },
  auto: { en: 'Auto', ar: 'تلقائي', tr: 'Otomatik', de: 'Auto', fr: 'Auto', sv: 'Auto' },
  // Auto on any device makes the image load one full-size file everywhere
  // (no responsive renditions, no space reserved before it loads).
  autoTitle: {
    en: 'Auto (natural size). Loads one full-size file on every device; prefer Full, px or % for large photos.',
    ar: 'تلقائي (الحجم الأصلي). يُحمَّل ملف واحد بالحجم الكامل على كل الأجهزة؛ للصور الكبيرة استخدم كامل العرض أو px أو %.',
    tr: 'Otomatik (doğal boyut). Her cihazda tek bir tam boyutlu dosya yüklenir; büyük fotoğraflar için Tam, px veya % tercih edin.',
    de: 'Auto (Originalgröße). Lädt auf jedem Gerät eine Datei in voller Größe; für große Fotos besser Voll, px oder %.',
    fr: 'Auto (taille d’origine). Charge un seul fichier pleine taille sur chaque appareil ; pour les grandes photos, préférez Pleine, px ou %.',
    sv: 'Auto (naturlig storlek). Laddar en fil i full storlek på alla enheter; välj hellre Full, px eller % för stora foton.',
  },
  full: { en: 'Full', ar: 'كامل العرض', tr: 'Tam', de: 'Voll', fr: 'Pleine', sv: 'Full' },
  widthPx: { en: 'Width (px)', ar: 'العرض (px)', tr: 'Genişlik (px)', de: 'Breite (px)', fr: 'Largeur (px)', sv: 'Bredd (px)' },
  widthPercent: { en: 'Width (%)', ar: 'العرض (%)', tr: 'Genişlik (%)', de: 'Breite (%)', fr: 'Largeur (%)', sv: 'Bredd (%)' },
  autoBecomesFull: {
    en: 'With an aspect ratio, auto width shows as full width.',
    ar: 'مع نسبة أبعاد، يُعرض العرض التلقائي بكامل العرض.',
    tr: 'En-boy oranıyla otomatik genişlik tam genişlik olarak gösterilir.',
    de: 'Mit Seitenverhältnis wird automatische Breite als volle Breite angezeigt.',
    fr: 'Avec un format, la largeur auto s’affiche en pleine largeur.',
    sv: 'Med bildförhållande visas auto-bredd som full bredd.',
  },
  height: { en: 'Height', ar: 'الارتفاع', tr: 'Yükseklik', de: 'Höhe', fr: 'Hauteur', sv: 'Höjd' },
  heightPx: { en: 'Height (px)', ar: 'الارتفاع (px)', tr: 'Yükseklik (px)', de: 'Höhe (px)', fr: 'Hauteur (px)', sv: 'Höjd (px)' },
  ratio: { en: 'Aspect ratio', ar: 'نسبة الأبعاد', tr: 'En-boy oranı', de: 'Seitenverhältnis', fr: 'Format', sv: 'Bildförhållande' },
  ratioShort: { en: 'Ratio', ar: 'نسبة', tr: 'Oran', de: 'Verhältnis', fr: 'Format', sv: 'Förhållande' },
  align: { en: 'Alignment', ar: 'المحاذاة', tr: 'Hizalama', de: 'Ausrichtung', fr: 'Alignement', sv: 'Justering' },
  start: { en: 'Start', ar: 'بداية', tr: 'Başlangıç', de: 'Anfang', fr: 'Début', sv: 'Start' },
  center: { en: 'Center', ar: 'وسط', tr: 'Orta', de: 'Mitte', fr: 'Centre', sv: 'Mitten' },
  end: { en: 'End', ar: 'نهاية', tr: 'Son', de: 'Ende', fr: 'Fin', sv: 'Slut' },
  allDevices: { en: 'All devices', ar: 'كل الأجهزة', tr: 'Tüm cihazlar', de: 'Alle Geräte', fr: 'Tous les appareils', sv: 'Alla enheter' },
  maxWidth: { en: 'Max width (px)', ar: 'أقصى عرض (px)', tr: 'Maks. genişlik (px)', de: 'Max. Breite (px)', fr: 'Largeur max. (px)', sv: 'Max bredd (px)' },
  fit: { en: 'Fit', ar: 'ملاءمة', tr: 'Sığdırma', de: 'Einpassen', fr: 'Ajustement', sv: 'Anpassning' },
  cover: { en: 'Fill (crop)', ar: 'ملء (قص)', tr: 'Doldur (kırp)', de: 'Füllen (zuschneiden)', fr: 'Remplir (recadrer)', sv: 'Fyll (beskär)' },
  contain: {
    en: 'Fit (no crop)', ar: 'احتواء (بلا قص)', tr: 'Sığdır (kırpmadan)',
    de: 'Einpassen (ohne Zuschnitt)', fr: 'Contenir (sans recadrage)', sv: 'Anpassa (ingen beskärning)',
  },
  position: { en: 'Focal point', ar: 'نقطة التركيز', tr: 'Odak noktası', de: 'Fokuspunkt', fr: 'Point focal', sv: 'Fokuspunkt' },
  posCenter: { en: 'Center', ar: 'الوسط', tr: 'Orta', de: 'Mitte', fr: 'Centre', sv: 'Mitten' },
  posTop: { en: 'Top', ar: 'الأعلى', tr: 'Üst', de: 'Oben', fr: 'Haut', sv: 'Topp' },
  posBottom: { en: 'Bottom', ar: 'الأسفل', tr: 'Alt', de: 'Unten', fr: 'Bas', sv: 'Botten' },
  posLeft: { en: 'Left', ar: 'اليسار', tr: 'Sol', de: 'Links', fr: 'Gauche', sv: 'Vänster' },
  posRight: { en: 'Right', ar: 'اليمين', tr: 'Sağ', de: 'Rechts', fr: 'Droite', sv: 'Höger' },
} satisfies Record<string, LocalizedString>;

export function ImageSizeField({
  value,
  siblings,
  contentLocale,
  onChange,
}: {
  value: unknown;
  /** The section settings / block item, read to seed from the legacy keys. */
  siblings?: Record<string, unknown>;
  /** Store content locale being edited; its direction drives the align icons. */
  contentLocale?: string;
  onChange: (next: ImageSizeSettings | undefined) => void;
}) {
  const ui = useUiLabel();
  const tt = useTranslations('builder');
  const [device, setDevice] = useState<Breakpoint>('desktop');
  const { value: v } = imageSizeEditorValue(value, siblings);
  const c = imageSizeControlsAt(v, device);

  const devices = {
    desktop: tt('styleDesktop'),
    tablet: tt('styleTablet'),
    mobile: tt('styleMobile'),
  };
  const inherits = tt('styleInheritsFrom');
  const clearForDevice = tt('styleClearForDevice');

  const commit = (next: ImageSizeSettings) => onChange(compactImageSize(next));
  const setAt = (key: ImageSizePerBpKey, val: unknown) =>
    commit({ ...v, [key]: setResponsive(v[key] as Responsive<unknown> | undefined, device, val) });
  const setFlat = (key: ImageSizeFlatKey, val: unknown) => commit({ ...v, [key]: val });

  const rowProps = (key: ImageSizePerBpKey) => ({
    own: hasOwnResponsive(v[key] as Responsive<unknown> | undefined, device),
    inheritedFrom: inheritedSource(v[key] as Responsive<unknown> | undefined, device),
    device,
    devices,
    inherits,
    clearForDevice,
    onClear: () => setAt(key, undefined),
  });

  const pxOrPercent = (key: 'width_px' | 'width_percent' | 'height_px', label: string) => {
    const range = IMAGE_SIZE_LIMITS[key];
    const resolved = resolveResponsive(v[key], device);
    const r = rowProps(key);
    return (
      <Row label={label} {...r}>
        <Input
          type="number"
          className={cn('h-8 w-24 text-center font-mono text-[12px]', !r.own && 'text-zinc-500')}
          min={range.min}
          max={range.max}
          value={r.own && typeof resolved === 'number' ? resolved : ''}
          placeholder={String(resolved ?? IMAGE_SIZE_DEFAULTS[key])}
          onChange={(e) => {
            const raw = e.target.value;
            const n = Number(raw);
            setAt(key, raw === '' || !Number.isFinite(n) ? undefined : n);
          }}
          onBlur={(e) => {
            // Clamp on blur so a stored value always sits in the range.
            const n = Number(e.target.value);
            const clamped = clampImageSizeNumber(key, e.target.value);
            if (clamped !== undefined && clamped !== n) setAt(key, clamped);
          }}
        />
      </Row>
    );
  };

  // Logical alignment resolves against the STORE content direction (margin-
  // inline on the storefront), not the dashboard UI direction, so the
  // physical icons mirror only when the content locale is RTL.
  const mirror = isRtlContentLocale(contentLocale) ? '-scale-x-100' : '';
  const alignOptions: { value: ImageAlign; label: React.ReactNode; title: string }[] = [
    { value: 'start', label: <AlignHorizontalJustifyStart className={cn('size-3.5', mirror)} />, title: ui(L.start) },
    { value: 'center', label: <AlignHorizontalJustifyCenter className="size-3.5" />, title: ui(L.center) },
    { value: 'end', label: <AlignHorizontalJustifyEnd className={cn('size-3.5', mirror)} />, title: ui(L.end) },
  ];

  return (
    <div className="space-y-2.5 rounded-lg border border-zinc-200 bg-zinc-50/30 p-2.5">
      <DeviceTabs value={device} onChange={setDevice} labels={devices} />

      <Row label={ui(L.width)} stacked {...rowProps('width_mode')}>
        <SegSelect<ImageWidthMode>
          value={c.widthMode}
          onChange={(m) => setAt('width_mode', m)}
          muted={!rowProps('width_mode').own}
          fullWidth
          options={[
            { value: 'auto', label: ui(L.auto), title: ui(L.autoTitle) },
            { value: 'full', label: ui(L.full) },
            { value: 'px', label: 'px' },
            { value: 'percent', label: '%' },
          ]}
        />
      </Row>
      {c.widthPx && pxOrPercent('width_px', ui(L.widthPx))}
      {c.widthPercent && pxOrPercent('width_percent', ui(L.widthPercent))}
      {c.autoBecomesFull && <p className="text-[10px] text-zinc-400 leading-snug">{ui(L.autoBecomesFull)}</p>}

      <Row label={ui(L.height)} stacked {...rowProps('height_mode')}>
        <SegSelect<ImageHeightMode>
          value={c.heightMode}
          onChange={(m) => setAt('height_mode', m)}
          muted={!rowProps('height_mode').own}
          fullWidth
          options={[
            { value: 'auto', label: ui(L.auto) },
            { value: 'px', label: 'px' },
            { value: 'ratio', label: ui(L.ratioShort), title: ui(L.ratio) },
          ]}
        />
      </Row>
      {c.heightPx && pxOrPercent('height_px', ui(L.heightPx))}
      {c.ratio && (
        <Row label={ui(L.ratio)} {...rowProps('ratio')}>
          <div className="min-w-28">
            <SearchableSelect
              value={(resolveResponsive(v.ratio, device) as string | undefined) ?? IMAGE_SIZE_DEFAULTS.ratio}
              onChange={(r) => setAt('ratio', r as ImageRatio)}
              options={IMAGE_RATIOS.map((r) => ({ value: r, label: r }))}
            />
          </div>
        </Row>
      )}

      <Row label={ui(L.align)} {...rowProps('align')}>
        <SegSelect<ImageAlign>
          value={(resolveResponsive(v.align, device) as ImageAlign | undefined) ?? IMAGE_SIZE_DEFAULTS.align}
          onChange={(a) => setAt('align', a)}
          muted={!rowProps('align').own}
          options={alignOptions}
        />
      </Row>

      {/* Flat settings: one value for every device. */}
      <div className="pt-2 mt-1 border-t border-zinc-200/70 space-y-2.5">
        <div className="text-[9.5px] uppercase tracking-wider text-zinc-400 font-semibold">{ui(L.allDevices)}</div>
        <Row label={ui(L.maxWidth)}>
          <Input
            type="number"
            className="h-8 w-24 text-center font-mono text-[12px]"
            min={IMAGE_SIZE_LIMITS.max_width_px.min}
            max={IMAGE_SIZE_LIMITS.max_width_px.max}
            value={typeof v.max_width_px === 'number' ? v.max_width_px : ''}
            placeholder="—"
            onChange={(e) => {
              const raw = e.target.value;
              const n = Number(raw);
              setFlat('max_width_px', raw === '' || !Number.isFinite(n) || n <= 0 ? undefined : n);
            }}
            onBlur={(e) => {
              // Same clamp as the storefront, so the editor shows what renders.
              const n = Number(e.target.value);
              const clamped = clampImageSizeNumber('max_width_px', e.target.value);
              if (clamped !== undefined && clamped !== n) setFlat('max_width_px', clamped);
            }}
          />
        </Row>
        {c.fit && (
          <Row label={ui(L.fit)}>
            <SegSelect<ImageFit>
              value={v.fit === 'contain' ? 'contain' : 'cover'}
              onChange={(f) => setFlat('fit', f)}
              small
              options={[
                { value: 'cover', label: ui(L.cover) },
                { value: 'contain', label: ui(L.contain) },
              ]}
            />
          </Row>
        )}
        {c.position && (
          <Row label={ui(L.position)}>
            <div className="min-w-28">
              <SearchableSelect
                value={v.position ?? IMAGE_SIZE_DEFAULTS.position}
                onChange={(p) => setFlat('position', p as ImagePosition)}
                options={[
                  { value: 'center', label: ui(L.posCenter) },
                  { value: 'top', label: ui(L.posTop) },
                  { value: 'bottom', label: ui(L.posBottom) },
                  { value: 'left', label: ui(L.posLeft) },
                  { value: 'right', label: ui(L.posRight) },
                ]}
              />
            </div>
          </Row>
        )}
      </div>
    </div>
  );
}

// One control row. Per-breakpoint rows show where an inherited value comes
// from and a clear button for an own value on tablet / mobile.
function Row({
  label,
  stacked,
  own,
  inheritedFrom,
  device,
  devices,
  inherits,
  clearForDevice,
  onClear,
  children,
}: {
  label: string;
  stacked?: boolean;
  own?: boolean;
  inheritedFrom?: Breakpoint | null;
  device?: Breakpoint;
  devices?: Record<Breakpoint, string>;
  inherits?: string;
  clearForDevice?: string;
  onClear?: () => void;
  children: React.ReactNode;
}) {
  const meta = (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11.5px] font-medium text-zinc-700">{label}</span>
      {inheritedFrom && devices && (
        <span className="text-[9.5px] text-zinc-400 truncate">
          {inherits} {devices[inheritedFrom]}
        </span>
      )}
    </div>
  );
  const clear =
    own && device && device !== 'desktop' && onClear ? (
      <button type="button" onClick={onClear} title={clearForDevice} className="p-0.5 text-zinc-400 hover:text-zinc-700">
        <RotateCcw className="size-3" />
      </button>
    ) : null;

  if (stacked) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          {meta}
          {clear}
        </div>
        {children}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 min-h-8">
      {meta}
      <div className="flex items-center gap-1 shrink-0">
        {children}
        {clear}
      </div>
    </div>
  );
}
