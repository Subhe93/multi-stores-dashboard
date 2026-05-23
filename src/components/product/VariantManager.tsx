'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { Plus, Trash2, X, ImageIcon, Pencil, Package } from 'lucide-react';
import type { UploadedImage } from '@/lib/useImageUpload';
import { useCurrency } from '@/lib/useCurrency';

type Translator = ReturnType<typeof useTranslations>;

export interface VariantOption {
  name: string;
  style: 'text' | 'color' | 'image';
  values: string[];
  colorMap?: Record<string, string>;
  dualColorMap?: Record<string, [string, string]>;
}

export interface GeneratedVariant {
  id?: string;
  _key: string;
  options: Record<string, string>;
  price: number;
  compare_at_price: number;
  sku: string;
  stock_quantity: number | null;
  is_active: boolean;
  image_url?: string;
}

interface VariantManagerProps {
  options: VariantOption[];
  onOptionsChange: (options: VariantOption[]) => void;
  variants: GeneratedVariant[];
  onVariantsChange: (variants: GeneratedVariant[]) => void;
  basePrice?: number;
  onPickImage?: () => Promise<UploadedImage[]>;
}

function generateCombinations(options: VariantOption[]): Record<string, string>[] {
  const filtered = options.filter(o => o.name && o.values.length > 0);
  if (filtered.length === 0) return [];
  return filtered.reduce<Record<string, string>[]>(
    (combos, option) => {
      if (combos.length === 0) return option.values.map(v => ({ [option.name]: v }));
      const out: Record<string, string>[] = [];
      for (const c of combos) for (const v of option.values) out.push({ ...c, [option.name]: v });
      return out;
    }, [],
  );
}

// Color swatch component — handles single and dual colors
function ColorSwatch({ hex, dualHex, size = 16, className = '' }: { hex?: string; dualHex?: [string, string]; size?: number; className?: string }) {
  if (dualHex) {
    return (
      <span
        className={`inline-block rounded-full border border-gray-200 shrink-0 ${className}`}
        style={{
          width: size, height: size,
          background: `linear-gradient(135deg, ${dualHex[0]} 50%, ${dualHex[1]} 50%)`,
        }}
      />
    );
  }
  return (
    <span
      className={`inline-block rounded-full border border-gray-200 shrink-0 ${className}`}
      style={{ width: size, height: size, backgroundColor: hex || '#ccc' }}
    />
  );
}

const PRESET_COLORS = [
  '#000000', '#ffffff', '#7f7f7f', '#c0c0c0',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#a16207', '#1e293b', '#dc2626', '#16a34a',
];

const HEX_RE = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

function normalizeHex(input: string): string | null {
  const m = input.trim().match(HEX_RE);
  if (!m) return null;
  let hex = m[1]!;
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  return '#' + hex.toLowerCase();
}

