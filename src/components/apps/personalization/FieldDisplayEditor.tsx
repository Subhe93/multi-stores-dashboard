'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ImageIcon, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { resolveMediaUrl } from '@/lib/media';
import { charCount } from '@/lib/customFields';
import { isHexColor, type MessageKey, type OptionConfigLike, type PUi } from '@/lib/personalization';

/** Per-locale texts of the M4.1 translation columns as edited in the dialog. */
export interface ExtrasForm {
  display_label: string;
  sublabel: string;
  note: string;
  help_text: string;
  help_image_url: string;
  messages: Partial<Record<MessageKey, string>>;
}

export const emptyExtras = (): ExtrasForm => ({
  display_label: '',
  sublabel: '',
  note: '',
  help_text: '',
  help_image_url: '',
  messages: {},
});

interface FieldDisplayEditorProps {
  type: string;
  /** Children of a repeater have no placement of their own. */
  isChild: boolean;
  ui: PUi | null;
  onUiChange: (next: PUi | null) => void;
  /** Option values of the field (checkbox defaults, static palette). */
  optionValues: string[];
  variantOptions: OptionConfigLike[];
  /** The field has an equal-length link (enables the linked counter and limit). */
  hasLinkedTarget: boolean;
  /** Language tab bar of the dialog, rendered above the per-language texts. */
  localeBar: ReactNode;
  extras: ExtrasForm;
  onExtrasChange: (patch: Partial<ExtrasForm>) => void;
  isRtl: boolean;
  onPickImage: () => Promise<string | null>;
  uploading: boolean;
}

/** Message keys that apply to a field type (C34 mapping). */
function messageKeysFor(type: string, linked: boolean): MessageKey[] {
  if (type === 'REPEATER') return [];
  if (type === 'TEXT' || type === 'TEXTAREA') {
    return ['required', 'max_length', 'pattern', 'allowed_chars', ...(linked ? (['equal_length'] as MessageKey[]) : [])];
  }
  if (type === 'CHECKBOX_GROUP') return ['required', 'min_checked', 'max_checked'];
  return ['required'];
}

