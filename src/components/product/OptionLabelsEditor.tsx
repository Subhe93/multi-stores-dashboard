'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  OPTION_NAME_LABEL_MAX,
  OPTION_VALUE_LABEL_MAX,
  withNameLabel,
  withValueLabel,
  type FormOptionLabels,
  type OptionListEntry,
} from '@/lib/variantOptionLabels';

interface OptionLabelsEditorProps {
  /** Options of the product (canonical names and values). */
  optionList: OptionListEntry[];
  /** Labels of the language being edited (undefined = none yet). */
  labels: FormOptionLabels | undefined;
  onChange: (next: FormOptionLabels) => void;
  /** Display name of the language being edited. */
  languageLabel: string;
  /** The language has a translated title (labels are saved with that row). */
  hasTitle: boolean;
  isRtl: boolean;
  /** Swatch colour per option name and value (colour options), for orientation. */
  colorMaps?: Record<string, Record<string, string> | undefined>;
}

/**
 * M159: per-language display labels of the variant option names and values.
 * Shown under the language tabs for every language but the store's primary
 * one; each placeholder is the canonical text, so an empty field simply
 * shows the original name to shoppers.
 */
export function OptionLabelsEditor({
  optionList,
  labels,
  onChange,
  languageLabel,
  hasTitle,
  isRtl,
  colorMaps,
}: OptionLabelsEditorProps) {
  const t = useTranslations('product');
  if (optionList.length === 0) return null;

  return (
    <div id="product-option-labels" className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="space-y-0.5">
        <Label className="text-xs">{t('optionLabelsTitle')}</Label>
        <p className="text-[10px] text-muted-foreground leading-snug">
          {hasTitle
            ? t('optionLabelsHelp', { language: languageLabel })
            : t('optionLabelsNeedTitle', { language: languageLabel })}
        </p>
      </div>
      {hasTitle && (
        <div className="space-y-3">
          {optionList.map((o) => (
            <div key={o.name} className="space-y-1.5">
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,10rem)_1fr] items-center gap-1.5 sm:gap-3">
                <span className="text-[11px] font-medium truncate" title={o.name}>
                  {o.name}
                  <span className="ms-1 font-normal text-muted-foreground">· {t('optionLabelsName')}</span>
                </span>
                <Input
                  dir={isRtl ? 'rtl' : 'ltr'}
                  className="h-8 text-sm"
                  maxLength={OPTION_NAME_LABEL_MAX}
                  aria-label={`${t('optionLabelsName')}: ${o.name}`}
                  value={labels?.names[o.name] ?? ''}
                  placeholder={o.name}
                  onChange={(e) => onChange(withNameLabel(labels, o.name, e.target.value))}
                />
              </div>
              {o.values.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,10rem)_1fr] gap-1.5 sm:gap-3">
                  <span className="text-[11px] text-muted-foreground pt-1.5">{t('optionLabelsValues')}</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {o.values.map((v) => {
                      const hex = colorMaps?.[o.name]?.[v];
                      return (
                        <div key={v} className="flex items-center gap-1.5 min-w-0">
                          {hex && (
                            <span
                              aria-hidden
                              className="h-3.5 w-3.5 shrink-0 rounded-full border border-border"
                              style={{ backgroundColor: hex }}
                            />
                          )}
                          <Input
                            dir={isRtl ? 'rtl' : 'ltr'}
                            className="h-8 text-sm"
                            maxLength={OPTION_VALUE_LABEL_MAX}
                            aria-label={`${o.name}: ${v}`}
                            value={labels?.values[o.name]?.[v] ?? ''}
                            placeholder={v}
                            onChange={(e) => onChange(withValueLabel(labels, o.name, v, e.target.value))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
