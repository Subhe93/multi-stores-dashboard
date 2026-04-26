'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { Plus, Trash2, X, ImageIcon, Pencil, Package } from 'lucide-react';
import type { UploadedImage } from '@/lib/useImageUpload';
import { useCurrency } from '@/lib/useCurrency';

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

export function VariantManager({ options, onOptionsChange, variants, onVariantsChange, basePrice = 0, onPickImage }: VariantManagerProps) {
  const { currency } = useCurrency();
  const [newValue, setNewValue] = useState<Record<number, string>>({});
  const [newColor, setNewColor] = useState<Record<number, string>>({});
  const [newColor2, setNewColor2] = useState<Record<number, string>>({});
  const [dualMode, setDualMode] = useState<Record<number, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Bulk edit dialogs
  const [showBulkPrice, setShowBulkPrice] = useState(false);
  const [showBulkStock, setShowBulkStock] = useState(false);
  const [bulkPriceVal, setBulkPriceVal] = useState('');
  const [bulkCompareVal, setBulkCompareVal] = useState('');
  const [bulkStockVal, setBulkStockVal] = useState('');

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
    if (!confirm(`Delete ${selected.size} variant(s)?`)) return;
    onVariantsChange(variants.filter(v => !selected.has(v._key)));
    setSelected(new Set());
  };

  // Add a color value with hex
  const addColorValue = (oi: number) => {
    const val = (newValue[oi] || '').trim();
    if (!val) return;
    const opt = options[oi]!;
    if (opt.values.includes(val)) return;

    const hex = newColor[oi] || '#000000';
    const hex2 = newColor2[oi] || '#ffffff';
    const isDual = dualMode[oi] || false;

    const u = [...options];
    const updated = { ...opt, values: [...opt.values, val] };

    if (isDual) {
      updated.dualColorMap = { ...(opt.dualColorMap || {}), [val]: [hex, hex2] };
    } else {
      updated.colorMap = { ...(opt.colorMap || {}), [val]: hex };
    }

    u[oi] = updated;
    onOptionsChange(u);
    setNewValue({ ...newValue, [oi]: '' });
    setNewColor({ ...newColor, [oi]: '#000000' });
    setNewColor2({ ...newColor2, [oi]: '#ffffff' });
  };

  // Add a text value
  const addValue = (oi: number) => {
    if (options[oi]?.style === 'color') {
      addColorValue(oi);
      return;
    }
    const val = (newValue[oi] || '').trim();
    if (!val) return;
    const opt = options[oi]!;
    if (opt.values.includes(val)) return;
    const u = [...options];
    u[oi] = { ...opt, values: [...opt.values, val] };
    onOptionsChange(u);
    setNewValue({ ...newValue, [oi]: '' });
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
            <CardTitle className="text-sm font-semibold">Variants</CardTitle>
            {variants.length > 0 && <Badge variant="secondary" className="text-[10px]">{variants.length}</Badge>}
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-primary"
            onClick={() => onOptionsChange([...options, { name: '', style: 'text', values: [] }])}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add new option
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Option Groups */}
        {options.map((option, oi) => (
          <div key={oi} className="flex items-start gap-3 pb-4 border-b last:border-0">
            <div className="w-32 shrink-0 space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Option name</label>
              <Input className="h-8 text-sm" placeholder="Color"
                value={option.name} onChange={e => { const u = [...options]; u[oi] = { ...u[oi]!, name: e.target.value }; onOptionsChange(u); }} />
            </div>
            <div className="w-24 shrink-0 space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Option style</label>
              <select className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm"
                value={option.style} onChange={e => { const u = [...options]; u[oi] = { ...u[oi]!, style: e.target.value as any }; onOptionsChange(u); }}>
                <option value="text">Text</option>
                <option value="color">Color</option>
                <option value="image">Image</option>
              </select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Option values</label>

              {/* Existing values as badges */}
              <div className="flex flex-wrap items-center gap-1.5 p-1.5 min-h-8 border rounded-md bg-background">
                {option.values.map((val, vi) => {
                  const hex = option.colorMap?.[val];
                  const dual = option.dualColorMap?.[val];
                  const isColor = option.style === 'color' && (hex || dual);

                  return (
                    <Badge key={vi} variant="outline" className="text-xs gap-1.5 pr-0.5 bg-blue-50 text-blue-700 border-blue-200">
                      {isColor && <ColorSwatch hex={hex} dualHex={dual} size={14} />}
                      {val}
                      <button onClick={() => removeValue(oi, vi)}
                        className="hover:text-red-500 transition p-0.5"><X className="w-3 h-3" /></button>
                    </Badge>
                  );
                })}

                {/* Add value input */}
                {option.style === 'color' ? (
                  <div className="flex items-center gap-1.5 flex-1 min-w-50">
                    <input
                      type="color"
                      value={newColor[oi] || '#000000'}
                      onChange={e => setNewColor({ ...newColor, [oi]: e.target.value })}
                      className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0.5 shrink-0"
                      title="Pick color"
                    />
                    {dualMode[oi] && (
                      <input
                        type="color"
                        value={newColor2[oi] || '#ffffff'}
                        onChange={e => setNewColor2({ ...newColor2, [oi]: e.target.value })}
                        className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0.5 shrink-0"
                        title="Pick second color"
                      />
                    )}
                    <input
                      className="flex-1 min-w-15 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                      placeholder="Color name"
                      value={newValue[oi] || ''}
                      onChange={e => setNewValue({ ...newValue, [oi]: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addValue(oi); } }}
                    />
                    <button
                      type="button"
                      onClick={() => setDualMode({ ...dualMode, [oi]: !dualMode[oi] })}
                      className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 transition-colors ${
                        dualMode[oi] ? 'bg-blue-100 text-blue-700 border-blue-300' : 'text-muted-foreground border-input hover:bg-muted'
                      }`}
                      title="Toggle dual-color mode"
                    >
                      2C
                    </button>
                  </div>
                ) : (
                  <input
                    className="flex-1 min-w-20 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                    placeholder="Type and press Enter"
                    value={newValue[oi] || ''}
                    onChange={e => setNewValue({ ...newValue, [oi]: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addValue(oi); } }}
                  />
                )}
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
            No options yet. Click "+ Add new option" to create Size, Color, etc.
          </div>
        )}

        {/* Variant List */}
        {variants.length > 0 && (
          <div className="pt-2">
            {/* Quick filter bar */}
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground mr-1">Select</span>
              <button onClick={selectAll} className="text-xs text-primary hover:underline font-medium">All</button>
              <button onClick={selectNone} className="text-xs text-primary hover:underline font-medium">None</button>
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
                  {selected.size > 0 ? `${selected.size} Variant${selected.size > 1 ? 's' : ''} Selected` : `${variants.length} variants`}
                </span>
              </label>

              {selected.size > 0 && (
                <>
                  <div className="h-4 w-px bg-zinc-200" />
                  <button onClick={() => { setBulkPriceVal(''); setBulkCompareVal(''); setShowBulkPrice(true); }}
                    className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 transition">
                    <Pencil className="w-3 h-3" /> Edit price
                  </button>
                  <button onClick={() => { setBulkStockVal(''); setShowBulkStock(true); }}
                    className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 transition">
                    <Pencil className="w-3 h-3" /> Edit stock
                  </button>
                  <button onClick={applyBulkImage}
                    className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 transition">
                    <ImageIcon className="w-3 h-3" /> Add image
                  </button>
                  <button onClick={deleteSelected}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </>
              )}
            </div>

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
                    <Input type="number" step="0.01" className="h-8 text-xs w-20" placeholder="Price"
                      value={v.price || ''} onChange={e => updateVariant(v._key, 'price', parseFloat(e.target.value) || 0)} />
                    <Package className="w-3 h-3 text-zinc-300" />
                  </div>

                  {/* Compare at price */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Input type="number" step="0.01" className="h-8 text-xs w-20" placeholder="Compare"
                      value={v.compare_at_price || ''} onChange={e => updateVariant(v._key, 'compare_at_price', parseFloat(e.target.value) || 0)} />
                    <Package className="w-3 h-3 text-zinc-300" />
                  </div>

                  {/* SKU */}
                  <Input className="h-8 text-xs w-24 font-mono shrink-0" placeholder="SKU"
                    value={v.sku} onChange={e => updateVariant(v._key, 'sku', e.target.value)} />

                  {/* Stock */}
                  <Input type="number" className="h-8 text-xs w-16 shrink-0" placeholder="Stock"
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
          <DialogHeader><DialogTitle>Edit Price — {selected.size} variant{selected.size > 1 ? 's' : ''}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Price</Label>
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currency}</span>
                <Input type="number" step="0.01" className="pl-7 h-9 text-sm" placeholder="Leave empty to keep current"
                  value={bulkPriceVal} onChange={e => setBulkPriceVal(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Compare at price</Label>
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currency}</span>
                <Input type="number" step="0.01" className="pl-7 h-9 text-sm" placeholder="Leave empty to keep current"
                  value={bulkCompareVal} onChange={e => setBulkCompareVal(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowBulkPrice(false)}>Cancel</Button>
            <Button size="sm" onClick={applyBulkPrice}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Stock Dialog */}
      <Dialog open={showBulkStock} onOpenChange={setShowBulkStock}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Stock — {selected.size} variant{selected.size > 1 ? 's' : ''}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Stock Quantity</Label>
              <Input type="number" className="h-9 text-sm" placeholder="Set stock for selected variants"
                value={bulkStockVal} onChange={e => setBulkStockVal(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowBulkStock(false)}>Cancel</Button>
            <Button size="sm" onClick={applyBulkStock}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
