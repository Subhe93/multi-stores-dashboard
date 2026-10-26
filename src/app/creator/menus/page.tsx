'use client';

// Menus editor — WordPress "Appearance → Menus" style. Left rail lists the
// store's menus; the editor card has two columns: "Add menu items" (pages,
// collections, products, custom link) and "Menu structure" (nested sortable
// tree, up to three levels). The whole tree is saved in one PUT. Sections
// reference a menu by its `key`.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, ListTree, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { LocaleTabs } from '@/components/common/LocaleTabs';
import { MenuItemSources } from '@/components/creator/menus/MenuItemSources';
import { MenuStructure } from '@/components/creator/menus/MenuStructure';
import {
  buildTree,
  flattenTree,
  labelFor,
  makeNode,
  type Menu,
  type MenuItemKind,
  type NewMenuItem,
  type TreeItem,
} from '@/components/creator/menus/types';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface StoreResponse {
  id: string;
  language_config?: { primary_locale?: string; secondary_locales?: string[] } | null;
}

// Request body for PUT /menus/:id/items (one node, recursive).
interface ItemPayload {
  id?: string;
  label: string;
  url: string;
  kind: MenuItemKind;
  resource_id: string | null;
  open_in_new_tab?: boolean;
  label_i18n?: Record<string, string>;
  children?: ItemPayload[];
}

// Serialize the tree. Keep nodes that have a URL and at least one label
// (primary or any translation); if the primary label is blank but a
// translation exists, promote it so the item never silently vanishes.
function toPayload(node: TreeItem): ItemPayload | null {
  const translations = node.label_i18n || {};
  const base = node.label.trim() || Object.values(translations).find((v) => v?.trim())?.trim() || '';
  if (!base || !node.url.trim()) return null;
  const children = node.children.map(toPayload).filter((c): c is ItemPayload => c !== null);
  return {
    ...(node.id ? { id: node.id } : {}),
    label: base,
    url: node.url.trim(),
    kind: node.kind,
    resource_id: node.kind === 'CUSTOM' ? null : node.resource_id,
    open_in_new_tab: !!node.open_in_new_tab,
    ...(Object.keys(translations).length > 0 ? { label_i18n: translations } : {}),
    ...(children.length > 0 ? { children } : {}),
  };
}

