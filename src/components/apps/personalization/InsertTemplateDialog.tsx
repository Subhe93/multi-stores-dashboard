'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Library, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { useApiError } from '@/lib/useApiError';
import { insertTemplate, listTemplates, type PersonalizationTemplate } from '@/lib/personalization';
import { ProductPicker } from './ProductPicker';

export interface InsertTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  primaryLocale: string;
  /** Template chosen up front (library list); otherwise a template select is shown. */
  templateId?: string;
  /** Product fixed by the caller (product editor); otherwise a product picker is shown. */
  productId?: string;
  onInserted?: (productId: string, fields: unknown[]) => void;
}

/**
 * Inserts a field-library template into a product
 * (`POST /personalization/my/products/:productId/library/:id`).
 */
export function InsertTemplateDialog({
  open,
  onOpenChange,
  token,
  primaryLocale,
  templateId,
  productId,
  onInserted,
}: InsertTemplateDialogProps) {
  const t = useTranslations('creator.personalization.library');
  const apiError = useApiError();
  const [templates, setTemplates] = useState<PersonalizationTemplate[] | null>(null);
  const [template, setTemplate] = useState(templateId ?? '');
  const [product, setProduct] = useState(productId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTemplate(templateId ?? '');
    setProduct(productId ?? '');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, [open]);

  useEffect(() => {
    if (!open || templateId) return;
    let cancelled = false;
    setTemplates(null);
    listTemplates(token)
      .then((list) => !cancelled && setTemplates(Array.isArray(list) ? list : []))
      .catch((err) => {
        if (cancelled) return;
        setTemplates([]);
        setError(apiError(err));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apiError is stable for the mounted locale
  }, [open, templateId, token]);

  const canInsert = !!template && !!product && !saving;

  const handleInsert = async () => {
    if (!canInsert) return;
    setSaving(true);
    setError('');
    try {
      const fields = await insertTemplate(token, product, template);
      onInserted?.(product, Array.isArray(fields) ? fields : []);
      onOpenChange(false);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="size-4 text-muted-foreground" /> {t('insertTitle')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {!templateId && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t('template')}</Label>
              {templates === null ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : templates.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('empty')}</p>
              ) : (
                <SearchableSelect
                  value={template}
                  onChange={setTemplate}
                  placeholder={t('pickTemplate')}
                  options={templates.map((tpl) => ({
                    value: tpl.id,
                    label: tpl.name,
                    description: tpl.definition?.field?.type,
                  }))}
                />
              )}
            </div>
          )}
          {!productId && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t('product')}</Label>
              <ProductPicker token={token} primaryLocale={primaryLocale} value={product} onChange={setProduct} />
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">{t('insertHint')}</p>
        </div>
        {error && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('cancel')}
          </Button>
          <Button size="sm" onClick={handleInsert} disabled={!canInsert}>
            {saving && <Loader2 className="me-1 size-3 animate-spin" />}
            {t('insert')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
