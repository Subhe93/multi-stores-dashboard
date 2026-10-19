'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, CheckCircle2, Download, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { ApiError } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import { loadStoreLocales } from '@/lib/personalization';
import {
  putProductAddons,
  type DesignerAddonItem,
  type ProductDesignerView,
} from '@/lib/designer/designer.api';
import { I18nInputs } from '@/components/designer/TemplateElementForm';
import { FieldError } from '@/components/designer/DesignerBits';
import { pickLabel } from '@/lib/designer/pickLabel';

/** Same limits as the API validator (designer-addons.ts). */
const MAX_ITEMS = 10;
const MAX_QTY = 20;
const PRICE_MAX = 100_000;

type Draft = DesignerAddonItem & { uid: string };
type ItemErrors = Partial<Record<'label' | 'price' | 'max_qty', string>>;

let uidSeq = 0;
const uid = () => `a${++uidSeq}`;

function toDraft(items: DesignerAddonItem[]): Draft[] {
  return items.map((i) => ({ ...i, label: { ...i.label }, uid: uid() }));
}

/**
 * A fresh slug key for a new item (`addon-<time><random>`). Keys are never
 * reused: customer selections (`{key: qty}`) in carts and drafts are priced
 * against the current config, so a deleted item's key handed to a new item
 * would silently charge the new item to those selections.
 */
