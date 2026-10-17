'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, ChevronRight, Library, Loader2, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/importer/ImporterBits';
import { useApiError } from '@/lib/useApiError';
import {
  deleteTemplate,
  listTemplates,
  renameTemplate,
  TEMPLATE_NAME_MAX,
  type PersonalizationTemplate,
} from '@/lib/personalization';
import { InsertTemplateDialog } from './InsertTemplateDialog';

interface LibraryPanelProps {
  token: string;
  primaryLocale: string;
}

/**
 * "Library" tab: the store's saved field templates (D13). Templates are
 * created from the product editor ("Save to library"); here they are
 * renamed, deleted or inserted into a product.
 */
export function LibraryPanel({ token, primaryLocale }: LibraryPanelProps) {
  const t = useTranslations('creator.personalization.library');
  const tf = useTranslations('customField');
  const uiLocale = useLocale();
  const apiError = useApiError();
  const [templates, setTemplates] = useState<PersonalizationTemplate[] | null>(null);
  const [error, setError] = useState('');
  const [renaming, setRenaming] = useState<PersonalizationTemplate | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [deleting, setDeleting] = useState<PersonalizationTemplate | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [inserting, setInserting] = useState<string | null>(null);
  const [inserted, setInserted] = useState<{ productId: string; count: number } | null>(null);

  const load = useCallback(() => {
    setError('');
    listTemplates(token)
      .then((list) => setTemplates(Array.isArray(list) ? list : []))
      .catch((err) => {
        setTemplates([]);
        setError(apiError(err));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apiError is stable for the mounted locale
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const typeLabel = (type?: string) => {
    if (!type) return '';
    const key = `type${type.toLowerCase().split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('')}`;
    return tf.has(key) ? tf(key) : type;
  };

  const handleRename = async () => {
    if (!renaming || !newName.trim() || busy) return;
    setBusy(true);
    setDialogError('');
    try {
      await renameTemplate(token, renaming.id, newName.trim());
      setRenaming(null);
      load();
    } catch (err) {
      setDialogError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  // E8: the destructive confirm is a dialog (not `window.confirm`), with the
  // error shown inside it so a failed delete never closes silently.
  const confirmDelete = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteTemplate(token, deleting.id);
      setDeleting(null);
      load();
    } catch (err) {
      setDeleteError(apiError(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  const fmtDate = (iso?: string) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(uiLocale);
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      {inserted && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4" /> {t('insertedNotice', { count: inserted.count })}
          </span>
          <Link href={`/creator/products/own/${inserted.productId}`} className="inline-flex items-center gap-1 font-medium hover:underline">
            {t('openProduct')} <ChevronRight className="size-3 rtl:rotate-180" />
          </Link>
        </div>
      )}

      {templates === null ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Library className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">{t('emptyTitle')}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t('emptyBody')}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-none">
          <CardContent className="divide-y p-0">
            {templates.map((tpl) => {
              const field = tpl.definition?.field;
              const children = tpl.definition?.children ?? [];
              return (
                <div key={tpl.id} className="group flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium" title={field?.name}>
                        {tpl.name}
                      </p>
                      {field?.type && <Badge variant="secondary" className="text-[11px]">{typeLabel(field.type)}</Badge>}
                      {children.length > 0 && (
                        <Badge variant="outline" className="text-[11px]">{t('childrenCount', { count: children.length })}</Badge>
                      )}
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                      {field?.name}
                      {tpl.updated_at || tpl.created_at ? ` · ${fmtDate(tpl.updated_at || tpl.created_at)}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="sm" variant="outline" className="h-9 text-xs max-sm:h-11" onClick={() => setInserting(tpl.id)}>
                      {t('insertIntoProduct')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 text-zinc-500 max-sm:size-11"
                      aria-label={t('rename')}
                      title={t('rename')}
                      onClick={() => {
                        setRenaming(tpl);
                        setNewName(tpl.name);
                        setDialogError('');
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 text-red-500 max-sm:size-11"
                      aria-label={t('delete')}
                      title={t('delete')}
                      onClick={() => {
                        setDeleteError(null);
                        setDeleting(tpl);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('renameTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('name')}</Label>
            <Input
              className="h-8 text-sm"
              maxLength={TEMPLATE_NAME_MAX}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
              }}
            />
          </div>
          {dialogError && <p className="text-xs text-red-600">{dialogError}</p>}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRenaming(null)} disabled={busy}>
              {t('cancel')}
            </Button>
            <Button size="sm" onClick={handleRename} disabled={busy || !newName.trim()}>
              {busy && <Loader2 className="me-1 size-3 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title={t('deleteTitle')}
        description={deleting ? t('confirmDelete', { name: deleting.name }) : undefined}
        confirmLabel={t('delete')}
        destructive
        busy={deleteBusy}
        error={deleteError}
        onConfirm={confirmDelete}
        onOpenChange={(open) => !open && setDeleting(null)}
      />

      <InsertTemplateDialog
        open={inserting !== null}
        onOpenChange={(open) => !open && setInserting(null)}
        token={token}
        primaryLocale={primaryLocale}
        templateId={inserting ?? undefined}
        onInserted={(productId, fields) => setInserted({ productId, count: fields.length })}
      />
    </div>
  );
}
