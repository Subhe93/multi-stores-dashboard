'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ImageIcon, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import type { DesignElement, I18n, TextElement } from '@multi-stores/core/designer';
import { faceKey, type FontFaceOption } from '@/lib/designer/templateSpec';
import { FieldError } from '@/components/designer/DesignerBits';

/** DOM id of an element field (target of the "jump to the field" flow). */
export const elementFieldId = (index: number, field: string) => `dz-el-${index}-${field}`;

interface TemplateElementFormProps {
  element: DesignElement;
  index: number;
  /** `coalesce`: typing runs in one field share this undo key (`form:<index>:<field>`). */
  onChange: (next: DesignElement, coalesce?: string) => void;
  /** field → message for this element. */
  errors: Record<string, string>;
  fontOptions: FontFaceOption[];
  locales: string[];
  imageUrl?: string | null;
  onPickImage?: () => void;
}

function NumField({
  id,
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  invalid,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  invalid?: boolean;
}) {
  // What was typed is kept while the field is focused; the spec only takes
  // finite numbers (a cleared or half-typed field never writes NaN). On blur
  // the draft is dropped and the committed value shows again.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (Number.isFinite(value) ? String(value) : '');
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[11px] font-normal text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        step={step}
        min={min}
        max={max}
        dir="ltr"
        className="h-8 text-xs tabular-nums"
        aria-invalid={invalid || undefined}
        value={shown}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const n = raw.trim() === '' ? NaN : Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => setDraft(null)}
      />
    </div>
  );
}

/** One input per store locale for a translated label / placeholder. */
export function I18nInputs({
  id,
  label,
  hint,
  value,
  locales,
  onChange,
  maxLength = 80,
  error,
}: {
  id: string;
  label: string;
  hint?: string;
  value: I18n;
  locales: string[];
  onChange: (v: I18n) => void;
  maxLength?: number;
  error?: string;
}) {
  const t = useTranslations('creator.designer.editor.element');
  const first = value?.[locales[0]] ?? '';
  const copyToAll = () => {
    const next: I18n = { ...(value ?? {}) };
    for (const loc of locales) {
      if (first) next[loc] = first;
      else delete next[loc];
    }
    onChange(next);
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        {locales.length > 1 && (
          <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] pointer-coarse:h-11" disabled={!first} onClick={copyToAll} title={t('copyToAllHint')}>
            <Languages className="size-3" /> {t('copyToAll')}
          </Button>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      <div className="space-y-1.5">
        {locales.map((loc, i) => (
          <div key={loc} className="flex items-center gap-2">
            <span className="w-7 shrink-0 text-center font-mono text-[10px] uppercase text-muted-foreground">{loc}</span>
            <Input
              id={i === 0 ? id : `${id}-${loc}`}
              className="h-8 text-xs"
              maxLength={maxLength}
              value={value?.[loc] ?? ''}
              aria-invalid={(!!error && i === 0) || undefined}
              onChange={(e) => {
                const next = { ...(value ?? {}) };
                if (e.target.value) next[loc] = e.target.value;
                else delete next[loc];
                onChange(next);
              }}
            />
          </div>
        ))}
      </div>
      <FieldError text={error} />
    </div>
  );
}

/** Colour swatch + hex input. */
function ColorField({ id, label, value, onChange, error }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[11px] font-normal text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          className="h-8 w-10 cursor-pointer rounded border bg-white p-0.5"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
        />
        <Input id={id} dir="ltr" className="h-8 font-mono text-xs" value={value} maxLength={32} onChange={(e) => onChange(e.target.value)} />
      </div>
      <FieldError text={error} />
    </div>
  );
}

/** Segmented control (align, shape, direction). */
function Segmented<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div id={id} role="radiogroup" aria-label={label} className="inline-flex rounded-md border bg-zinc-50 p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`rounded px-2.5 py-1 text-xs ${value === o.value ? 'bg-white font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <Label htmlFor={id} className="text-xs font-normal">
          {label}
        </Label>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <ToggleSwitch id={id} checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

/**
 * Form of one template element (text, photo slot or decoration): content,
 * typography and geometry. Every field has a stable DOM id so a validation
 * issue can focus it.
 */