function freeKey(items: Draft[]): string {
  const used = new Set(items.map((i) => i.key));
  for (;;) {
    const key = `addon-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    if (!used.has(key)) return key;
  }
}

/** The fields that matter for "unsaved changes" (order is the list order). */
const comparable = (i: DesignerAddonItem) => ({
  key: i.key,
  type: i.type,
  label: i.label,
  price: i.price,
  max_qty: i.type === 'quantity' ? i.max_qty : undefined,
  enabled: i.enabled,
});

const sameItems = (a: DesignerAddonItem[], b: DesignerAddonItem[]) =>
  JSON.stringify(a.map(comparable)) === JSON.stringify(b.map(comparable));

/**
 * "Add-ons" of a designed product (M5.5): paid extras the customer picks on
 * the product page (toggle, or quantity 1..max). Prices are in the store
 * currency; markets convert them like the product price. Imported NPP
 * add-ons are offered as one-click (disabled) presets.
 */
export function ProductAddonsEditor({
  productId,
  token,
  view,
  onSaved,
}: {
  productId: string;
  token: string;
  view: ProductDesignerView;
  onSaved: (v: ProductDesignerView) => void;
}) {
  const t = useTranslations('creator.designer.product.addons');
  const locale = useLocale();
  const describeError = useApiError();
  const saved = view.link?.addons?.items ?? [];
  const presets = useMemo(() => view.link?.addon_presets ?? [], [view.link?.addon_presets]);
  const [items, setItems] = useState<Draft[]>(() => toDraft(saved));
  const [locales, setLocales] = useState<string[]>(['en']);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, ItemErrors>>({});

  // Re-sync only when the server add-ons actually changed (own save, reload).
  // The parent replaces `view` on every link save / unlink too; keying on the
  // object identity would wipe unsaved add-on edits each time the merchant
  // saves the link card above.
  const serverJson = JSON.stringify(saved);
  const syncedJson = useRef(serverJson);
  useEffect(() => {
    if (syncedJson.current === serverJson) return;
    syncedJson.current = serverJson;
    setItems(toDraft(JSON.parse(serverJson) as DesignerAddonItem[]));
    setItemErrors({});
  }, [serverJson]);

  useEffect(() => {
    let cancelled = false;
    loadStoreLocales(token)
      .then(({ locales: list }) => {
        if (!cancelled && list.length) setLocales(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token]);

  const dirty = !sameItems(items, saved);
  const unusedPresets = useMemo(() => presets.filter((p) => !items.some((i) => i.key === p.key)), [presets, items]);

  const patch = (id: string, next: Partial<DesignerAddonItem>) => {
    setDone(false);
    setItems((list) => list.map((i) => (i.uid === id ? { ...i, ...next } : i)));
    setItemErrors((e) => {
      if (!e[id]) return e;
      const copy = { ...e };
      delete copy[id];
      return copy;
    });
  };

  const add = (type: 'toggle' | 'quantity') => {
    setDone(false);
    setItems((list) =>
      list.length >= MAX_ITEMS
        ? list
        : [
            ...list,
            {
              uid: uid(),
              key: freeKey(list),
              type,
              label: {},
              price: 0,
              ...(type === 'quantity' ? { max_qty: 10 } : {}),
              enabled: false,
            },
          ],
    );
  };

  const usePresets = () => {
    setDone(false);
    setItems((list) => [...list, ...toDraft(unusedPresets)].slice(0, MAX_ITEMS));
  };

  const move = (index: number, delta: number) => {
    setDone(false);
    setItems((list) => {
      const to = index + delta;
      if (to < 0 || to >= list.length) return list;
      const copy = [...list];
      [copy[index], copy[to]] = [copy[to], copy[index]];
      return copy;
    });
  };

  const remove = (id: string) => {
    setDone(false);
    setItems((list) => list.filter((i) => i.uid !== id));
  };

  /** Friendly client checks, same rules as the API; returns the first invalid field id. */
  const validate = (): string | null => {
    const errs: Record<string, ItemErrors> = {};
    let first: string | null = null;
    const flag = (it: Draft, field: keyof ItemErrors, text: string) => {
      errs[it.uid] = { ...errs[it.uid], [field]: text };
      first ??= `dz-addon-${it.uid}-${field}`;
    };
    for (const it of items) {
      if (!Object.values(it.label).some((v) => v.trim())) flag(it, 'label', t('errLabel'));
      if (!Number.isFinite(it.price) || it.price < 0 || it.price > PRICE_MAX || Math.round(it.price * 100) / 100 !== it.price) {
        flag(it, 'price', t('errPrice', { max: PRICE_MAX }));
      }
      if (it.type === 'quantity' && !(Number.isInteger(it.max_qty) && (it.max_qty ?? 0) >= 1 && (it.max_qty ?? 0) <= MAX_QTY)) {
        flag(it, 'max_qty', t('errMaxQty', { max: MAX_QTY }));
      }
    }
    setItemErrors(errs);
    return first;
  };

  const save = async () => {
    if (saving) return;
    setError(null);
    setDone(false);
    const firstInvalid = validate();
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    setSaving(true);
    try {
      const res = await putProductAddons(token, productId, {
        v: 2,
        items: items.map((rest, i) => {
          const label: Record<string, string> = {};
          for (const [loc, v] of Object.entries(rest.label)) if (v.trim()) label[loc] = v.trim();
          return {
            key: rest.key,
            type: rest.type,
            label,
            price: rest.price,
            ...(rest.type === 'quantity' ? { max_qty: rest.max_qty ?? 1 } : {}),
            enabled: rest.enabled,
            sort: i,
          };
        }),
      });
      onSaved(res);
      setDone(true);
    } catch (err) {
      // Server-side rule hits (should not happen after the client checks): point at the item.
      const issues = err instanceof ApiError ? ((err.payload?.params as { errors?: { path: string; rule: string }[] } | undefined)?.errors ?? []) : [];
      const errs: Record<string, ItemErrors> = {};
      for (const issue of issues) {
        const m = /^items\.(\d+)\.(label|price|max_qty)/.exec(issue.path);
        const it = m ? items[Number(m[1])] : undefined;
        if (!it || !m) continue;
        const field = m[2] as keyof ItemErrors;
        errs[it.uid] = { ...errs[it.uid], [field]: field === 'label' ? t('errLabel') : field === 'price' ? t('errPrice', { max: PRICE_MAX }) : t('errMaxQty', { max: MAX_QTY }) };
      }
      setItemErrors(errs);
      setError(Object.keys(errs).length ? t('errFix') : describeError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!view.link) {
    return (
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
          <p className="text-xs text-muted-foreground">{t('linkFirst')}</p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
        <p className="text-xs text-muted-foreground">{t('intro')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {unusedPresets.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
            <span>
              {t('presetsNote', {
                list: unusedPresets.map((p) => `${pickLabel(p.label, locale) || p.key} (${p.price})`).join(', '),
              })}
            </span>
            <Button type="button" size="sm" variant="outline" className="max-sm:min-h-11" onClick={usePresets} disabled={items.length >= MAX_ITEMS}>
              <Download /> {t('usePresets')}
            </Button>
          </div>
        )}

        {items.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">{t('empty')}</p>
        ) : (
          <ol className="space-y-3">
            {items.map((it, index) => {
              const errs = itemErrors[it.uid] ?? {};
              const base = `dz-addon-${it.uid}`;
              return (
                <li key={it.uid} className="space-y-3 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium">{it.type === 'quantity' ? t('typeQuantity') : t('typeToggle')}</span>
                      <span className="font-mono text-muted-foreground" dir="ltr">
                        {it.key}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ToggleSwitch id={`${base}-enabled`} checked={it.enabled} onChange={(v) => patch(it.uid, { enabled: v })} label={t('enabled')} />
                      <span className="me-2 text-xs text-muted-foreground">{it.enabled ? t('on') : t('off')}</span>
                      <Button type="button" size="icon" variant="ghost" className="size-8 max-sm:size-11" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t('moveUp')}>
                        <ArrowUp />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="size-8 max-sm:size-11" disabled={index === items.length - 1} onClick={() => move(index, 1)} aria-label={t('moveDown')}>
                        <ArrowDown />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="size-8 text-red-600 hover:text-red-700 max-sm:size-11" onClick={() => remove(it.uid)} aria-label={t('delete')}>
                        <Trash2 />
                      </Button>
                    </div>
                  </div>

                  <I18nInputs
                    id={`${base}-label`}
                    label={t('label')}
                    hint={it.type === 'quantity' ? t('labelHintQuantity') : t('labelHintToggle')}
                    value={it.label}
                    locales={locales}
                    onChange={(label) => patch(it.uid, { label })}
                    error={errs.label}
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`${base}-price`} className="text-xs">
                        {it.type === 'quantity' ? t('priceEach') : t('price')}
                      </Label>
                      <Input
                        id={`${base}-price`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        className="h-8 text-xs"
                        dir="ltr"
                        value={Number.isFinite(it.price) ? it.price : ''}
                        aria-invalid={!!errs.price || undefined}
                        onChange={(e) => patch(it.uid, { price: e.target.value === '' ? Number.NaN : Number(e.target.value) })}
                      />
                      <p className="text-[11px] text-muted-foreground">{t('priceHint')}</p>
                      <FieldError text={errs.price} />
                    </div>
                    {it.type === 'quantity' && (
                      <div className="space-y-1.5">
                        <Label htmlFor={`${base}-max_qty`} className="text-xs">
                          {t('maxQty')}
                        </Label>
                        <Input
                          id={`${base}-max_qty`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={MAX_QTY}
                          step={1}
                          className="h-8 text-xs"
                          dir="ltr"
                          value={it.max_qty ?? ''}
                          aria-invalid={!!errs.max_qty || undefined}
                          onChange={(e) => patch(it.uid, { max_qty: e.target.value === '' ? undefined : Number(e.target.value) })}
                        />
                        <FieldError text={errs.max_qty} />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button type="button" size="sm" variant="outline" className="max-sm:min-h-11" disabled={items.length >= MAX_ITEMS} onClick={() => add('toggle')}>
            <Plus /> {t('addToggle')}
          </Button>
          <Button type="button" size="sm" variant="outline" className="max-sm:min-h-11" disabled={items.length >= MAX_ITEMS} onClick={() => add('quantity')}>
            <Plus /> {t('addQuantity')}
          </Button>
          {items.length >= MAX_ITEMS && <span className="text-xs text-muted-foreground">{t('maxItems', { max: MAX_ITEMS })}</span>}
          <div className="ms-auto flex items-center gap-2">
            {done && !dirty && (
              <span className="flex items-center gap-1 text-xs text-emerald-700">
                <CheckCircle2 className="size-3.5" /> {t('saved')}
              </span>
            )}
            <Button type="button" size="sm" className="max-sm:min-h-11" disabled={!dirty || saving} onClick={save}>
              {saving && <Loader2 className="animate-spin" />} {t('save')}
            </Button>
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