// Shopify-style color editor popover — single click to set primary, optional second color for dual.
function ColorEditorPopover({
  value,
  hex,
  dualHex,
  onChange,
  children,
  t,
}: {
  value: string;
  hex?: string;
  dualHex?: [string, string];
  onChange: (next: { hex?: string; dualHex?: [string, string] }) => void;
  children: React.ReactNode;
  t: Translator;
}) {
  const isDual = !!dualHex;
  const primary = isDual ? dualHex![0] : (hex || '#000000');
  const secondary = isDual ? dualHex![1] : '#ffffff';

  const [hexInput, setHexInput] = useState(primary);
  const [hexInput2, setHexInput2] = useState(secondary);

  useEffect(() => { setHexInput(primary); }, [primary]);
  useEffect(() => { setHexInput2(secondary); }, [secondary]);

  const setPrimary = (h: string) => {
    if (isDual) onChange({ dualHex: [h, secondary] });
    else onChange({ hex: h });
  };
  const setSecondary = (h: string) => {
    onChange({ dualHex: [primary, h] });
  };
  const enableDual = () => onChange({ dualHex: [primary, '#ffffff'] });
  const disableDual = () => onChange({ hex: primary });

  return (
    <Popover>
      <PopoverTrigger
        className="rounded-full ring-1 ring-zinc-200 hover:ring-blue-400 transition shrink-0"
        title={t('variant.editColor')}
        style={{ height: '18px' }}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ColorSwatch hex={isDual ? undefined : primary} dualHex={isDual ? [primary, secondary] : undefined} size={28} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">{value || t('variant.untitledColor')}</p>
              <p className="text-[10px] text-muted-foreground">
                {isDual ? t('variant.twoToneColor') : t('variant.solidColor')}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t('variant.primaryColor')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                className="w-10 h-9 rounded border border-input cursor-pointer p-0.5"
              />
              <Input
                value={hexInput}
                onChange={(e) => {
                  setHexInput(e.target.value);
                  const norm = normalizeHex(e.target.value);
                  if (norm) setPrimary(norm);
                }}
                className="h-9 text-xs font-mono uppercase"
                placeholder="#000000"
                maxLength={7}
              />
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPrimary(c)}
                  className="w-5 h-5 rounded-full border border-zinc-200 hover:scale-110 transition"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {isDual && (
            <div className="space-y-2 pt-1 border-t">
              <div className="flex items-center justify-between pt-2">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t('variant.secondColor')}</Label>
                <button
                  type="button"
                  onClick={disableDual}
                  className="text-[10px] text-red-600 hover:underline"
                >
                  {t('common.remove')}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondary}
                  onChange={(e) => setSecondary(e.target.value)}
                  className="w-10 h-9 rounded border border-input cursor-pointer p-0.5"
                />
                <Input
                  value={hexInput2}
                  onChange={(e) => {
                    setHexInput2(e.target.value);
                    const norm = normalizeHex(e.target.value);
                    if (norm) setSecondary(norm);
                  }}
                  className="h-9 text-xs font-mono uppercase"
                  placeholder="#ffffff"
                  maxLength={7}
                />
              </div>
            </div>
          )}

          {!isDual && (
            <button
              type="button"
              onClick={enableDual}
              className="w-full text-xs text-primary hover:underline flex items-center justify-center gap-1 py-1 border-t pt-2"
            >
              <Plus className="w-3 h-3" /> {t('variant.addSecondColor')}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function VariantManager({ options, onOptionsChange, variants, onVariantsChange, basePrice = 0, onPickImage }: VariantManagerProps) {
  const t = useTranslations();
  const { currency } = useCurrency();
  const [newValue, setNewValue] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Bulk edit dialogs
  const [showBulkPrice, setShowBulkPrice] = useState(false);
  const [showBulkStock, setShowBulkStock] = useState(false);
  const [bulkPriceVal, setBulkPriceVal] = useState('');
  const [bulkCompareVal, setBulkCompareVal] = useState('');
  const [bulkStockVal, setBulkStockVal] = useState('');

  // Quick-action dialogs (Shopify-style: apply to ALL variants without selection)
  const [showSamePriceAll, setShowSamePriceAll] = useState(false);
  const [samePriceVal, setSamePriceVal] = useState('');
  const [sameCompareVal, setSameCompareVal] = useState('');

  const [showPricePerOption, setShowPricePerOption] = useState(false);
  const [pricePerOption, setPricePerOption] = useState<string>('');
  const [pricePerValueMap, setPricePerValueMap] = useState<Record<string, string>>({});
  const [comparePerValueMap, setComparePerValueMap] = useState<Record<string, string>>({});

  const combinations = useMemo(() => generateCombinations(options), [options]);

  const allFilterValues = useMemo(() => {
    const vals: { optionName: string; value: string }[] = [];
    options.forEach(o => o.values.forEach(v => vals.push({ optionName: o.name, value: v })));
    return vals;
  }, [options]);

  useEffect(() => {
    if (combinations.length === 0) { onVariantsChange([]); return; }
    const newVariants = combinations.map(combo => {
      const key = JSON.stringify(combo);
      const existing = variants.find(v => JSON.stringify(v.options) === key);
      return existing || {
        _key: `v-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        options: combo,
        price: basePrice,
        compare_at_price: 0,
        sku: '',
        stock_quantity: null,
        is_active: true,
      };
    });
    newVariants.forEach(v => { if (!v._key) v._key = `v-${Date.now()}-${Math.random().toString(36).slice(2)}`; });
    onVariantsChange(newVariants);
  }, [combinations]);

  const optionNames = options.filter(o => o.name).map(o => o.name);

  // Build a lookup: optionName → VariantOption (for color info)
  const optionByName = useMemo(() => {
    const map: Record<string, VariantOption> = {};
    options.forEach(o => { if (o.name) map[o.name] = o; });
    return map;
  }, [options]);

  const updateVariant = (key: string, field: keyof GeneratedVariant, value: any) => {
    onVariantsChange(variants.map(v => v._key === key ? { ...v, [field]: value } : v));
  };

  const deleteVariant = (key: string) => {
    onVariantsChange(variants.filter(v => v._key !== key));
    selected.delete(key);
    setSelected(new Set(selected));
  };

  const selectAll = () => setSelected(new Set(variants.map(v => v._key)));
  const selectNone = () => setSelected(new Set());
  const selectByValue = (optionName: string, value: string) => {
    setSelected(new Set(variants.filter(v => v.options[optionName] === value).map(v => v._key)));
  };

  const applyBulkPrice = () => {
    onVariantsChange(variants.map(v => {
      if (!selected.has(v._key)) return v;
      return {
        ...v,
        price: bulkPriceVal ? parseFloat(bulkPriceVal) : v.price,
        compare_at_price: bulkCompareVal ? parseFloat(bulkCompareVal) : v.compare_at_price,
      };
    }));
    setShowBulkPrice(false); setBulkPriceVal(''); setBulkCompareVal('');
  };

  const applyBulkStock = () => {
    onVariantsChange(variants.map(v => {
      if (!selected.has(v._key)) return v;
      return { ...v, stock_quantity: bulkStockVal ? parseInt(bulkStockVal) : null };
    }));
    setShowBulkStock(false); setBulkStockVal('');
  };

  const applyBulkImage = async () => {
    if (!onPickImage) return;
    const imgs = await onPickImage();
    if (!imgs.length) return;
    onVariantsChange(variants.map(v => {
      if (!selected.has(v._key)) return v;
      return { ...v, image_url: imgs[0]!.url };
    }));
  };

  const deleteSelected = () => {
    if (!confirm(t('variant.confirmDeleteSelected', { count: selected.size }))) return;
    onVariantsChange(variants.filter(v => !selected.has(v._key)));
    setSelected(new Set());
  };

  // Apply one price (and optional compare-at) to every variant — Shopify's
  // "set the same price for all" shortcut. No selection required.
  const applySamePriceAll = () => {
    const price = samePriceVal ? parseFloat(samePriceVal) : NaN;
    if (isNaN(price)) return;
    const compare = sameCompareVal ? parseFloat(sameCompareVal) : null;
    onVariantsChange(variants.map(v => ({
      ...v,
      price,
      compare_at_price: compare !== null && !isNaN(compare) ? compare : v.compare_at_price,
    })));
    setShowSamePriceAll(false);
    setSamePriceVal('');
    setSameCompareVal('');
  };

  // Open the per-option dialog with sensible defaults: pre-fill each value's
  // price from the first matching variant so the user sees the current state.
  const openPricePerOption = () => {
    const firstOption = optionNames[0] || '';
    setPricePerOption(firstOption);
    setPricePerValueMap({});
    setComparePerValueMap({});
    setShowPricePerOption(true);
  };

  // Apply per-option pricing: every variant whose options[selectedOption]
  // matches a key in the map gets that price. Variants without a price
  // entered for their value are left untouched.
  const applyPricePerOption = () => {
    if (!pricePerOption) return;
    onVariantsChange(variants.map(v => {
      const matchValue = v.options[pricePerOption];
      if (!matchValue) return v;
      const priceStr = pricePerValueMap[matchValue];
      const compareStr = comparePerValueMap[matchValue];
      const next = { ...v };
      if (priceStr && !isNaN(parseFloat(priceStr))) next.price = parseFloat(priceStr);
      if (compareStr && !isNaN(parseFloat(compareStr))) next.compare_at_price = parseFloat(compareStr);
      return next;
    }));
    setShowPricePerOption(false);
  };

  // Pricing status: are all variants priced the same, or do prices vary?
  const pricingStatus = useMemo(() => {
    if (variants.length === 0) return null;
    const prices = variants.map(v => Number(v.price) || 0);
    const first = prices[0];
    const allSame = prices.every(p => p === first);
    return { allSame, sharedPrice: allSame ? first : null };
  }, [variants]);

  // Values of the option currently chosen in the per-option dialog
  const selectedOptionValues = useMemo(() => {
    const opt = options.find(o => o.name === pricePerOption);
    return opt?.values || [];
  }, [options, pricePerOption]);

  // Add a value. For color options, the new chip starts with a default solid color
  // (#000000); the user clicks the chip's swatch to refine via the popover.
  const addValue = (oi: number) => {
    const val = (newValue[oi] || '').trim();
    if (!val) return;
    const opt = options[oi]!;
    if (opt.values.includes(val)) return;
    const u = [...options];
    const updated: VariantOption = { ...opt, values: [...opt.values, val] };
    if (opt.style === 'color') {
      updated.colorMap = { ...(opt.colorMap || {}), [val]: '#000000' };
    }
    u[oi] = updated;
    onOptionsChange(u);
    setNewValue({ ...newValue, [oi]: '' });
  };

  // Update color (single or dual) for a specific value
  const updateColorForValue = (
    oi: number,
    val: string,
    next: { hex?: string; dualHex?: [string, string] },
  ) => {
    const opt = options[oi]!;
    const u = [...options];
    const updated: VariantOption = { ...opt };
    const colorMap = { ...(opt.colorMap || {}) };
    const dualMap = { ...(opt.dualColorMap || {}) };

    if (next.dualHex) {
      dualMap[val] = next.dualHex;
      delete colorMap[val];
    } else if (next.hex) {
      colorMap[val] = next.hex;
      delete dualMap[val];
    }

    updated.colorMap = colorMap;
    updated.dualColorMap = dualMap;
    u[oi] = updated;
    onOptionsChange(u);
  };

  // Remove a value (and clean up color maps)
  const removeValue = (oi: number, vi: number) => {
    const opt = options[oi]!;
    const val = opt.values[vi]!;
    const u = [...options];
    const updated = { ...opt, values: opt.values.filter((_, i) => i !== vi) };
    if (updated.colorMap) {
      const { [val]: _, ...rest } = updated.colorMap;
      updated.colorMap = rest;
    }
    if (updated.dualColorMap) {
      const { [val]: _, ...rest } = updated.dualColorMap;
      updated.dualColorMap = rest;
    }
    u[oi] = updated;
    onOptionsChange(u);
  };

  // Get color hex for a value
  const getColorHex = (optionName: string, value: string): string | undefined => {
    const opt = optionByName[optionName];
    if (!opt || opt.style !== 'color') return undefined;
    return opt.colorMap?.[value];
  };

  const getDualColor = (optionName: string, value: string): [string, string] | undefined => {
    const opt = optionByName[optionName];
    if (!opt || opt.style !== 'color') return undefined;
    return opt.dualColorMap?.[value];
  };

  const variantLabel = (v: GeneratedVariant) => Object.values(v.options).join(' / ');

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">{t('variant.variants')}</CardTitle>
            {variants.length > 0 && <Badge variant="secondary" className="text-[10px]">{variants.length}</Badge>}
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-primary"
            onClick={() => onOptionsChange([...options, { name: '', style: 'text', values: [] }])}>
            <Plus className="w-3.5 h-3.5 mr-1" /> {t('variant.addNewOption')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Option Groups */}
        {options.map((option, oi) => (
          <div key={oi} className="flex items-start gap-3 pb-4 border-b last:border-0">
            <div className="w-32 shrink-0 space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">{t('variant.optionName')}</label>
              <Input className="h-8 text-sm" placeholder={t('variant.optionNamePlaceholder')}
                value={option.name} onChange={e => { const u = [...options]; u[oi] = { ...u[oi]!, name: e.target.value }; onOptionsChange(u); }} />
            </div>
            <div className="w-24 shrink-0 space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">{t('variant.optionStyle')}</label>
              <select className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm"
                value={option.style} onChange={e => { const u = [...options]; u[oi] = { ...u[oi]!, style: e.target.value as any }; onOptionsChange(u); }}>
                <option value="text">{t('variant.styleText')}</option>
                <option value="color">{t('variant.styleColor')}</option>
                <option value="image">{t('variant.styleImage')}</option>
              </select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">{t('variant.optionValues')}</label>

              {/* Existing values as chips */}
              <div className="flex flex-wrap items-center gap-1.5 p-1.5 min-h-8 border rounded-md bg-background">
                {option.values.map((val, vi) => {
                  const hex = option.colorMap?.[val];
                  const dual = option.dualColorMap?.[val];

                  if (option.style === 'color') {
                    return (
                      <div
                        key={vi}
                        className="inline-flex items-center gap-1.5 pl-1 pr-0.5 py-0.5 rounded-md border border-zinc-200 bg-white text-xs"
                      >
                        <ColorEditorPopover
                          value={val}
                          hex={hex}
                          dualHex={dual}
                          onChange={(next) => updateColorForValue(oi, val, next)}
                          t={t}
                        >
                          <ColorSwatch hex={hex} dualHex={dual} size={18} />
                        </ColorEditorPopover>
                        <span className="font-medium text-zinc-700">{val}</span>
                        <button
                          type="button"
                          onClick={() => removeValue(oi, vi)}
                          className="hover:text-red-500 transition p-0.5 text-zinc-400"
                          title={t('common.remove')}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <Badge key={vi} variant="outline" className="text-xs gap-1.5 pr-0.5 bg-blue-50 text-blue-700 border-blue-200">
                      {val}
                      <button onClick={() => removeValue(oi, vi)}
                        className="hover:text-red-500 transition p-0.5"><X className="w-3 h-3" /></button>
                    </Badge>
                  );
                })}

                {/* Add value input — same flow for color and text. Type a name and press Enter.
                    For color values, the chip's swatch then opens a popover for hex / dual color. */}
                <input
                  className="flex-1 min-w-32 text-sm bg-transparent outline-none placeholder:text-muted-foreground px-1"
                  placeholder={option.style === 'color' ? t('variant.addColorPlaceholder') : t('variant.addValuePlaceholder')}
                  value={newValue[oi] || ''}
                  onChange={e => setNewValue({ ...newValue, [oi]: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addValue(oi); } }}
                />
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 mt-5 shrink-0"
              onClick={() => onOptionsChange(options.filter((_, i) => i !== oi))}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}

        {options.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {t('variant.noOptions')}
          </div>
        )}

        {/* Variant List */}
        {variants.length > 0 && (
          <div className="pt-2">
            {/* Quick filter bar */}
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground mr-1">{t('variant.select')}</span>
              <button onClick={selectAll} className="text-xs text-primary hover:underline font-medium">{t('variant.all')}</button>
              <button onClick={selectNone} className="text-xs text-primary hover:underline font-medium">{t('variant.none')}</button>
              {allFilterValues.map((fv, i) => (
                <button key={i} onClick={() => selectByValue(fv.optionName, fv.value)}
                  className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
                  {optionByName[fv.optionName]?.style === 'color' && (
                    <ColorSwatch
                      hex={optionByName[fv.optionName]?.colorMap?.[fv.value]}
                      dualHex={optionByName[fv.optionName]?.dualColorMap?.[fv.value]}
                      size={10}
                    />
                  )}
                  {fv.value}
                </button>
              ))}
            </div>

            {/* Inline toolbar */}
            <div className="flex items-center gap-3 mb-3 min-h-8">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded accent-primary"
                  checked={selected.size === variants.length && variants.length > 0}
                  onChange={() => selected.size === variants.length ? selectNone() : selectAll()} />
                <span className="text-xs font-medium text-muted-foreground">
                  {selected.size > 0 ? t('variant.selectedCount', { count: selected.size }) : t('variant.variantsCount', { count: variants.length })}
                </span>
              </label>

              {selected.size > 0 && (
                <>
                  <div className="h-4 w-px bg-zinc-200" />
                  <button onClick={() => { setBulkPriceVal(''); setBulkCompareVal(''); setShowBulkPrice(true); }}
                    className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 transition">
                    <Pencil className="w-3 h-3" /> {t('variant.editPrice')}
                  </button>
                  <button onClick={() => { setBulkStockVal(''); setShowBulkStock(true); }}
                    className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 transition">
                    <Pencil className="w-3 h-3" /> {t('variant.editStock')}
                  </button>
                  <button onClick={applyBulkImage}
                    className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 transition">
                    <ImageIcon className="w-3 h-3" /> {t('variant.addImage')}
                  </button>
                  <button onClick={deleteSelected}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition">
                    <Trash2 className="w-3 h-3" /> {t('common.delete')}
                  </button>
                </>
              )}
            </div>

            {/* Shopify-style quick actions — apply pricing across variants
                without needing to select rows first. */}
            {variants.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setSamePriceVal('');
                    setSameCompareVal('');
                    setShowSamePriceAll(true);
                  }}
                >
                  <Pencil className="w-3 h-3 mr-1" /> {t('variant.samePriceForAll')}
                </Button>

                {optionNames.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={openPricePerOption}
                  >
                    <Pencil className="w-3 h-3 mr-1" /> {t('variant.setPricePerOption')}
                  </Button>
                )}
              </div>
            )}

            {/* Pricing status indicator — quick read on whether all variants
                share a single price or vary across the table. */}
            {pricingStatus && variants.length > 0 && (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs border ${
                  pricingStatus.allSame
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${pricingStatus.allSame ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {pricingStatus.allSame ? (
                  <>
                    {t('variant.allSamePrice')}
                    <span className="font-semibold ml-0.5">
                      ({currency} {(pricingStatus.sharedPrice ?? 0).toFixed(2)})
                    </span>
                  </>
                ) : (
                  t('variant.pricesVary')
                )}
              </div>
            )}

            {/* Variant Rows */}
            <div className="border rounded-lg divide-y">
              {variants.map(v => (
                <div key={v._key} className={`flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 transition ${selected.has(v._key) ? 'bg-blue-50/50' : ''}`}>
                  <input type="checkbox" className="rounded accent-primary shrink-0"
                    checked={selected.has(v._key)}
                    onChange={e => {
                      const s = new Set(selected);
                      e.target.checked ? s.add(v._key) : s.delete(v._key);
                      setSelected(s);
                    }} />

                  {/* Image */}
                  <button onClick={async () => {
                    if (!onPickImage) return;
                    const imgs = await onPickImage();
                    if (imgs.length) updateVariant(v._key, 'image_url', imgs[0]!.url);
                  }}
                    className="h-9 w-9 rounded border bg-zinc-50 flex items-center justify-center hover:bg-zinc-100 transition overflow-hidden shrink-0">
                    {v.image_url
                      ? <img src={v.image_url} className="h-full w-full object-cover" />
                      : <ImageIcon className="w-4 h-4 text-zinc-300" />}
                  </button>

                  {/* Variant label with color swatches */}
                  <div className="w-28 shrink-0">
                    <p className="text-xs font-medium leading-tight">
                      {Object.entries(v.options).map(([k, val], i) => {
                        const hex = getColorHex(k, val);
                        const dual = getDualColor(k, val);
                        return (
                          <span key={k} className="flex items-center gap-1">
                            {(hex || dual) && <ColorSwatch hex={hex} dualHex={dual} size={12} />}
                            {val}
                          </span>
                        );
                      })}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Input type="number" step="0.01" className="h-8 text-xs w-24" placeholder={t('variant.price')}
                      value={v.price || ''} onChange={e => updateVariant(v._key, 'price', parseFloat(e.target.value) || 0)} />
                    <Package className="w-3 h-3 text-zinc-300" />
                  </div>

                  {/* Compare at price */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Input type="number" step="0.01" className="h-8 text-xs w-28" placeholder={t('variant.compare')}
                      value={v.compare_at_price || ''} onChange={e => updateVariant(v._key, 'compare_at_price', parseFloat(e.target.value) || 0)} />
                    <Package className="w-3 h-3 text-zinc-300" />
                  </div>

                  {/* SKU */}
                  <Input className="h-8 text-xs w-32 font-mono shrink-0" placeholder={t('variant.sku')}
                    value={v.sku} onChange={e => updateVariant(v._key, 'sku', e.target.value)} />

                  {/* Stock */}
                  <Input type="number" className="h-8 text-xs w-24 shrink-0" placeholder={t('variant.stock')}
                    value={v.stock_quantity ?? ''} onChange={e => updateVariant(v._key, 'stock_quantity', e.target.value === '' ? null : parseInt(e.target.value) || 0)} />

                  <div className="flex-1" />

                  <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-300 hover:text-red-500 shrink-0"
                    onClick={() => deleteVariant(v._key)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Bulk Edit Price Dialog */}
      <Dialog open={showBulkPrice} onOpenChange={setShowBulkPrice}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('variant.editPriceTitle', { count: selected.size })}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('variant.price')}</Label>
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currency}</span>
                <Input type="number" step="0.01" className="pl-14 h-9 text-sm" placeholder={t('variant.leaveEmptyKeep')}
                  value={bulkPriceVal} onChange={e => setBulkPriceVal(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('variant.compareAtPrice')}</Label>
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currency}</span>
                <Input type="number" step="0.01" className="pl-14 h-9 text-sm" placeholder={t('variant.leaveEmptyKeep')}
                  value={bulkCompareVal} onChange={e => setBulkCompareVal(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowBulkPrice(false)}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={applyBulkPrice}>{t('variant.apply')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Stock Dialog */}
      <Dialog open={showBulkStock} onOpenChange={setShowBulkStock}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('variant.editStockTitle', { count: selected.size })}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('variant.stockQuantity')}</Label>
              <Input type="number" className="h-9 text-sm" placeholder={t('variant.setStockPlaceholder')}
                value={bulkStockVal} onChange={e => setBulkStockVal(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowBulkStock(false)}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={applyBulkStock}>{t('variant.apply')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Same price for all — Shopify-style one-click pricing across all variants */}
      <Dialog open={showSamePriceAll} onOpenChange={setShowSamePriceAll}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('variant.samePriceTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              {t('variant.samePriceDesc', { count: variants.length })}
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('variant.price')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currency}</span>
                <Input
                  type="number"
                  step="0.01"
                  className="pl-14 h-9 text-sm"
                  placeholder="0.00"
                  value={samePriceVal}
                  onChange={e => setSamePriceVal(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('variant.compareAtPrice')} <span className="text-muted-foreground font-normal">{t('variant.optional')}</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currency}</span>
                <Input
                  type="number"
                  step="0.01"
                  className="pl-14 h-9 text-sm"
                  placeholder={t('variant.leaveEmptyKeep')}
                  value={sameCompareVal}
                  onChange={e => setSameCompareVal(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowSamePriceAll(false)}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={applySamePriceAll} disabled={!samePriceVal || isNaN(parseFloat(samePriceVal))}>
              {t('variant.applyToAll', { count: variants.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set price per option — group pricing by an option's values
          (e.g. set one price per Size, applied to every Color of that Size). */}
      <Dialog open={showPricePerOption} onOpenChange={setShowPricePerOption}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('variant.setPricePerOption')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              {t('variant.pricePerOptionDesc')}
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('variant.pricingDependsOn')}</Label>
              <select
                className="w-full h-9 text-sm border rounded-md px-3 bg-background"
                value={pricePerOption}
                onChange={e => {
                  setPricePerOption(e.target.value);
                  setPricePerValueMap({});
                  setComparePerValueMap({});
                }}
              >
                {optionNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {selectedOptionValues.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto -mx-1 px-1">
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-[10px] text-muted-foreground uppercase tracking-wide pb-1 border-b">
                  <span>{pricePerOption}</span>
                  <span className="w-24 text-right">{t('variant.price')}</span>
                  <span className="w-24 text-right">{t('variant.compare')}</span>
                </div>
                {selectedOptionValues.map(val => (
                  <div key={val} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                    <span className="text-xs font-medium truncate">{val}</span>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-xs w-24"
                      placeholder="0.00"
                      value={pricePerValueMap[val] || ''}
                      onChange={e => setPricePerValueMap(prev => ({ ...prev, [val]: e.target.value }))}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-xs w-24"
                      placeholder="—"
                      value={comparePerValueMap[val] || ''}
                      onChange={e => setComparePerValueMap(prev => ({ ...prev, [val]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowPricePerOption(false)}>{t('common.cancel')}</Button>
            <Button
              size="sm"
              onClick={applyPricePerOption}
              disabled={!pricePerOption || Object.values(pricePerValueMap).every(v => !v || isNaN(parseFloat(v)))}
            >
              {t('variant.apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
