'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, ExternalLink, Info, Loader2, PenTool, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/useApiError';
import {
  deleteProductDesigner,
  designerFileUrl,
  getProductDesigner,
  getTemplate,
  listAssets,
  listFonts,
  listTemplates,
  putProductDesigner,
  type DesignerAssetView,
  type DesignerFontView,
  type ProductDesignerView,
  type TemplateDetail,
  type TemplateListItem,
} from '@/lib/designer/designer.api';
import { DesignPreviewCanvas, type PreviewFont } from '@/components/designer/DesignPreviewCanvas';
import { FieldError, TemplateStatusBadge } from '@/components/designer/DesignerBits';

const NONE = '__none__';

/** Imported NPP add-ons (`{double:{enabled,price}, …}`), shown read-only. */
function addonRows(addons: unknown): { key: string; price: string }[] {
  if (!addons || typeof addons !== 'object' || Array.isArray(addons)) return [];
  return Object.entries(addons as Record<string, unknown>).map(([key, v]) => {
    const price = v && typeof v === 'object' && 'price' in v ? String((v as { price: unknown }).price ?? '') : '';
    return { key, price };
  });
}

/**
 * "Designer" tab of the product editor (M4.2 §8.3): link the product to a
 * published template, switch the designer on/off for it, and see what
 * enabling does (imported launch fields are deleted, required custom fields
 * are bypassed for designed lines). "Off" keeps the link but the storefront
 * shows the normal product page; "Remove template" deletes the link.
 */
