'use client';

import { useTranslations } from 'next-intl';
import { ImageIcon, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { TagInput } from '@/components/common/TagInput';
import { resolveMediaUrl } from '@/lib/media';
import { useAuth } from '@/lib/auth';
import { useImageUpload } from '@/lib/useImageUpload';
import { isPlainObject } from '@/lib/customFields';
import { optionValueCount, type OptionConfigLike, type PresetParam } from '@/lib/personalization';

interface PresetParamsFormProps {
  presetKey: string;
  params: PresetParam[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  /** Variant options of the target product (option pickers). */
  options: OptionConfigLike[];
  /** Store content locales (primary first), for the `locale` param. */
  locales?: string[];
  primaryLocale?: string;
}

/** Native names of the platform locales; other codes show upper-cased. */
const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
  tr: 'Türkçe',
  de: 'Deutsch',
  fr: 'Français',
  sv: 'Svenska',
};
const localeName = (code: string) => LOCALE_NAMES[code] ?? code.toUpperCase();

/** Translated label of a param: `presets.items.<preset>.params.<key>`, else the generic one, else the key. */
function useParamLabel(presetKey: string) {
  const t = useTranslations('creator.personalization.presets');
  return (key: string, suffix: '' | 'Hint' = '') => {
    const specific = `items.${presetKey}.params.${key}${suffix}`;
    if (t.has(specific)) return t(specific);
    const generic = `params.${key}${suffix}`;
    if (t.has(generic)) return t(generic);
    return suffix ? '' : key;
  };
}

/**
 * Form for the params of one preset, built from `PresetSummary.params`
 * (§4.5). Option params pick from the product's `variant_option_config`.
 */
export function PresetParamsForm({ presetKey, params, values, onChange, options, locales = [], primaryLocale }: PresetParamsFormProps) {
  const t = useTranslations('creator.personalization.presets');
  const label = useParamLabel(presetKey);
  const { token } = useAuth();
  const { pickAndUpload, uploading } = useImageUpload(token);

  const set = (key: string, v: unknown) => onChange({ ...values, [key]: v });
  const optionNames = options.map((o) => o.name);

  if (params.length === 0) return <p className="text-xs text-muted-foreground">{t('noParams')}</p>;

  return (
    <div className="space-y-4">
      {params.map((p) => {
        const v = values[p.key];
        const hint = label(p.key, 'Hint');
        const head = (
          <Label className="text-xs">
            {label(p.key)}
            {p.required && <span className="text-red-500"> *</span>}
          </Label>
        );

        switch (p.type) {
          case 'boolean':
            return (
              <div key={p.key} className="flex items-start justify-between gap-3">
                <div>
                  {head}
                  {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
                </div>
                <ToggleSwitch checked={v === true} onChange={(next) => set(p.key, next)} label={label(p.key)} />
              </div>
            );

          case 'option': {
            const current = typeof v === 'string' ? v : '';
            const opts = optionNames.map((n) => ({ value: n, label: n }));
            // A default that is not an option of this product stays visible so it can be replaced.
            if (current && !optionNames.includes(current)) {
              opts.push({ value: current, label: current, description: t('optionMissing') } as { value: string; label: string; description?: string });
            }
            return (
              <div key={p.key} className="space-y-1.5">
                {head}
                {opts.length > 0 ? (
                  <SearchableSelect value={current} onChange={(next) => set(p.key, next)} options={opts} placeholder={t('pickOption')} />
                ) : (
                  <p className="text-[10px] text-amber-700">{t('noOptions')}</p>
                )}
                {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
              </div>
            );
          }

          case 'enum':
            return (
              <div key={p.key} className="space-y-1.5">
                {head}
                <SearchableSelect
                  value={typeof v === 'string' ? v : ''}
                  onChange={(next) => set(p.key, next)}
                  options={(p.values ?? []).map((val) => ({
                    value: val,
                    label: t.has(`enum.${val}`) ? t(`enum.${val}`) : val,
                  }))}
                />
                {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
              </div>
            );

          case 'number':
            return (
              <div key={p.key} className="max-w-48 space-y-1.5">
                {head}
                <Input
                  type="number"
                  className="h-8 text-sm"
                  min={p.min}
                  max={p.max}
                  value={typeof v === 'number' && Number.isFinite(v) ? String(v) : ''}
                  onChange={(e) => set(p.key, e.target.value === '' ? undefined : Number(e.target.value))}
                />
                {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
              </div>
            );

          case 'string':
            // The `locale` param picks one of the store's content locales;
            // empty means the store's primary locale (API default).
            if (p.key === 'locale') {
              const current = typeof v === 'string' ? v : '';
              const primary = primaryLocale ?? locales[0] ?? '';
              const choices = [
                { value: '', label: t('localeDefault', { locale: primary ? localeName(primary) : '—' }) },
                ...locales.map((code) => ({ value: code, label: localeName(code) })),
              ];
              if (current && !locales.includes(current)) choices.push({ value: current, label: localeName(current) });
              return (
                <div key={p.key} className="max-w-xs space-y-1.5">
                  {head}
                  <SearchableSelect value={current} onChange={(next) => set(p.key, next)} options={choices} />
                  {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
                </div>
              );
            }
            return (
              <div key={p.key} className="space-y-1.5">
                {head}
                <Input className="h-8 text-sm" dir="auto" value={typeof v === 'string' ? v : ''} onChange={(e) => set(p.key, e.target.value)} />
                {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
              </div>
            );

          case 'string_list': {
            const list = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
            return (
              <div key={p.key} className="space-y-1.5">
                {head}
                <TagInput tags={list} onChange={(next) => set(p.key, next)} placeholder={t('addValue')} />
                {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
              </div>
            );
          }

          case 'checked_list': {
            const source = p.ref && Array.isArray(values[p.ref])
              ? (values[p.ref] as unknown[]).filter((x): x is string => typeof x === 'string')
              : [];
            const all = v === 'all' || v === undefined;
            const checked = all ? source : Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
            const toggle = (opt: string) => {
              const next = checked.includes(opt) ? checked.filter((x) => x !== opt) : [...checked, opt];
              set(p.key, next.length === source.length ? 'all' : source.filter((x) => next.includes(x)));
            };
            return (
              <div key={p.key} className="space-y-1.5">
                {head}
                {source.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground">{t('checkedListEmpty')}</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {source.map((opt) => (
                      <label key={opt} className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <input type="checkbox" className="rounded accent-primary" checked={checked.includes(opt)} onChange={() => toggle(opt)} />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}
                {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
              </div>
            );
          }

          case 'option_value_map': {
            const optName = p.ref && typeof values[p.ref] === 'string' ? (values[p.ref] as string) : '';
            const option = options.find((o) => o.name === optName);
            const map = isPlainObject(v) ? (v as Record<string, number>) : {};
            return (
              <div key={p.key} className="space-y-1.5">
                {head}
                {!option ? (
                  <p className="text-[10px] text-muted-foreground">{t('pickOptionFirst')}</p>
                ) : (
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
                          value={typeof map[val] === 'number' ? String(map[val]) : ''}
                          onChange={(e) => {
                            const next = { ...map };
                            if (e.target.value === '') delete next[val];
                            else next[val] = Number(e.target.value);
                            set(p.key, next);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">{hint || t('countMapHint')}</p>
              </div>
            );
          }

          case 'image_map': {
            const map = isPlainObject(v) ? (v as Record<string, string>) : {};
            const setUrl = (k: string, url: string | null) => {
              const next = { ...map };
              if (url) next[k] = url;
              else delete next[k];
              set(p.key, next);
            };
            return (
              <div key={p.key} className="space-y-1.5">
                {head}
                <div className="grid gap-2 sm:grid-cols-3">
                  {(p.keys ?? []).map((k) => (
                    <div key={k} className="space-y-1">
                      <p className="font-mono text-[10px] text-muted-foreground">{k}</p>
                      {map[k] ? (
                        <div className="relative h-20 overflow-hidden rounded border bg-zinc-50">
                          {/* eslint-disable-next-line @next/next/no-img-element -- merchant media URL */}
                          <img src={resolveMediaUrl(map[k])} alt={k} className="h-full w-full object-contain" />
                          <button
                            type="button"
                            className="absolute end-1 top-1 rounded bg-white/90 p-0.5 text-zinc-500 hover:text-red-600"
                            aria-label={t('removeImage')}
                            onClick={() => setUrl(k, null)}
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-20 w-full text-xs"
                          disabled={uploading}
                          onClick={async () => {
                            const imgs = await pickAndUpload('products', false);
                            if (imgs[0]) setUrl(k, imgs[0].url);
                          }}
                        >
                          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
              </div>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}
