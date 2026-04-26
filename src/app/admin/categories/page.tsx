'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { Plus, ChevronRight, ChevronDown, FolderTree, Pencil, Trash2, Link2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface Category {
  id: string;
  slug: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  translations: { locale: string; name: string; description?: string }[];
  children: Category[];
  attribute_templates?: { template: { id: string; name: string; type: string; translations: { locale: string; label: string }[] } }[];
}

interface AttrTemplate {
  id: string;
  name: string;
  type: string;
  translations: { locale: string; label: string }[];
}

export default function AdminCategories() {
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTemplates, setAllTemplates] = useState<AttrTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [showCreate, setShowCreate] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [linkingCat, setLinkingCat] = useState<Category | null>(null);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);

  // Form state
  const [formSlug, setFormSlug] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formDescEn, setFormDescEn] = useState('');
  const [formIcon, setFormIcon] = useState('');
  const [formParentId, setFormParentId] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    try {
      const [cats, attrs] = await Promise.all([
        api<Category[]>('/categories'),
        token ? api<AttrTemplate[]>('/attribute-templates', { token }) : Promise.resolve([]),
      ]);
      setCategories(Array.isArray(cats) ? cats : []);
      setAllTemplates(Array.isArray(attrs) ? attrs : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [token]);

  const resetForm = () => {
    setFormSlug(''); setFormNameEn(''); setFormNameAr(''); setFormDescEn(''); setFormIcon(''); setFormParentId('');
  };

  const openEdit = (cat: Category) => {
    setEditingCat(cat);
    setFormSlug(cat.slug);
    setFormIcon(cat.icon || '');
    setFormNameEn(cat.translations.find(t => t.locale === 'en')?.name || '');
    setFormNameAr(cat.translations.find(t => t.locale === 'ar')?.name || '');
    setFormDescEn(cat.translations.find(t => t.locale === 'en')?.description || '');
  };

  const openLink = async (cat: Category) => {
    if (!token) return;
    setLinkingCat(cat);
    // Fetch category with attributes
    const full = await api<Category>(`/categories/${cat.id}`, { token });
    const ids = (full as any)?.attribute_templates?.map((at: any) => at.template?.id || at.template_id) || [];
    setLinkedIds(ids);
  };

  const handleCreate = async () => {
    if (!token || !formSlug || !formNameEn) return;
    setSaving(true);
    try {
      await api('/categories', {
        method: 'POST', token,
        body: JSON.stringify({
          slug: formSlug,
          icon: formIcon || undefined,
          parent_id: formParentId || undefined,
          translations: [
            { locale: 'en', name: formNameEn, description: formDescEn || undefined },
            ...(formNameAr ? [{ locale: 'ar', name: formNameAr }] : []),
          ],
        }),
      });
      setShowCreate(false);
      resetForm();
      fetchAll();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!token || !editingCat) return;
    setSaving(true);
    try {
      await api(`/categories/${editingCat.id}`, {
        method: 'PUT', token,
        body: JSON.stringify({
          slug: formSlug,
          icon: formIcon || undefined,
          translations: [
            { locale: 'en', name: formNameEn, description: formDescEn || undefined },
            ...(formNameAr ? [{ locale: 'ar', name: formNameAr }] : []),
          ],
        }),
      });
      setEditingCat(null);
      resetForm();
      fetchAll();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!token || !confirm('Delete this category and all its children?')) return;
    await api(`/categories/${id}`, { method: 'DELETE', token });
    fetchAll();
  };

  const handleSaveLinks = async () => {
    if (!token || !linkingCat) return;
    setSaving(true);
    try {
      await api(`/categories/${linkingCat.id}/attributes`, {
        method: 'POST', token,
        body: JSON.stringify({ template_ids: linkedIds }),
      });
      setLinkingCat(null);
      fetchAll();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const flatCategories = (cats: Category[], prefix = ''): { id: string; label: string }[] => {
    const result: { id: string; label: string }[] = [];
    for (const c of cats) {
      const name = c.translations.find(t => t.locale === 'en')?.name || c.slug;
      result.push({ id: c.id, label: prefix + name });
      if (c.children) result.push(...flatCategories(c.children, prefix + '— '));
    }
    return result;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground">Manage product categories and attribute templates</p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Category
        </Button>
      </div>

      <Card className="shadow-none">
        <CardContent className="pt-2 pb-2">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No categories yet</p>
          ) : (
            <div>{categories.map(cat => <CatRow key={cat.id} cat={cat} level={0} onEdit={openEdit} onDelete={handleDelete} onLink={openLink} />)}</div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Create Category</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Slug *</Label>
                <Input className="h-8 text-sm" placeholder="printed-shirts" value={formSlug} onChange={e => setFormSlug(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Icon</Label>
                <Input className="h-8 text-sm" placeholder="shirt, tree, gem..." value={formIcon} onChange={e => setFormIcon(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Parent Category</Label>
              <SearchableSelect
                value={formParentId}
                onChange={setFormParentId}
                placeholder="None (root category)"
                searchPlaceholder="Search categories..."
                options={[
                  { value: '', label: 'None (root category)', description: 'Top-level category' },
                  ...flatCategories(categories).map(c => ({ value: c.id, label: c.label })),
                ]}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name (English) *</Label>
                <Input className="h-8 text-sm" value={formNameEn} onChange={e => setFormNameEn(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Name (Arabic)</Label>
                <Input className="h-8 text-sm" dir="rtl" value={formNameAr} onChange={e => setFormNameAr(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (English)</Label>
              <Input className="h-8 text-sm" value={formDescEn} onChange={e => setFormDescEn(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingCat} onOpenChange={() => setEditingCat(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit Category</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Slug</Label>
                <Input className="h-8 text-sm" value={formSlug} onChange={e => setFormSlug(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Icon</Label>
                <Input className="h-8 text-sm" value={formIcon} onChange={e => setFormIcon(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name (English)</Label>
                <Input className="h-8 text-sm" value={formNameEn} onChange={e => setFormNameEn(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Name (Arabic)</Label>
                <Input className="h-8 text-sm" dir="rtl" value={formNameAr} onChange={e => setFormNameAr(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input className="h-8 text-sm" value={formDescEn} onChange={e => setFormDescEn(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingCat(null)}>Cancel</Button>
            <Button size="sm" onClick={handleUpdate} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Attributes Dialog */}
      <Dialog open={!!linkingCat} onOpenChange={() => setLinkingCat(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link Attributes — {linkingCat?.translations.find(t => t.locale === 'en')?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto py-2">
            {allTemplates.map(tmpl => {
              const checked = linkedIds.includes(tmpl.id);
              const label = tmpl.translations.find(t => t.locale === 'en')?.label || tmpl.name;
              return (
                <label key={tmpl.id} className={`flex items-center gap-3 p-2.5 border rounded-lg cursor-pointer transition ${checked ? 'border-primary bg-primary/5' : 'hover:bg-zinc-50'}`}>
                  <input type="checkbox" className="rounded accent-primary" checked={checked}
                    onChange={() => setLinkedIds(checked ? linkedIds.filter(id => id !== tmpl.id) : [...linkedIds, tmpl.id])} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{tmpl.name} · {tmpl.type}</p>
                  </div>
                </label>
              );
            })}
            {allTemplates.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No attribute templates. Create some first.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setLinkingCat(null)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveLinks} disabled={saving}>{saving ? 'Saving...' : `Save (${linkedIds.length} selected)`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Category row component
function CatRow({ cat, level, onEdit, onDelete, onLink }: {
  cat: Category; level: number;
  onEdit: (c: Category) => void; onDelete: (id: string) => void; onLink: (c: Category) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const name = cat.translations.find(t => t.locale === 'en')?.name || cat.slug;
  const hasChildren = cat.children && cat.children.length > 0;

  return (
    <div>
      <div className="py-2 px-2 flex items-center justify-between hover:bg-zinc-50 rounded-md group" style={{ paddingLeft: `${8 + level * 24}px` }}>
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <button onClick={() => setExpanded(!expanded)} className="p-0.5">
              {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          ) : <span className="w-4.5" />}
          <FolderTree className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{name}</span>
          <Badge variant="outline" className="text-[9px] font-mono">/{cat.slug}</Badge>
          {hasChildren && <Badge variant="secondary" className="text-[9px]">{cat.children.length} sub</Badge>}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Link attributes" onClick={() => onLink(cat)}>
            <Link2 className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Edit" onClick={() => onEdit(cat)}>
            <Pencil className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" title="Delete" onClick={() => onDelete(cat.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
      {expanded && hasChildren && cat.children.map(child => (
        <CatRow key={child.id} cat={child} level={level + 1} onEdit={onEdit} onDelete={onDelete} onLink={onLink} />
      ))}
    </div>
  );
}
