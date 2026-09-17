'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface AttributeTranslation {
  locale: string;
  label: string;
  /** Optional per-option labels for SELECT / MULTI_SELECT ({ "cotton": "قطن" }). */
  option_labels?: Record<string, string> | null;
}

interface AttributeTemplate {
  id: string;
  name: string;
  type: string;
  unit?: string;
  options?: unknown;
  is_required: boolean;
  group_name?: string;
  sort_order: number;
  translations: AttributeTranslation[];
}

interface PlatformLocales {
  default_locale: string;
  supported_locales: string[];
}

const FALLBACK_LOCALES: PlatformLocales = { default_locale: 'en', supported_locales: ['en'] };

/** Locales whose label inputs should render right-to-left. */
const RTL_LOCALES = new Set(['ar']);

const typeColors: Record<string, string> = {
  TEXT: 'bg-zinc-100 text-zinc-700', NUMBER: 'bg-blue-50 text-blue-700',
  SELECT: 'bg-purple-50 text-purple-700', MULTI_SELECT: 'bg-indigo-50 text-indigo-700',
  BOOLEAN: 'bg-emerald-50 text-emerald-700', COLOR: 'bg-pink-50 text-pink-700',
  DIMENSIONS: 'bg-amber-50 text-amber-700',
};

/** Display label: platform default locale, then `en`, then the first entry, then the raw name. */
function pickLabel(translations: AttributeTranslation[], defaultLocale: string, name: string): string {
  return (
    translations.find(tr => tr.locale === defaultLocale)?.label ||
    translations.find(tr => tr.locale === 'en')?.label ||
    translations[0]?.label ||
    name
  );
}

const emptyForm = {
  name: '',
  type: 'TEXT',
  unit: '',
  group_name: '',
  is_required: false,
  /** Label per locale code, keyed by locale. */
  labels: {} as Record<string, string>,
  options: '',
};

