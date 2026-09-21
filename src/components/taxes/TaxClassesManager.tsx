'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LocalizedTextFields } from '@/components/taxes/LocalizedTextFields';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { localizedTaxText, type TaxClass } from '@/lib/taxRate';

interface ClassForm {
  key: string;
  name: Record<string, string>;
  is_default: boolean;
  sort_order: string;
}

interface TaxClassesManagerProps {
  classes: TaxClass[];
  loading: boolean;
  // Platform locales offered for the class names.
  locales: string[];
  // Reload the list after a change.
  onChanged: () => void;
}

const EMPTY_FORM: ClassForm = { key: '', name: {}, is_default: false, sort_order: '0' };

// Slug-like key: lowercase letters, digits and dashes.
function normalizeKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

// Admin CRUD for platform tax classes (POST/PUT/DELETE /taxes/admin/classes).
export function TaxClassesManager({ classes, loading, locales, onChanged }: TaxClassesManagerProps) {
  const t = useTranslations('taxes');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { token } = useAuth();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClassForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<TaxClass | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const sorted = [...classes].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.key.localeCompare(b.key));

  // The current default cannot be un-defaulted (the API rejects it); another
  // class has to take the default over instead.
  const editingCurrentDefault = !!editingId && !!classes.find((c) => c.id === editingId)?.is_default;

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sort_order: String(classes.length) });
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (cls: TaxClass) => {
    setEditingId(cls.id);
    setForm({
      key: cls.key,
      name: typeof cls.name === 'object' && cls.name ? { ...cls.name } : { en: String(cls.name || '') },
      is_default: !!cls.is_default,
      sort_order: String(cls.sort_order ?? 0),
    });
    setFormError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!token || saving) return;
    const key = normalizeKey(form.key);
    const name = Object.fromEntries(
      Object.entries(form.name)
        .map(([k, v]) => [k, v.trim()])
        .filter(([, v]) => v),
    );
    if (!key) {
      setFormError(t('classKeyRequired'));
      return;
    }
    if (Object.keys(name).length === 0) {
      setFormError(t('classNameRequired'));
      return;
    }
    const body = {
      key,
      name,
      is_default: editingCurrentDefault || form.is_default,
      sort_order: Number.parseInt(form.sort_order, 10) || 0,
    };
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await api(`/taxes/admin/classes/${editingId}`, { method: 'PUT', token, body: JSON.stringify(body) });
      } else {
        await api('/taxes/admin/classes', { method: 'POST', token, body: JSON.stringify(body) });
      }
      setDialogOpen(false);
      onChanged();
    } catch (err) {
      setFormError((err instanceof Error && err.message) || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api(`/taxes/admin/classes/${deleteTarget.id}`, { method: 'DELETE', token });
      setDeleteTarget(null);
      onChanged();
    } catch (err) {
      // 409: products or rates still reference the class.
      const status = (err as { status?: number })?.status;
      setDeleteError(status === 409 ? t('classInUse') : (err instanceof Error && err.message) || t('deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">{t('classesHint')}</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-3.5" />
          {t('addClass')}
        </Button>
      </div>

      <Card className="shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('classKey')}</TableHead>
                <TableHead>{t('className')}</TableHead>
                <TableHead>{t('isDefault')}</TableHead>
                <TableHead className="text-end">{t('sortOrder')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">{tc('loading')}</TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">{t('noClasses')}</TableCell>
                </TableRow>
              ) : (
                sorted.map((cls) => (
                  <TableRow key={cls.id}>
                    <TableCell className="text-xs font-mono">{cls.key}</TableCell>
                    <TableCell className="text-xs">{localizedTaxText(cls.name, locale, cls.key)}</TableCell>
                    <TableCell>
                      {cls.is_default ? <Badge className="text-[10px]">{t('isDefault')}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-end tabular-nums">{cls.sort_order ?? 0}</TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={tc('edit')} onClick={() => openEdit(cls)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={tc('delete')}
                          className="text-red-500"
                          onClick={() => {
                            setDeleteError('');
                            setDeleteTarget(cls);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? t('editClass') : t('addClass')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('classKey')}</Label>
                <Input
                  className="h-8 text-sm font-mono"
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value })}
                  onBlur={() => setForm((f) => ({ ...f, key: normalizeKey(f.key) }))}
                  placeholder="standard"
                />
                <p className="text-[10px] text-muted-foreground">{t('classKeyHint')}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('sortOrder')}</Label>
                <Input
                  type="number"
                  className="h-8 w-32 text-sm"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                />
              </div>
            </div>
            <LocalizedTextFields
              label={t('className')}
              locales={locales}
              value={form.name}
              onChange={(name) => setForm({ ...form, name })}
              placeholder="Standard"
            />
            <label className={`flex items-center gap-2 ${editingCurrentDefault ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                className="rounded accent-primary disabled:opacity-60"
                checked={editingCurrentDefault || form.is_default}
                disabled={editingCurrentDefault}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              />
              <span className="text-xs font-medium">{t('isDefault')}</span>
            </label>
            <p className="text-[10px] text-muted-foreground">
              {editingCurrentDefault ? t('isDefaultLocked') : t('isDefaultHint')}
            </p>
            {formError && <p className="text-[11px] text-red-600">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={saving}>{tc('cancel')}</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? tc('saving') : tc('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('deleteClass')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteTarget && t('deleteClassConfirm', { name: localizedTaxText(deleteTarget.name, locale, deleteTarget.key) })}
          </p>
          {deleteError && <p className="text-[11px] text-red-600">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>{tc('cancel')}</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-3.5 animate-spin" />}
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