/** Writes a ui patch, dropping keys set to undefined; an empty object becomes null. */
function patchUi(ui: PUi | null, patch: Partial<PUi>): PUi | null {
  const next: PUi = { ...(ui ?? {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete next[k];
    else next[k] = v;
  }
  return Object.keys(next).length > 0 ? next : null;
}

/**
 * "Display & help" tab of the field dialog: storefront placement and input
 * behaviour (`ui`), plus the per-language sublabel, note, help text and
 * image, cart label and custom error messages.
 */
export function FieldDisplayEditor({
  type,
  isChild,
  ui,
  onUiChange,
  optionValues,
  variantOptions,
  hasLinkedTarget,
  localeBar,
  extras,
  onExtrasChange,
  isRtl,
  onPickImage,
  uploading,
}: FieldDisplayEditorProps) {
  const t = useTranslations('customField.display');
  const set = (patch: Partial<PUi>) => onUiChange(patchUi(ui, patch));
  const isText = type === 'TEXT' || type === 'TEXTAREA';
  const counter = ui?.counter === 'linked' ? 'linked' : ui?.counter === true ? 'on' : 'off';
  const insertCharError = ui?.insert_char && charCount(ui.insert_char) !== 1 ? t('insertCharOne') : '';
  const paletteSource = ui?.palette_from_option !== undefined ? 'option' : 'static';
  const dir = isRtl ? 'rtl' : undefined;

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <p className="text-xs font-semibold text-muted-foreground">{t('behaviourTitle')}</p>

        {!isChild && (
          <div className="max-w-sm space-y-1.5">
            <Label className="text-xs">{t('placement')}</Label>
            <SearchableSelect
              value={ui?.placement ?? 'after_variants'}
              onChange={(v) => set({ placement: v === 'before_variants' ? 'before_variants' : 'after_variants' })}
              options={[
                { value: 'before_variants', label: t('placementBefore') },
                { value: 'after_variants', label: t('placementAfter') },
              ]}
            />
          </div>
        )}

        {isText && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('transform')}</Label>
              <SearchableSelect
                value={ui?.transform ?? 'none'}
                onChange={(v) => set({ transform: v === 'uppercase' ? 'uppercase' : undefined })}
                options={[
                  { value: 'none', label: t('transformNone') },
                  { value: 'uppercase', label: t('transformUppercase') },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('counter')}</Label>
              <SearchableSelect
                value={counter}
                onChange={(v) => set({ counter: v === 'linked' ? 'linked' : v === 'on' ? true : undefined })}
                options={[
                  { value: 'off', label: t('counterOff') },
                  { value: 'on', label: t('counterOn') },
                  ...(hasLinkedTarget || counter === 'linked' ? [{ value: 'linked', label: t('counterLinked') }] : []),
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('insertChar')}</Label>
              <Input
                className="h-8 text-sm"
                placeholder="❤"
                value={ui?.insert_char ?? ''}
                aria-invalid={!!insertCharError || undefined}
                onChange={(e) => set({ insert_char: e.target.value || undefined })}
              />
              {insertCharError ? (
                <p className="text-[10px] text-red-600">{insertCharError}</p>
              ) : (
                <p className="text-[9px] text-muted-foreground">{t('insertCharHint')}</p>
              )}
            </div>
          </div>
        )}

        {isText && (hasLinkedTarget || ui?.limit_to_target) && (
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label className="text-xs">{t('limitToTarget')}</Label>
              <p className="text-[10px] text-muted-foreground">{t('limitToTargetHint')}</p>
            </div>
            <ToggleSwitch
              checked={!!ui?.limit_to_target}
              onChange={(next) => set({ limit_to_target: next || undefined })}
              label={t('limitToTarget')}
            />
          </div>
        )}

        {type === 'CHECKBOX_GROUP' && (
          <div className="space-y-1.5">
            <Label className="text-xs">{t('defaultChecked')}</Label>
            {optionValues.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">{t('needOptions')}</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {optionValues.map((opt) => {
                  const list = ui?.default_checked ?? [];
                  return (
                    <label key={opt} className="flex cursor-pointer items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        className="rounded accent-primary"
                        checked={list.includes(opt)}
                        onChange={() => {
                          const next = list.includes(opt) ? list.filter((x) => x !== opt) : [...list, opt];
                          // Kept in option order, like the evaluator canonicalises values.
                          const ordered = optionValues.filter((x) => next.includes(x));
                          set({ default_checked: ordered.length > 0 ? ordered : undefined });
                        }}
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-[9px] text-muted-foreground">{t('defaultCheckedHint')}</p>
          </div>
        )}

        {type === 'COLOR_PALETTE' && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('paletteSource')}</Label>
                <SearchableSelect
                  value={paletteSource}
                  onChange={(v) =>
                    set(
                      v === 'option'
                        ? { palette_from_option: variantOptions.find((o) => o.style === 'color')?.name ?? variantOptions[0]?.name ?? '' }
                        : { palette_from_option: undefined },
                    )
                  }
                  options={[
                    { value: 'option', label: t('paletteFromOption'), description: t('paletteFromOptionHint') },
                    { value: 'static', label: t('paletteStatic'), description: t('paletteStaticHint') },
                  ]}
                />
              </div>
              {paletteSource === 'option' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('paletteOption')}</Label>
                  <SearchableSelect
                    value={ui?.palette_from_option ?? ''}
                    onChange={(v) => set({ palette_from_option: v })}
                    placeholder={t('pickOption')}
                    options={variantOptions.map((o) => ({ value: o.name, label: o.name, description: o.style }))}
                  />
                </div>
              )}
            </div>
            {paletteSource === 'static' && (
              optionValues.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">{t('needOptions')}</p>
              ) : (
                <div className="divide-y rounded-md border">
                  {optionValues.map((opt) => {
                    const hex = ui?.palette_hex?.[opt];
                    return (
                      <div key={opt} className="flex items-center gap-2 px-2 py-1">
                        <input
                          type="color"
                          className="h-6 w-8 cursor-pointer rounded border"
                          value={isHexColor(hex) && hex.length === 7 ? hex : '#cccccc'}
                          onChange={(e) => set({ palette_hex: { ...(ui?.palette_hex ?? {}), [opt]: e.target.value } })}
                          aria-label={opt}
                        />
                        <span className="w-36 shrink-0 truncate text-xs" title={opt}>{opt}</span>
                        <Input
                          className="h-7 w-28 font-mono text-xs"
                          dir="ltr"
                          placeholder="#cccccc"
                          value={hex ?? ''}
                          onChange={(e) => {
                            const map = { ...(ui?.palette_hex ?? {}) };
                            if (e.target.value === '') delete map[opt];
                            else map[opt] = e.target.value;
                            set({ palette_hex: Object.keys(map).length > 0 ? map : undefined });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        )}

        {type === 'REPEATER' && (
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label className="text-xs">{t('validationSummary')}</Label>
              <p className="text-[10px] text-muted-foreground">{t('validationSummaryHint')}</p>
            </div>
            <ToggleSwitch
              checked={!!ui?.validation_summary}
              onChange={(next) => set({ validation_summary: next || undefined })}
              label={t('validationSummary')}
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground">{t('textsTitle')}</p>
        {localeBar}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('displayLabel')}</Label>
            <Input className="h-8 text-sm" dir={dir} value={extras.display_label} onChange={(e) => onExtrasChange({ display_label: e.target.value })} />
            <p className="text-[9px] text-muted-foreground">{t('displayLabelHint')}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('sublabel')}</Label>
            <Input className="h-8 text-sm" dir={dir} value={extras.sublabel} onChange={(e) => onExtrasChange({ sublabel: e.target.value })} />
            <p className="text-[9px] text-muted-foreground">{t('sublabelHint')}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('note')}</Label>
          <Input className="h-8 text-sm" dir={dir} value={extras.note} onChange={(e) => onExtrasChange({ note: e.target.value })} />
          <p className="text-[9px] text-muted-foreground">{t('noteHint')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('helpText')}</Label>
            <Textarea
              rows={4}
              className="text-sm"
              dir={dir}
              value={extras.help_text}
              onChange={(e) => onExtrasChange({ help_text: e.target.value })}
            />
            <p className="text-[9px] text-muted-foreground">{t('helpTextHint')}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('helpImage')}</Label>
            {extras.help_image_url ? (
              <div className="relative h-28 overflow-hidden rounded-md border bg-zinc-50">
                {/* eslint-disable-next-line @next/next/no-img-element -- merchant media URL */}
                <img src={resolveMediaUrl(extras.help_image_url)} alt="" className="h-full w-full object-contain" />
                <button
                  type="button"
                  className="absolute end-1 top-1 rounded bg-white/90 p-0.5 text-zinc-500 hover:text-red-600"
                  aria-label={t('removeImage')}
                  onClick={() => onExtrasChange({ help_image_url: '' })}
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-28 w-full flex-col gap-1 text-[10px] text-muted-foreground"
                disabled={uploading}
                onClick={async () => {
                  const url = await onPickImage();
                  if (url) onExtrasChange({ help_image_url: url });
                }}
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
                {t('uploadImage')}
              </Button>
            )}
          </div>
        </div>

        {messageKeysFor(type, hasLinkedTarget).length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">{t('messages')}</Label>
            <p className="text-[9px] text-muted-foreground">{t('messagesHint')}</p>
            <div className="divide-y rounded-md border">
              {messageKeysFor(type, hasLinkedTarget).map((key) => (
                <div key={key} className="flex items-center gap-2 px-2 py-1">
                  <span className="w-32 shrink-0 text-[10px] text-zinc-500">{t(`messageKeys.${key}`)}</span>
                  <Input
                    className="h-7 text-xs"
                    dir={dir}
                    value={extras.messages[key] ?? ''}
                    onChange={(e) => onExtrasChange({ messages: { ...extras.messages, [key]: e.target.value } })}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