export default function AdminAttributes() {
  const t = useTranslations('admin');
  const { token } = useAuth();
  const [templates, setTemplates] = useState<AttributeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [locales, setLocales] = useState<PlatformLocales>(FALLBACK_LOCALES);

  const fetchTemplates = async () => {
    if (!token) return;
    try {
      const res = await api<AttributeTemplate[]>('/attribute-templates', { token });
      setTemplates(Array.isArray(res) ? res : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTemplates(); }, [token]);

  // Platform locales drive the per-locale label inputs; loaded once.
  useEffect(() => {
    if (!token) return;
    api<Partial<PlatformLocales>>('/admin/platform-config', { token })
      .then(config => {
        const supported = config?.supported_locales?.length ? config.supported_locales : FALLBACK_LOCALES.supported_locales;
        const defaultLocale = config?.default_locale || FALLBACK_LOCALES.default_locale;
        setLocales({ default_locale: defaultLocale, supported_locales: supported });
      })
      .catch(console.error);
  }, [token]);

  // Locales rendered in the form; the default locale is always present even if
  // the platform config lists it inconsistently.
  const formLocales = useMemo(() => {
    const { default_locale, supported_locales } = locales;
    return supported_locales.includes(default_locale) ? supported_locales : [default_locale, ...supported_locales];
  }, [locales]);

  const defaultLabel = (form.labels[locales.default_locale] || '').trim();
  const canSave = !!form.name.trim() && !!defaultLabel;

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (tmpl: AttributeTemplate) => {
    setEditingId(tmpl.id);
    setForm({
      name: tmpl.name,
      type: tmpl.type,
      unit: tmpl.unit || '',
      group_name: tmpl.group_name || '',
      is_required: tmpl.is_required,
      labels: Object.fromEntries(tmpl.translations.map(tr => [tr.locale, tr.label])),
      options: Array.isArray(tmpl.options) ? tmpl.options.join(', ') : '',
    });
    setShowForm(true);
  };

  /**
   * Build the translations payload: one entry per filled platform locale, keeping
   * any existing option_labels. The API replaces all rows on update, so entries
   * for locales no longer in the platform list are carried over untouched.
   * Only DTO fields are emitted (the API forbids non-whitelisted properties).
   */
  const buildTranslations = (): AttributeTranslation[] => {
    const existing = editingId ? templates.find(x => x.id === editingId)?.translations ?? [] : [];
    const existingByLocale = new Map(existing.map(tr => [tr.locale, tr]));
    const result: AttributeTranslation[] = [];

    for (const locale of formLocales) {
      const label = (form.labels[locale] || '').trim();
      if (!label) continue;
      const prev = existingByLocale.get(locale);
      result.push({ locale, label, ...(prev?.option_labels != null && { option_labels: prev.option_labels }) });
    }
    for (const tr of existing) {
      if (formLocales.includes(tr.locale)) continue;
      result.push({ locale: tr.locale, label: tr.label, ...(tr.option_labels != null && { option_labels: tr.option_labels }) });
    }
    return result;
  };

  const handleSave = async () => {
    if (!token || !canSave) return;
    setSaving(true);
    try {
      const body = {
        name: form.name,
        type: form.type,
        unit: form.unit || undefined,
        group_name: form.group_name || undefined,
        is_required: form.is_required,
        options: form.options ? form.options.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        translations: buildTranslations(),
      };

      if (editingId) {
        await api(`/attribute-templates/${editingId}`, { method: 'PUT', token, body: JSON.stringify(body) });
      } else {
        await api('/attribute-templates', { method: 'POST', token, body: JSON.stringify(body) });
      }
      setShowForm(false);
      fetchTemplates();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    await api(`/attribute-templates/${id}`, { method: 'DELETE', token });
    setDeleteConfirm(null);
    fetchTemplates();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('attributeTemplates')}</h1>
          <p className="text-sm text-muted-foreground">{t('attributeTemplatesSubtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1.5" /> {t('addTemplate')}
        </Button>
      </div>

      <DataTable
        columns={[
          { key: 'name', label: t('name'), sortable: true, render: (item: AttributeTemplate) => (
            <div>
              <p className="text-sm font-medium font-mono">{item.name}</p>
              <p className="text-[10px] text-muted-foreground">{pickLabel(item.translations, locales.default_locale, item.name)}</p>
            </div>
          )},
          { key: 'type', label: t('type'), sortable: true, render: (item: AttributeTemplate) => (
            <Badge variant="secondary" className={`text-[10px] font-semibold ${typeColors[item.type] || ''}`}>{item.type}</Badge>
          )},
          { key: 'unit', label: t('unit'), render: (item: AttributeTemplate) => (
            <span className="text-xs text-muted-foreground">{item.unit || '—'}</span>
          )},
          { key: 'group_name', label: t('group'), sortable: true, render: (item: AttributeTemplate) => (
            <span className="text-xs">{item.group_name || '—'}</span>
          )},
          { key: 'is_required', label: t('required'), render: (item: AttributeTemplate) => (
            item.is_required ? <Badge className="text-[10px]">{t('yes')}</Badge> : <span className="text-xs text-muted-foreground">{t('no')}</span>
          )},
          { key: 'actions', label: '', render: (item: AttributeTemplate) => (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => openEdit(item)}>{t('edit')}</Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-500" onClick={() => setDeleteConfirm(item.id)}>{t('delete')}</Button>
            </div>
          )},
        ]}
        data={templates}
        emptyMessage={loading ? t('loading') : t('noAttributeTemplates')}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? t('editAttributeTemplate') : t('createAttributeTemplate')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('internalName')} *</Label>
                <Input className="h-8 text-sm" placeholder="fabric_type" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('type')} *</Label>
                <SearchableSelect
                  value={form.type}
                  onChange={(v) => setForm({ ...form, type: v })}
                  placeholder={t('selectType')}
                  options={[
                    { value: 'TEXT', label: t('typeText'), description: t('typeTextDesc') },
                    { value: 'NUMBER', label: t('typeNumber'), description: t('typeNumberDesc') },
                    { value: 'SELECT', label: t('typeSelect'), description: t('typeSelectDesc') },
                    { value: 'MULTI_SELECT', label: t('typeMultiSelect'), description: t('typeMultiSelectDesc') },
                    { value: 'BOOLEAN', label: t('typeBoolean'), description: t('typeBooleanDesc') },
                    { value: 'COLOR', label: t('typeColor'), description: t('typeColorDesc') },
                    { value: 'DIMENSIONS', label: t('typeDimensions'), description: t('typeDimensionsDesc') },
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('unit')}</Label>
                <Input className="h-8 text-sm" placeholder={t('unitPlaceholder')} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('group')}</Label>
                <Input className="h-8 text-sm" placeholder={t('groupPlaceholder')} value={form.group_name} onChange={e => setForm({ ...form, group_name: e.target.value })} />
              </div>
            </div>

            {/* One label input per platform-supported locale; the default locale is required. */}
            <div className="space-y-2">
              <Label className="text-xs">{t('localizedLabels')}</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {formLocales.map(locale => {
                  const isDefault = locale === locales.default_locale;
                  return (
                    <div key={locale} className="space-y-1">
                      <span className="block text-[10px] text-muted-foreground">
                        {t('labelIn', { locale: locale.toUpperCase() })}
                        {isDefault && (
                          <>
                            {' '}
                            <span className="font-medium text-foreground">{t('defaultLocaleMarker')}</span> *
                          </>
                        )}
                      </span>
                      <Input
                        className="h-8 text-sm"
                        dir={RTL_LOCALES.has(locale) ? 'rtl' : undefined}
                        placeholder={isDefault ? t('englishLabelPlaceholder') : undefined}
                        value={form.labels[locale] || ''}
                        onChange={e => setForm({ ...form, labels: { ...form.labels, [locale]: e.target.value } })}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {(form.type === 'SELECT' || form.type === 'MULTI_SELECT') && (
              <div className="space-y-1.5">
                <Label className="text-xs">{t('optionsCommaSeparated')}</Label>
                <Input className="h-8 text-sm" placeholder="cotton, polyester, blend" value={form.options} onChange={e => setForm({ ...form, options: e.target.value })} />
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded accent-primary" checked={form.is_required} onChange={e => setForm({ ...form, is_required: e.target.checked })} />
              <span className="text-xs font-medium">{t('requiredField')}</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>{t('cancel')}</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !canSave}>{saving ? t('saving') : editingId ? t('saveChanges') : t('create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('deleteAttributeTemplate')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {t('deleteAttributeTemplateConfirm')}
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>{t('cancel')}</Button>
            <Button variant="destructive" size="sm" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>{t('delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