export function ProductDesignerTab({ productId }: { productId: string }) {
  const t = useTranslations('creator.designer.product');
  const { token } = useAuth();
  const describeError = useApiError();
  const [view, setView] = useState<ProductDesignerView | null>(null);
  const [templates, setTemplates] = useState<TemplateListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string>(NONE);
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ text: string; field?: 'template' } | null>(null);
  const [removed, setRemoved] = useState<number | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [unlinked, setUnlinked] = useState(false);
  const [preview, setPreview] = useState<{ detail: TemplateDetail; assets: DesignerAssetView[]; fonts: DesignerFontView[] } | null>(null);

  const adopt = (v: ProductDesignerView) => {
    setView(v);
    setTemplateId(v.link?.template_id ?? NONE);
    setEnabled(!!v.link?.enabled);
  };

  const load = useCallback(() => {
    if (!token) return;
    setLoadError(null);
    Promise.all([getProductDesigner(token, productId), listTemplates(token, { limit: 200 })])
      .then(([v, list]) => {
        adopt(v);
        setTemplates(list.items);
      })
      .catch((err) => setLoadError(describeError(err)));
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, productId]);

  useEffect(() => {
    load();
  }, [load]);

  // Preview of the selected template's live version.
  useEffect(() => {
    if (!token || templateId === NONE) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    Promise.all([getTemplate(token, templateId), listAssets(token, { limit: 200 }), listFonts(token)])
      .then(([detail, assets, fonts]) => {
        if (!cancelled) setPreview({ detail, assets: assets.items, fonts });
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, templateId]);

  const selected = templates?.find((x) => x.id === templateId) ?? null;
  const publishedSelected = selected?.status === 'PUBLISHED' && !!selected.current_version_id;
  const dirty = !!view && (templateId !== (view.link?.template_id ?? NONE) || enabled !== !!view.link?.enabled);

  const options = useMemo(
    () => [
      { value: NONE, label: t('noTemplate') },
      ...(templates ?? []).map((x) => ({
        value: x.id,
        label: x.name,
        description: x.status === 'PUBLISHED' ? t('optionPublished', { products: x.product_count }) : t('optionNotPublished'),
      })),
    ],
    [templates, t],
  );

  const previewSpec = preview?.detail.current_spec ?? null;
  const previewUrls = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of preview?.assets ?? []) {
      const u = designerFileUrl(a.url);
      if (u) map[a.id] = u;
    }
    return map;
  }, [preview]);
  const previewFonts: PreviewFont[] = useMemo(() => {
    if (!previewSpec || !preview) return [];
    const byId = new Map(preview.fonts.map((f) => [f.id, f]));
    return previewSpec.fonts
      .map((f) => {
        const url = designerFileUrl(byId.get(f.asset_id)?.url);
        return url ? { family: f.family, weight: f.weight, style: f.style || 'normal', url } : null;
      })
      .filter((x): x is PreviewFont => !!x);
  }, [previewSpec, preview]);

  const save = async (nextEnabled: boolean = enabled) => {
    if (!token || saving) return;
    setError(null);
    setRemoved(null);
    setUnlinked(false);
    if (templateId === NONE) {
      setError({ text: t('pickTemplateFirst'), field: 'template' });
      document.getElementById('dz-product-template')?.focus();
      return;
    }
    if (nextEnabled && !publishedSelected) {
      setError({ text: t('publishFirst'), field: 'template' });
      document.getElementById('dz-product-template')?.focus();
      return;
    }
    setSaving(true);
    try {
      const res = await putProductDesigner(token, productId, { enabled: nextEnabled, template_id: templateId });
      adopt(res);
      setRemoved(res.removed_fallback_fields ?? 0);
      // The link changes the template's product count.
      listTemplates(token, { limit: 200 })
        .then((list) => setTemplates(list.items))
        .catch(() => undefined);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DESIGNER_TEMPLATE_MISMATCH') {
        setError({ text: t('publishFirst'), field: 'template' });
      } else {
        setError({ text: describeError(err) });
      }
    } finally {
      setSaving(false);
    }
  };

  const unlink = async () => {
    if (!token || unlinking) return;
    setUnlinking(true);
    setUnlinkError(null);
    try {
      await deleteProductDesigner(token, productId);
      setConfirmUnlink(false);
      setError(null);
      setRemoved(null);
      setUnlinked(true);
      load();
    } catch (err) {
      setUnlinkError(describeError(err));
    } finally {
      setUnlinking(false);
    }
  };

  if (!token) return null;
  if (loadError) return <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</p>;
  if (!view || !templates) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const addons = addonRows(view.link?.addons);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <div className="space-y-5">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <PenTool className="size-4 text-muted-foreground" />
              {t('title')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t('intro')}</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="max-w-md space-y-1.5">
              <Label htmlFor="dz-product-template" className="text-sm font-normal">
                {t('template')}
              </Label>
              <SearchableSelect
                id="dz-product-template"
                value={templateId}
                onChange={(v) => {
                  setTemplateId(v);
                  setError(null);
                }}
                options={options}
              />
              {selected && (
                <div className="flex items-center gap-2 text-xs">
                  <TemplateStatusBadge status={selected.status} />
                  <Link href={`/creator/designer/templates/${selected.id}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline">
                    {t('openTemplate')} <ExternalLink className="size-3" />
                  </Link>
                </div>
              )}
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('noTemplates')}{' '}
                  <Link href="/creator/designer?tab=templates" className="font-medium underline">
                    {t('createTemplate')}
                  </Link>
                </p>
              )}
              <FieldError text={error?.field === 'template' ? error.text : null} />
            </div>

            <div className="flex items-start justify-between gap-3 rounded-md border p-3">
              <div>
                <Label htmlFor="dz-product-enabled" className="text-sm font-normal">
                  {t('enabled')}
                </Label>
                <p className="text-xs text-muted-foreground">{t('enabledHint')}</p>
              </div>
              <ToggleSwitch id="dz-product-enabled" checked={enabled} onChange={setEnabled} label={t('enabled')} />
            </div>

            {enabled && !view.link?.enabled && view.fallback_field_count > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>{t('fallbackWarning', { count: view.fallback_field_count })}</span>
              </div>
            )}
            {view.required_field_count > 0 && (
              <div className="flex items-start gap-2 rounded-md border bg-zinc-50 p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>{t('requiredFieldsNote', { count: view.required_field_count })}</span>
              </div>
            )}
            {removed !== null && (
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                <span>{removed > 0 ? t('savedRemoved', { count: removed }) : t('saved')}</span>
              </div>
            )}
            {unlinked && !view.link && (
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                <span>{t('unlinkDone')}</span>
              </div>
            )}
            {error && error.field !== 'template' && <p className="text-xs text-red-600">{error.text}</p>}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
              {view.link && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="max-sm:min-h-11 me-auto text-red-600 hover:text-red-700"
                  disabled={saving || unlinking}
                  onClick={() => {
                    setUnlinkError(null);
                    setConfirmUnlink(true);
                  }}
                >
                  <Unlink /> {t('unlink')}
                </Button>
              )}
              {view.link?.enabled && (
                <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => {
                    setEnabled(false);
                    save(false);
                  }}
                >
                  {t('turnOff')}
                </Button>
              )}
              <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => save()}>
                {saving && <Loader2 className="animate-spin" />} {t('save')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {addons.length > 0 && (
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">{t('addonsTitle')}</CardTitle>
              <p className="text-xs text-muted-foreground">{t('addonsHint')}</p>
            </CardHeader>
            <CardContent>
              <ul className="divide-y rounded-md border text-xs">
                {addons.map((a) => (
                  <li key={a.key} className="flex items-center justify-between px-3 py-2">
                    <span className="font-mono" dir="ltr">
                      {a.key}
                    </span>
                    <span className="text-muted-foreground">
                      {a.price ? `${a.price} · ` : ''}
                      {t('addonDisabled')}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="shadow-none lg:self-start">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{t('previewTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          {templateId === NONE ? (
            <p className="py-8 text-center text-xs text-muted-foreground">{t('previewNone')}</p>
          ) : !preview ? (
            <Loader2 className="my-8 size-5 animate-spin text-muted-foreground" />
          ) : !previewSpec ? (
            <p className="py-8 text-center text-xs text-muted-foreground">{t('previewUnpublished')}</p>
          ) : (
            <DesignPreviewCanvas spec={previewSpec} mode="edit" assetUrls={previewUrls} fonts={previewFonts} maxWidth={320} />
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmUnlink} onOpenChange={(o) => !o && !unlinking && setConfirmUnlink(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('unlinkTitle')}</DialogTitle>
            <DialogDescription>
              {t('unlinkBody', { template: view.link?.template?.name ?? selected?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 rounded-md border bg-zinc-50 p-3 ps-7 text-xs text-muted-foreground">
            <li>{t('unlinkWhatPage')}</li>
            <li>{t('unlinkWhatOrders')}</li>
            <li>{t('unlinkWhatTemplate')}</li>
          </ul>
          {unlinkError && <p className="text-xs text-red-600">{unlinkError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" className="max-sm:min-h-11" disabled={unlinking} onClick={() => setConfirmUnlink(false)}>
              {t('unlinkCancel')}
            </Button>
            <Button type="button" variant="destructive" className="max-sm:min-h-11" disabled={unlinking} onClick={unlink}>
              {unlinking ? <Loader2 className="animate-spin" /> : <Unlink />} {t('unlinkConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
