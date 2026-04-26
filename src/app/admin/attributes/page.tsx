'use client';

import { useEffect, useState } from 'react';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, X } from 'lucide-react';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface AttributeTemplate {
  id: string;
  name: string;
  type: string;
  unit?: string;
  options?: any;
  is_required: boolean;
  group_name?: string;
  sort_order: number;
  translations: { locale: string; label: string }[];
}

const typeColors: Record<string, string> = {
  TEXT: 'bg-zinc-100 text-zinc-700', NUMBER: 'bg-blue-50 text-blue-700',
  SELECT: 'bg-purple-50 text-purple-700', MULTI_SELECT: 'bg-indigo-50 text-indigo-700',
  BOOLEAN: 'bg-emerald-50 text-emerald-700', COLOR: 'bg-pink-50 text-pink-700',
  DIMENSIONS: 'bg-amber-50 text-amber-700',
};

const emptyForm = { name: '', type: 'TEXT', unit: '', group_name: '', is_required: false, label_en: '', label_ar: '', options: '' };

export default function AdminAttributes() {
  const { token } = useAuth();
  const [templates, setTemplates] = useState<AttributeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = async () => {
    if (!token) return;
    try {
      const res = await api<AttributeTemplate[]>('/attribute-templates', { token });
      setTemplates(Array.isArray(res) ? res : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTemplates(); }, [token]);

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
      label_en: tmpl.translations.find(t => t.locale === 'en')?.label || '',
      label_ar: tmpl.translations.find(t => t.locale === 'ar')?.label || '',
      options: Array.isArray(tmpl.options) ? tmpl.options.join(', ') : '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!token || !form.name) return;
    setSaving(true);
    try {
      const body = {
        name: form.name,
        type: form.type,
        unit: form.unit || undefined,
        group_name: form.group_name || undefined,
        is_required: form.is_required,
        options: form.options ? form.options.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        translations: [
          { locale: 'en', label: form.label_en || form.name },
          ...(form.label_ar ? [{ locale: 'ar', label: form.label_ar }] : []),
        ],
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
          <h1 className="text-xl font-semibold tracking-tight">Attribute Templates</h1>
          <p className="text-sm text-muted-foreground">Define product specifications for categories</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Template
        </Button>
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'Name', sortable: true, render: (item: AttributeTemplate) => (
            <div>
              <p className="text-sm font-medium font-mono">{item.name}</p>
              <p className="text-[10px] text-muted-foreground">{item.translations.find(t => t.locale === 'en')?.label}</p>
            </div>
          )},
          { key: 'type', label: 'Type', sortable: true, render: (item: AttributeTemplate) => (
            <Badge variant="secondary" className={`text-[10px] font-semibold ${typeColors[item.type] || ''}`}>{item.type}</Badge>
          )},
          { key: 'unit', label: 'Unit', render: (item: AttributeTemplate) => (
            <span className="text-xs text-muted-foreground">{item.unit || '—'}</span>
          )},
          { key: 'group_name', label: 'Group', sortable: true, render: (item: AttributeTemplate) => (
            <span className="text-xs">{item.group_name || '—'}</span>
          )},
          { key: 'is_required', label: 'Required', render: (item: AttributeTemplate) => (
            item.is_required ? <Badge className="text-[10px]">Yes</Badge> : <span className="text-xs text-muted-foreground">No</span>
          )},
          { key: 'actions', label: '', render: (item: AttributeTemplate) => (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => openEdit(item)}>Edit</Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-500" onClick={() => setDeleteConfirm(item.id)}>Delete</Button>
            </div>
          )},
        ]}
        data={templates}
        emptyMessage={loading ? 'Loading...' : 'No attribute templates'}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit' : 'Create'} Attribute Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Internal Name *</Label>
                <Input className="h-8 text-sm" placeholder="fabric_type" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type *</Label>
                <SearchableSelect
                  value={form.type}
                  onChange={(v) => setForm({ ...form, type: v })}
                  placeholder="Select type..."
                  options={[
                    { value: 'TEXT', label: 'Text', description: 'Short text input' },
                    { value: 'NUMBER', label: 'Number', description: 'Numeric value' },
                    { value: 'SELECT', label: 'Select', description: 'Single choice dropdown' },
                    { value: 'MULTI_SELECT', label: 'Multi Select', description: 'Multiple choices' },
                    { value: 'BOOLEAN', label: 'Boolean', description: 'Yes/No toggle' },
                    { value: 'COLOR', label: 'Color', description: 'Color picker' },
                    { value: 'DIMENSIONS', label: 'Dimensions', description: 'Width x Height' },
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unit</Label>
                <Input className="h-8 text-sm" placeholder="cm, kg..." value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Group</Label>
                <Input className="h-8 text-sm" placeholder="material..." value={form.group_name} onChange={e => setForm({ ...form, group_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">English Label *</Label>
                <Input className="h-8 text-sm" placeholder="Fabric Type" value={form.label_en} onChange={e => setForm({ ...form, label_en: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Arabic Label</Label>
                <Input className="h-8 text-sm" dir="rtl" placeholder="نوع القماش" value={form.label_ar} onChange={e => setForm({ ...form, label_ar: e.target.value })} />
              </div>
            </div>
            {(form.type === 'SELECT' || form.type === 'MULTI_SELECT') && (
              <div className="space-y-1.5">
                <Label className="text-xs">Options (comma separated)</Label>
                <Input className="h-8 text-sm" placeholder="cotton, polyester, blend" value={form.options} onChange={e => setForm({ ...form, options: e.target.value })} />
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded accent-primary" checked={form.is_required} onChange={e => setForm({ ...form, is_required: e.target.checked })} />
              <span className="text-xs font-medium">Required field</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Attribute Template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete this attribute template? This action cannot be undone.
            Products using this attribute will lose their values.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