export default function MenusPage() {
  const { token } = useAuth();
  const t = useTranslations('creator');
  const tc = useTranslations('common');
  // Coded API errors (e.g. MENU_MAX_DEPTH) become translated messages.
  const apiError = useApiError();

  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Store id (legacy pages endpoint) + content locales for the label tabs.
  const [storeId, setStoreId] = useState<string | null>(null);
  const [primaryLocale, setPrimaryLocale] = useState('en');
  const [locales, setLocales] = useState<string[]>(['en']);
  const [activeLocale, setActiveLocale] = useState('en');

  // Working copy of the selected menu's items as an editable tree.
  const [items, setItems] = useState<TreeItem[]>([]);

  // Translation status per locale for the tabs: a secondary locale counts as
  // filled when every item in the tree has a label in it.
  const labelFilled = useMemo(() => {
    const rows = flattenTree(items);
    const out: Record<string, boolean> = {};
    for (const l of locales) {
      out[l] = rows.length > 0 && rows.every((r) => !!labelFor(r.node, l, primaryLocale).trim());
    }
    return out;
  }, [items, locales, primaryLocale]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Create-menu dialog state.
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Menu | null>(null);

  const selected = menus.find((m) => m.id === selectedId) || null;

  function loadTree(menu: Menu | null) {
    setItems(menu ? buildTree(menu.items || []) : []);
    setExpanded(new Set());
    setDirty(false);
  }

  const loadMenus = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api<Menu[]>('/menus/mine', { token });
      const list = Array.isArray(data) ? data : [];
      setMenus(list);
      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].id);
        loadTree(list[0]);
      }
    } catch (err) {
      console.error('Failed to load menus:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    loadMenus();
  }, [loadMenus]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<StoreResponse>('/stores/my/store', { token })
      .then((s) => {
        if (cancelled) return;
        setStoreId(s.id);
        const primary = s.language_config?.primary_locale || 'en';
        const secondary = s.language_config?.secondary_locales || [];
        setPrimaryLocale(primary);
        setLocales([primary, ...secondary.filter((l) => l && l !== primary)]);
        setActiveLocale(primary);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Unsaved-changes guard on tab close / reload.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function selectMenu(menu: Menu) {
    if (menu.id === selectedId) return;
    if (dirty && !confirm(t('menus.discardChanges'))) return;
    setSelectedId(menu.id);
    setSaveError('');
    loadTree(menu);
  }

  function changeItems(next: TreeItem[]) {
    setItems(next);
    setDirty(true);
  }

  // Append picked sources as top-level items; expand them so they are visible.
  function addItems(picked: NewMenuItem[]) {
    if (picked.length === 0) return;
    const nodes = picked.map(makeNode);
    setItems((prev) => [...prev, ...nodes]);
    setExpanded((prev) => {
      const next = new Set(prev);
      nodes.forEach((n) => next.add(n.cid));
      return next;
    });
    setDirty(true);
  }

  async function save() {
    if (!token || !selected) return;
    setSaving(true);
    setSaveError('');
    try {
      const cleaned = items.map(toPayload).filter((c): c is ItemPayload => c !== null);
      const updated = await api<Menu>(`/menus/${selected.id}/items`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ items: cleaned }),
      });
      setMenus((prev) => prev.map((m) => (m.id === selected.id ? updated : m)));
      loadTree(updated);
    } catch (err) {
      console.error('Failed to save menu:', err);
      setSaveError(err ? apiError(err) : t('menus.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function createMenu() {
    if (!token || !newName.trim()) return;
    setCreating(true);
    setCreateError('');
    const key = (newKey.trim() || slugify(newName)) || 'menu';
    try {
      const menu = await api<Menu>('/menus', {
        method: 'POST',
        token,
        body: JSON.stringify({ key, name: newName.trim() }),
      });
      setMenus((prev) => [...prev, menu]);
      setSelectedId(menu.id);
      loadTree(menu);
      setCreateOpen(false);
      setNewName('');
      setNewKey('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('menus.failedCreate');
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  }

  async function deleteMenu() {
    if (!token || !deleteTarget) return;
    setDeleteError('');
    try {
      await api(`/menus/${deleteTarget.id}`, { method: 'DELETE', token });
      setMenus((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      if (selectedId === deleteTarget.id) {
        setSelectedId(null);
        loadTree(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete menu:', err);
      setDeleteError((err instanceof Error && err.message) || t('menus.deleteFailed'));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('menus.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('menus.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          {t('menus.newMenu')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-5 animate-spin text-zinc-400" />
        </div>
      ) : menus.length === 0 ? (
        <Card className="shadow-none border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
              <ListTree className="size-6" />
            </div>
            <p className="text-sm font-medium">{t('menus.emptyTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">{t('menus.emptyDesc')}</p>
            <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              {t('menus.createFirstMenu')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          {/* Left rail — menu list */}
          <div className="space-y-1">
            {menus.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMenu(m)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-start transition border',
                  m.id === selectedId ? 'border-zinc-900 bg-zinc-50' : 'border-transparent hover:bg-zinc-50',
                )}
              >
                <ListTree className="size-4 text-zinc-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{m.name}</div>
                  <div className="text-[10px] font-mono text-zinc-400 truncate">{m.key}</div>
                </div>
                <span className="text-[10px] text-zinc-400 shrink-0">{m.items?.length ?? 0}</span>
              </button>
            ))}
          </div>

          {/* Editor */}
          {selected && token ? (
            <Card className="shadow-none">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold truncate">{selected.name}</h2>
                    <p className="text-[11px] text-zinc-400 font-mono">key: {selected.key}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {dirty && <span className="text-[11px] text-amber-600">{t('menus.unsaved')}</span>}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(selected)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                    <Button size="sm" onClick={save} disabled={!dirty || saving}>
                      {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                      {saving ? tc('saving') : tc('save')}
                    </Button>
                  </div>
                </div>

                {saveError && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    {saveError}
                  </div>
                )}

                {/* Locale tabs — only when the store has more than one locale.
                    The active tab decides which language the Label inputs edit;
                    URL + new-tab are shared across locales. */}
                <LocaleTabs
                  variant="pill"
                  value={activeLocale}
                  onChange={setActiveLocale}
                  locales={locales}
                  primaryLocale={primaryLocale}
                  filled={labelFilled}
                />

                {/* Two columns: sources (left) + structure (right) */}
                <div className="grid gap-5 lg:grid-cols-[300px_1fr] items-start">
                  <MenuItemSources
                    token={token}
                    storeId={storeId}
                    primaryLocale={primaryLocale}
                    locales={locales}
                    onAdd={addItems}
                  />
                  <MenuStructure
                    items={items}
                    onChange={changeItems}
                    activeLocale={activeLocale}
                    primaryLocale={primaryLocale}
                    locales={locales}
                    expanded={expanded}
                    onExpandedChange={setExpanded}
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-none border-dashed">
              <CardContent className="flex items-center justify-center py-16 text-sm text-zinc-500">
                {t('menus.selectToEdit')}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('menus.newMenuDialogTitle')}</DialogTitle>
            <DialogDescription>{t('menus.newMenuDialogDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">{tc('name')}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('menus.namePlaceholder')}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('menus.key')}</Label>
              <Input
                className="font-mono text-[12.5px]"
                value={newKey || slugify(newName)}
                onChange={(e) => setNewKey(slugify(e.target.value))}
                placeholder="main-nav"
              />
              <p className="text-[10.5px] text-zinc-400">{t('menus.keyHint')}</p>
            </div>
            {createError && <p className="text-xs text-red-600">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              {tc('cancel')}
            </Button>
            <Button onClick={createMenu} disabled={creating || !newName.trim()}>
              {creating ? t('menus.creating') : tc('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteTarget(null);
            setDeleteError('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('menus.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('menus.deleteConfirmPrefix')}{' '}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>
              {t('menus.deleteConfirmSuffix')}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteError(''); }}>
              {tc('cancel')}
            </Button>
            <Button variant="destructive" onClick={deleteMenu}>
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
