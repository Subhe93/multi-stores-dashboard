'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { MAX_REPEAT, optionValueCount, type OptionConfigLike, type PRepeat } from '@/lib/personalization';
import type { ConditionFieldRef } from './FieldConditionsEditor';

interface FieldRepeatEditorProps {
  value: PRepeat | null;
  onChange: (next: PRepeat) => void;
  variantOptions: OptionConfigLike[];
  /** Top-level fields before the repeater (lead item candidates). */
  earlierFields: ConditionFieldRef[];
}

export const DEFAULT_REPEAT: PRepeat = { count: { option: '' }, start_index: 1, max: 5 };

/** True when the count option is set and the bounds are 1..20. */
export function repeatValid(r: PRepeat | null): boolean {
  if (!r) return false;
  const inRange = (n: number) => Number.isInteger(n) && n >= 1 && n <= MAX_REPEAT;
  return !!r.count.option && inRange(r.start_index) && inRange(r.max);
}

/**
 * "Repeat" tab of a REPEATER field: how many item blocks to show (from the
 * chosen value of a variant option, D6), the first item number and the
 * optional lead item built from earlier fields and options (D11).
 */
export function FieldRepeatEditor({ value, onChange, variantOptions, earlierFields }: FieldRepeatEditorProps) {
  const t = useTranslations('customField.repeat');
  const r = value ?? DEFAULT_REPEAT;
  const option = variantOptions.find((o) => o.name === r.count.option);
  const lead = r.lead ?? { fields: [], options: [] };

  const set = (patch: Partial<PRepeat>) => onChange({ ...r, ...patch });
  const setLead = (next: { fields: string[]; options: string[] }) =>
    set({ lead: next.fields.length === 0 && next.options.length === 0 ? undefined : next });
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const optionChoices = variantOptions.map((o) => ({ value: o.name, label: o.name }));
  if (r.count.option && !option) optionChoices.push({ value: r.count.option, label: r.count.option });

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">{t('hint')}</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('countOption')}<span className="text-red-500"> *</span></Label>
          {optionChoices.length > 0 ? (
            <SearchableSelect
              value={r.count.option}
              onChange={(v) => set({ count: { option: v } })}
              placeholder={t('pickOption')}
              options={optionChoices}
            />
          ) : (
            <p className="text-[10px] text-amber-700">{t('noOptions')}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('startIndex')}</Label>
          <Input
            type="number"
            min={1}
            max={MAX_REPEAT}
            className="h-8 text-sm"
            value={Number.isFinite(r.start_index) ? String(r.start_index) : ''}
            onChange={(e) => set({ start_index: e.target.value === '' ? NaN : Number(e.target.value) })}
          />
          <p className="text-[9px] text-muted-foreground">{t('startIndexHint')}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('max')}</Label>
          <Input
            type="number"
            min={1}
            max={MAX_REPEAT}
            className="h-8 text-sm"
            value={Number.isFinite(r.max) ? String(r.max) : ''}
            onChange={(e) => set({ max: e.target.value === '' ? NaN : Number(e.target.value) })}
          />
        </div>
      </div>

      {option && (
        <div className="space-y-1.5">
          <Label className="text-xs">{t('countMap')}</Label>
          <div className="divide-y rounded-md border">
            {option.values.map((val) => (
              <div key={val} className="flex items-center gap-2 px-2 py-1">
                <span className="w-40 shrink-0 truncate text-xs" title={val}>{val}</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="h-7 w-24 text-xs"
                  placeholder={String(optionValueCount(option, val))}
                  value={typeof r.count.map?.[val] === 'number' ? String(r.count.map[val]) : ''}
                  onChange={(e) => {
                    const map = { ...(r.count.map ?? {}) };
                    if (e.target.value === '') delete map[val];
                    else map[val] = Number(e.target.value);
                    set({ count: { option: r.count.option, ...(Object.keys(map).length > 0 ? { map } : {}) } });
                  }}
                />
              </div>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground">{t('countMapHint')}</p>
        </div>
      )}

      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-xs font-semibold">{t('leadTitle')}</p>
        <p className="text-[10px] text-muted-foreground">{t('leadHint')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">{t('leadFields')}</Label>
            {earlierFields.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">{t('noEarlierFields')}</p>
            ) : (
              earlierFields.map((f) => (
                <label key={f.name} className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    className="rounded accent-primary"
                    checked={lead.fields.includes(f.name)}
                    onChange={() => setLead({ ...lead, fields: toggle(lead.fields, f.name) })}
                  />
                  {f.label} <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">{f.name}</span>
                </label>
              ))
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">{t('leadOptions')}</Label>
            {variantOptions.map((o) => (
              <label key={o.name} className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  className="rounded accent-primary"
                  checked={lead.options.includes(o.name)}
                  onChange={() => setLead({ ...lead, options: toggle(lead.options, o.name) })}
                />
                {o.name}
              </label>
            ))}
          </div>
        </div>
      </div>

      {!repeatValid(r) && <p className="text-[10px] text-red-600">{t('invalid', { max: MAX_REPEAT })}</p>}
    </div>
  );
}
