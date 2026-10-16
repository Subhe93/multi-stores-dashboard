'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FileImage, Loader2, Plus, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { useApiError } from '@/lib/useApiError';
import {
  createTemplate,
  designerFileUrl,
  listTemplates,
  type DesignTemplateStatus,
  type TemplateListItem,
} from '@/lib/designer/designer.api';
import { useDateTimeFormat } from '@/components/importer/ImporterBits';
import { FieldError, TemplateStatusBadge } from '@/components/designer/DesignerBits';

const ALL = '__all__';

/** "Templates" tab: grid of the store's templates, filter by status, create a blank one. */
export function TemplatesTab({ token }: { token: string }) {
  const t = useTranslations('creator.designer.templates');
  const ts = useTranslations('creator.designer.status');
  const tc = useTranslations('creator.designer.common');
  const router = useRouter();
  const describeError = useApiError();
  const formatDate = useDateTimeFormat();
  const [status, setStatus] = useState<string>(ALL);
  const [items, setItems] = useState<TemplateListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError(null);
    listTemplates(token, { status: status === ALL ? undefined : (status as DesignTemplateStatus), limit: 200 })
      .then((res) => setItems(res.items))
      .catch((err) => {
        setItems([]);
        setError(describeError(err));
      });
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    const name = newName.trim();
    if (!name) {
      setNameError(t('nameRequired'));
      document.getElementById('dz-new-template-name')?.focus();
      return;
    }
    setSaving(true);
    setNameError(null);
    try {
      const d = await createTemplate(token, { name });
      router.push(`/creator/designer/templates/${d.id}`);
    } catch (err) {
      setNameError(describeError(err));
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-56">
          <SearchableSelect
            value={status}
            onChange={setStatus}
            options={[
              { value: ALL, label: t('allStatuses') },
              { value: 'DRAFT', label: ts('DRAFT') },
              { value: 'PUBLISHED', label: ts('PUBLISHED') },
              { value: 'ARCHIVED', label: ts('ARCHIVED') },
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={load} aria-label={tc('refresh')}>
            <RefreshCw />
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setNewName('');
              setNameError(null);
              setCreating(true);
            }}
          >
            <Plus /> {t('new')}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t('importHint')}{' '}
        <Link href="/creator/importer" className="font-medium text-foreground underline underline-offset-2">
          {t('importLink')}
        </Link>
      </p>

      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {!items ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <FileImage className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">{t('emptyTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('emptyBody')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {items.map((tpl) => {
            const thumb = designerFileUrl(tpl.thumbnail_url);
            return (
              <Link
                key={tpl.id}
                href={`/creator/designer/templates/${tpl.id}`}
                className="group overflow-hidden rounded-xl border bg-white transition hover:border-zinc-400 hover:shadow-sm"
              >
                <div className="flex aspect-[5/7] items-center justify-center bg-zinc-50">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- API-hosted thumbnail
                    <img src={thumb} alt="" className="h-full w-full object-contain" loading="lazy" />
                  ) : (
                    <FileImage className="size-8 text-zinc-300" />
                  )}
                </div>
                <div className="space-y-1.5 border-t p-3">
                  <p className="truncate text-sm font-medium group-hover:underline">{tpl.name}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <TemplateStatusBadge status={tpl.status} />
                    {tpl.source === 'npp' && <Badge variant="outline">NPP</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {t('meta', { products: tpl.product_count, versions: tpl.version_count })}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{t('updated', { date: formatDate(tpl.updated_at) })}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('newTitle')}</DialogTitle>
            <DialogDescription>{t('newBody')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="dz-new-template-name">{t('name')}</Label>
            <Input
              id="dz-new-template-name"
              autoFocus
              maxLength={160}
              value={newName}
              aria-invalid={!!nameError || undefined}
              onChange={(e) => {
                setNewName(e.target.value);
                setNameError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') create();
              }}
            />
            <FieldError text={nameError} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreating(false)}>
              {tc('cancel')}
            </Button>
            <Button type="button" disabled={saving} onClick={create}>
              {saving ? <Loader2 className="animate-spin" /> : <Plus />} {t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
