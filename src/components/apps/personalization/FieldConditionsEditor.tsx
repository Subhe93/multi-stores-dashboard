'use client';

import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import {
  CONDITION_OPS,
  LIST_OPS,
  NUMERIC_OPS,
  VALUELESS_OPS,
  type ConditionOp,
  type OptionConfigLike,
  type PConditionRule,
  type PConditions,
} from '@/lib/personalization';

/** A field a rule may read: top-level and earlier than the edited field (D8). */
export interface ConditionFieldRef {
  name: string;
  label: string;
  options?: string[] | null;
}

interface FieldConditionsEditorProps {
  value: PConditions | null;
  onChange: (next: PConditions | null) => void;
  variantOptions: OptionConfigLike[];
  earlierFields: ConditionFieldRef[];
}

const emptyRule = (variantOptions: OptionConfigLike[]): PConditionRule => ({
  source: variantOptions.length > 0 ? 'option' : 'field',
  key: variantOptions[0]?.name ?? '',
  op: 'eq',
  value: '',
});

/** Keeps the value shape in line with the op (list for in/nin, number for gt…, none for set/unset). */
function coerceValue(op: ConditionOp, value: PConditionRule['value']): PConditionRule['value'] {
  if (VALUELESS_OPS.includes(op)) return undefined;
  if (LIST_OPS.includes(op)) {
    if (Array.isArray(value)) return value;
    return value === undefined || value === '' ? [] : [String(value)];
  }
  if (NUMERIC_OPS.includes(op)) {
    const n = Array.isArray(value) ? Number(value[0]) : Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

/** True when every rule has a key and the value its op needs. */
export function conditionsComplete(c: PConditions | null): boolean {
  if (!c) return true;
  return c.rules.every((r) => {
    if (!r.key) return false;
    if (VALUELESS_OPS.includes(r.op)) return true;
    if (LIST_OPS.includes(r.op)) return Array.isArray(r.value) && r.value.length > 0;
    if (NUMERIC_OPS.includes(r.op)) return typeof r.value === 'number' && Number.isFinite(r.value);
    return typeof r.value === 'string' ? r.value !== '' : r.value !== undefined;
  });
}

/**
 * "Visibility" tab of the field dialog: show the field only when the rules
 * match (all / any). Sources are variant options of the product or earlier
 * fields (§3.3). A hidden field is not required and its value is dropped.
 */
export function FieldConditionsEditor({ value, onChange, variantOptions, earlierFields }: FieldConditionsEditorProps) {
  const t = useTranslations('customField.visibility');
  const tOps = useTranslations('customField.ops');
  const rules = value?.rules ?? [];
  const match = value?.match ?? 'all';

  const setRules = (next: PConditionRule[]) => onChange(next.length > 0 ? { match, rules: next } : null);
  const setRule = (i: number, patch: Partial<PConditionRule>) =>
    setRules(rules.map((r, j) => {
      if (j !== i) return r;
      const merged = { ...r, ...patch };
      merged.value = coerceValue(merged.op, merged.value);
      return merged;
    }));

  const valuesFor = (rule: PConditionRule): string[] | null => {
    if (rule.source === 'option') return variantOptions.find((o) => o.name === rule.key)?.values ?? null;
    const f = earlierFields.find((x) => x.name === rule.key);
    return f?.options && f.options.length > 0 ? f.options : null;
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t('hint')}</p>

      {rules.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed py-6 text-center text-xs text-muted-foreground">{t('alwaysVisible')}</div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs">
            <span>{t('showWhen')}</span>
            <div className="w-40">
              <SearchableSelect
                value={match}
                onChange={(v) => onChange({ match: v === 'any' ? 'any' : 'all', rules })}
                options={[
                  { value: 'all', label: t('matchAll') },
                  { value: 'any', label: t('matchAny') },
                ]}
              />
            </div>
          </div>
          <div className="space-y-2">
            {rules.map((rule, i) => {
              const choices = valuesFor(rule);
              const keyOptions: { value: string; label: string; description?: string }[] =
                rule.source === 'option'
                  ? variantOptions.map((o) => ({ value: o.name, label: o.name }))
                  : earlierFields.map((f) => ({ value: f.name, label: f.label, description: f.name }));
              if (rule.key && !keyOptions.some((o) => o.value === rule.key)) {
                keyOptions.push({ value: rule.key, label: rule.key, description: t('missingKey') });
              }
              return (
                <div key={i} className="grid grid-cols-[7rem_minmax(0,1fr)_8rem_minmax(0,1fr)_auto] items-start gap-2 rounded-lg border bg-zinc-50 p-2">
                  <SearchableSelect
                    value={rule.source}
                    onChange={(v) => {
                      const source = v === 'field' ? 'field' : 'option';
                      const key = source === 'option' ? variantOptions[0]?.name ?? '' : earlierFields[0]?.name ?? '';
                      setRule(i, { source, key, value: coerceValue(rule.op, '') });
                    }}
                    options={[
                      { value: 'option', label: t('sourceOption') },
                      { value: 'field', label: t('sourceField') },
                    ]}
                  />
                  <SearchableSelect
                    value={rule.key}
                    onChange={(v) => setRule(i, { key: v, value: coerceValue(rule.op, '') })}
                    placeholder={rule.source === 'option' ? t('pickOption') : t('pickField')}
                    options={keyOptions}
                  />
                  <SearchableSelect
                    value={rule.op}
                    onChange={(v) => setRule(i, { op: v as ConditionOp })}
                    options={CONDITION_OPS.map((op) => ({ value: op, label: tOps(op) }))}
                  />
                  <div>
                    {VALUELESS_OPS.includes(rule.op) ? (
                      <span className="block py-2 text-[10px] text-muted-foreground">—</span>
                    ) : NUMERIC_OPS.includes(rule.op) ? (
                      <>
                        <Input
                          type="number"
                          className="h-8 text-sm"
                          value={typeof rule.value === 'number' ? String(rule.value) : ''}
                          onChange={(e) => setRule(i, { value: e.target.value === '' ? undefined : Number(e.target.value) })}
                        />
                        {rule.source === 'option' && <p className="mt-0.5 text-[9px] text-muted-foreground">{t('countHint')}</p>}
                      </>
                    ) : LIST_OPS.includes(rule.op) ? (
                      choices ? (
                        <div className="flex max-h-28 flex-wrap gap-x-3 gap-y-1 overflow-y-auto rounded-md border bg-white p-1.5">
                          {choices.map((c) => {
                            const list = Array.isArray(rule.value) ? rule.value : [];
                            return (
                              <label key={c} className="flex cursor-pointer items-center gap-1 text-[11px]">
                                <input
                                  type="checkbox"
                                  className="rounded accent-primary"
                                  checked={list.includes(c)}
                                  onChange={() =>
                                    setRule(i, { value: list.includes(c) ? list.filter((x) => x !== c) : [...list, c] })
                                  }
                                />
                                {c}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <Input
                          className="h-8 text-sm"
                          placeholder={t('listPlaceholder')}
                          value={Array.isArray(rule.value) ? rule.value.join(', ') : ''}
                          onChange={(e) =>
                            setRule(i, { value: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
                          }
                        />
                      )
                    ) : choices ? (
                      <SearchableSelect
                        value={typeof rule.value === 'string' ? rule.value : ''}
                        onChange={(v) => setRule(i, { value: v })}
                        placeholder={t('pickValue')}
                        options={choices.map((c) => ({ value: c, label: c }))}
                      />
                    ) : (
                      <Input
                        className="h-8 text-sm"
                        value={typeof rule.value === 'string' ? rule.value : ''}
                        onChange={(e) => setRule(i, { value: e.target.value })}
                      />
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-red-500"
                    aria-label={t('removeRule')}
                    onClick={() => setRules(rules.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {variantOptions.length === 0 && earlierFields.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">{t('noSources')}</p>
      ) : (
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setRules([...rules, emptyRule(variantOptions)])}>
          <Plus className="me-1 size-3" /> {t('addRule')}
        </Button>
      )}
      {!conditionsComplete(value) && <p className="text-[10px] text-red-600">{t('incomplete')}</p>}
    </div>
  );
}