export function TemplateElementForm({ element, index, onChange, errors, fontOptions, locales, imageUrl, onPickImage }: TemplateElementFormProps) {
  const t = useTranslations('creator.designer.editor.element');
  const fid = (f: string) => elementFieldId(index, f);
  const coalesceKey = (field: string) => `form:${index}:${field}`;
  const set = <K extends keyof DesignElement>(key: K, v: DesignElement[K]) => onChange({ ...element, [key]: v } as DesignElement, coalesceKey(String(key)));

  const geometry = (
    <div className="space-y-2 rounded-md border bg-zinc-50/60 p-3" id={fid('geometry')}>
      <p className="text-xs font-medium">{t('geometry')}</p>
      <p className="text-[11px] text-muted-foreground">{t('geometryHint')}</p>
      <div className="grid grid-cols-3 gap-2">
        <NumField id={fid('x')} label={t('x')} value={element.x} step={0.5} onChange={(v) => set('x', v)} invalid={!!errors.geometry} />
        <NumField id={fid('y')} label={t('y')} value={element.y} step={0.5} onChange={(v) => set('y', v)} invalid={!!errors.geometry} />
        <NumField id={fid('rot')} label={t('rot')} value={element.rot} min={-360} max={360} onChange={(v) => set('rot', v)} invalid={!!errors.geometry} />
        <NumField id={fid('w')} label={t('w')} value={element.w} step={0.5} min={0} onChange={(v) => set('w', v)} invalid={!!errors.geometry} />
        <NumField id={fid('h')} label={t('h')} value={element.h} step={0.5} min={0} onChange={(v) => set('h', v)} invalid={!!errors.geometry} />
        <NumField id={fid('z')} label={t('z')} value={element.z} onChange={(v) => set('z', v)} invalid={!!errors.geometry} />
      </div>
      <FieldError text={errors.geometry} />
      <ToggleRow id={fid('locked')} label={t('locked')} hint={t('lockedHint')} checked={element.locked} onChange={(v) => set('locked', v)} />
    </div>
  );

  if (element.type === 'text') {
    const el = element;
    const setText = <K extends keyof TextElement>(key: K, v: TextElement[K]) => onChange({ ...el, [key]: v }, coalesceKey(String(key)));
    const current = faceKey(el.font);
    const options = fontOptions.map((f) => ({
      value: faceKey(f),
      label: `${f.family} ${f.weight}${f.style === 'italic' ? ' italic' : ''}`,
    }));
    if (!options.some((o) => o.value === current)) {
      options.unshift({
        value: current,
        label: t('fontMissingOption', { font: `${el.font.family} ${el.font.weight}` }),
      });
    }
    return (
      <div className="space-y-4">
        <I18nInputs
          id={fid('label')}
          label={t('label')}
          hint={t('labelHint')}
          value={el.label}
          locales={locales}
          onChange={(v) => setText('label', v)}
          error={errors.label}
        />
        <div className="space-y-1">
          <Label htmlFor={fid('default_text')} className="text-xs">
            {t('defaultText')}
          </Label>
          <Input id={fid('default_text')} className="h-8 text-xs" maxLength={200} value={el.default_text} onChange={(e) => setText('default_text', e.target.value)} />
          <p className="text-[11px] text-muted-foreground">{t('defaultTextHint')}</p>
          <FieldError text={errors.default_text} />
        </div>
        <I18nInputs id={fid('placeholder')} label={t('placeholder')} value={el.placeholder} locales={locales} onChange={(v) => setText('placeholder', v)} error={errors.placeholder} />

        <div className="space-y-3 rounded-md border p-3">
          <p className="text-xs font-medium">{t('typography')}</p>
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground">{t('font')}</span>
            <div id={fid('font')} tabIndex={-1}>
              <SearchableSelect
                value={current}
                options={options}
                onChange={(v) => {
                  const f = fontOptions.find((o) => faceKey(o) === v);
                  if (f) setText('font', { family: f.family, weight: f.weight, style: f.style });
                }}
              />
            </div>
            {fontOptions.length === 0 && <p className="text-[11px] text-amber-700">{t('noFonts')}</p>}
            <FieldError text={errors.font} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumField id={fid('size')} label={t('size')} value={el.size} step={0.5} min={1} onChange={(v) => setText('size', v)} invalid={!!errors.size} />
            <NumField
              id={fid('fit')}
              label={t('fitMin')}
              value={el.fit?.min}
              step={0.5}
              min={1}
              onChange={(v) => setText('fit', { ...el.fit, min: v })}
              invalid={!!errors.fit}
            />
          </div>
          <FieldError text={errors.size || errors.fit} />
          <p className="text-[11px] text-muted-foreground">{t('fitHint')}</p>
          <ColorField id={fid('color')} label={t('color')} value={el.color} onChange={(v) => setText('color', v)} error={errors.color} />
          <div className="flex flex-wrap gap-4">
            <Segmented
              id={fid('align')}
              label={t('align')}
              value={el.align}
              options={[
                { value: 'left', label: t('alignLeft') },
                { value: 'center', label: t('alignCenter') },
                { value: 'right', label: t('alignRight') },
              ]}
              onChange={(v) => setText('align', v)}
            />
            <Segmented
              id={fid('direction')}
              label={t('direction')}
              value={el.direction}
              options={[
                { value: 'auto', label: t('dirAuto') },
                { value: 'ltr', label: 'LTR' },
                { value: 'rtl', label: 'RTL' },
              ]}
              onChange={(v) => setText('direction', v)}
            />
          </div>
          <FieldError text={errors.align} />
          <ToggleRow
            id={fid('transform')}
            label={t('uppercase')}
            checked={el.transform === 'uppercase'}
            onChange={(v) => setText('transform', v ? 'uppercase' : 'none')}
          />
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <p className="text-xs font-medium">{t('customerInput')}</p>
          <ToggleRow id={fid('editable')} label={t('editable')} hint={t('editableHint')} checked={el.editable} onChange={(v) => setText('editable', v)} />
          {el.editable && (
            <>
              <ToggleRow id={fid('required')} label={t('required')} checked={el.required} onChange={(v) => setText('required', v)} />
              <div className="grid grid-cols-2 gap-2">
                <NumField
                  id={fid('max_length')}
                  label={t('maxLength')}
                  value={el.max_length}
                  min={0}
                  max={1000}
                  onChange={(v) => setText('max_length', v)}
                  invalid={!!errors.max_length}
                />
              </div>
              <FieldError text={errors.max_length} />
              <div className="space-y-1">
                <Label htmlFor={fid('allowed_chars')} className="text-[11px] font-normal text-muted-foreground">
                  {t('allowedChars')}
                </Label>
                <Input
                  id={fid('allowed_chars')}
                  dir="ltr"
                  className="h-8 font-mono text-xs"
                  placeholder="\p{L}\p{N} .-"
                  value={el.allowed_chars ?? ''}
                  aria-invalid={!!errors.allowed_chars || undefined}
                  onChange={(e) => {
                    const v = e.target.value;
                    const next = { ...el };
                    if (v) next.allowed_chars = v;
                    else delete next.allowed_chars;
                    onChange(next, coalesceKey('allowed_chars'));
                  }}
                />
                <p className="text-[11px] text-muted-foreground">{t('allowedCharsHint')}</p>
                <FieldError text={errors.allowed_chars} />
              </div>
            </>
          )}
        </div>
        {geometry}
      </div>
    );
  }

  if (element.type === 'image_slot') {
    const el = element;
    return (
      <div className="space-y-4">
        <I18nInputs id={fid('label')} label={t('label')} value={el.label} locales={locales} onChange={(v) => onChange({ ...el, label: v }, coalesceKey('label'))} error={errors.label} />
        <I18nInputs
          id={fid('placeholder')}
          label={t('slotPlaceholder')}
          value={el.placeholder}
          locales={locales}
          onChange={(v) => onChange({ ...el, placeholder: v }, coalesceKey('placeholder'))}
          error={errors.placeholder}
        />
        <div className="space-y-3 rounded-md border p-3">
          <Segmented
            id={fid('shape')}
            label={t('shape')}
            value={el.shape}
            options={[
              { value: 'rect', label: t('shapeRect') },
              { value: 'ellipse', label: t('shapeEllipse') },
            ]}
            onChange={(v) => onChange({ ...el, shape: v })}
          />
          <FieldError text={errors.shape} />
          {el.shape === 'rect' && (
            <div className="grid grid-cols-2 gap-2">
              <NumField id={fid('radius')} label={t('radius')} value={el.radius} min={0} step={0.5} onChange={(v) => onChange({ ...el, radius: v }, coalesceKey('radius'))} invalid={!!errors.radius} />
            </div>
          )}
          <FieldError text={errors.radius} />
          <ColorField id={fid('border_color')} label={t('borderColor')} value={el.border_color} onChange={(v) => onChange({ ...el, border_color: v }, coalesceKey('border_color'))} />
          <p className="text-[11px] text-muted-foreground">{t('borderColorHint')}</p>
          <ToggleRow id={fid('required')} label={t('photoRequired')} checked={el.required} onChange={(v) => onChange({ ...el, required: v })} />
        </div>
        {geometry}
      </div>
    );
  }

  const el = element;
  return (
    <div className="space-y-4">
      <div className="space-y-2" id={fid('asset')} tabIndex={-1}>
        <span className="text-xs">{t('decorationImage')}</span>
        <div className="flex items-center gap-3">
          <div className="flex size-20 items-center justify-center overflow-hidden rounded-md border bg-zinc-50">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- API-hosted file
              <img src={imageUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <ImageIcon className="size-5 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-1 text-[11px] text-muted-foreground">
            <p dir="ltr" className="tabular-nums">
              {el.asset?.width}×{el.asset?.height}
            </p>
            {onPickImage && (
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onPickImage}>
                {t('changeImage')}
              </Button>
            )}
          </div>
        </div>
        <FieldError text={errors.asset} />
      </div>
      {geometry}
    </div>
  );
}
