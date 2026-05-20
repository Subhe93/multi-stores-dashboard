'use client';

// Menus editor — WordPress-style. Left rail lists the store's menus; the
// main panel edits the selected menu's items (label + URL + new-tab). Items
// reorder with up/down; the whole list is saved in one PUT. Sections
// reference a menu by its `key`.

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  GripVertical,
  ListTree,
  Loader2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
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

interface MenuItem {
  id?: string;
  label: string;
  label_i18n?: Record<string, string>;
  url: string;
  open_in_new_tab?: boolean;
}

interface Menu {
  id: string;
  key: string;
  name: string;
  items: MenuItem[];
}

const LOCALE_LABELS: Record<string, string> = {
  en: 'English', ar: 'العربية', tr: 'Türkçe', de: 'Deutsch', fr: 'Français', es: 'Español',
};

function localeLabel(code: string): string {
  return LOCALE_LABELS[code] || code.toUpperCase();
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface StoreLangResponse {
  language_config?: { primary_locale?: string; secondary_locales?: string[] } | null;
}

export default function MenusPage() {
  const { token } = useAuth();

  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Store locales drive the per-item label translation tabs. Primary first.
  const [primaryLocale, setPrimaryLocale] = useState('en');
  const [locales, setLocales] = useState<string[]>(['en']);
  const [activeLocale, setActiveLocale] = useState('en');

  // Working copy of the selected menu's items (edited before save).
  const [items, setItems] = useState<MenuItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create-menu dialog state.
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Menu | null>(null);

  const selected = menus.find((m) => m.id === selectedId) || null;

  const loadMenus = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api<Menu[]>('/menus/mine', { token });
      setMenus(Array.isArray(data) ? data : []);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
        setItems(data[0].items || []);
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

  // Load the store's configured locales so we can offer translation tabs for
  // each item label. Single-locale stores skip the tabs entirely.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<StoreLangResponse>('/stores/my/store', { token })
      .then((s) => {
        if (cancelled) return;
        const primary = s.language_config?.primary_locale || 'en';
        const secondary = s.language_config?.secondary_locales || [];
        setPrimaryLocale(primary);
        setLocales([primary, ...secondary.filter((l) => l !== primary)]);
        setActiveLocale(primary);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  function selectMenu(menu: Menu) {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    setSelectedId(menu.id);
    setItems(menu.items || []);
    setDirty(false);
  }

  function updateItem(idx: number, patch: Partial<MenuItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    setDirty(true);
  }

  // Read/write a menu item's label for the active locale. Primary locale uses
  // the base `label`; secondary locales use `label_i18n[locale]`.
  function labelFor(item: MenuItem, locale: string): string {
    if (locale === primaryLocale) return item.label || '';
    return item.label_i18n?.[locale] || '';
  }

  function setLabelFor(idx: number, locale: string, value: string) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        if (locale === primaryLocale) return { ...it, label: value };
        const next = { ...(it.label_i18n || {}) };
        if (value) next[locale] = value;
        else delete next[locale];
        return { ...it, label_i18n: next };
      }),
    );
    setDirty(true);
  }

  function addItem() {
    setItems((prev) => [...prev, { label: '', url: '' }]);
    setDirty(true);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  }

  function move(idx: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = prev.slice();
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setDirty(true);
  }

  async function save() {
    if (!token || !selected) return;
    setSaving(true);
    try {
      // Keep items that have a URL and at least one label (primary or any
      // translation). If the primary label is blank but a translation exists,
      // promote the first translation to the base label so the item never
      // silently vanishes and always has a fallback. Send label_i18n only
      // when it has entries so empty objects don't bloat the payload.
      const cleaned = items
        .map((it) => {
          const translations = it.label_i18n || {};
          const base = it.label.trim() || Object.values(translations).find((v) => v?.trim())?.trim() || '';
          return { ...it, label: base };
        })
        .filter((it) => it.label && it.url.trim())
        .map((it) => ({
          label: it.label,
          url: it.url.trim(),
          open_in_new_tab: it.open_in_new_tab,
          ...(it.label_i18n && Object.keys(it.label_i18n).length > 0
            ? { label_i18n: it.label_i18n }
            : {}),
        }));
      const updated = await api<Menu>(`/menus/${selected.id}/items`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ items: cleaned }),
      });
      setMenus((prev) => prev.map((m) => (m.id === selected.id ? updated : m)));
      setItems(updated.items || []);
      setDirty(false);
    } catch (err) {
      console.error('Failed to save menu:', err);
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
      setItems(menu.items || []);
      setCreateOpen(false);
      setNewName('');
      setNewKey('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create menu';
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  }

  async function deleteMenu() {
    if (!token || !deleteTarget) return;
    try {
      await api(`/menus/${deleteTarget.id}`, { method: 'DELETE', token });
      setMenus((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      if (selectedId === deleteTarget.id) {
        setSelectedId(null);
        setItems([]);
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete menu:', err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Menus</h1>
          <p className="text-sm text-muted-foreground">
            Build navigation menus, then pick them in your Header or Footer sections by key.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New Menu
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
            <p className="text-sm font-medium">No menus yet</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              Create a menu like &quot;Main navigation&quot; or &quot;Footer links&quot;, add items,
              then reference it from a Header Bar or Footer Columns section.
            </p>
            <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Create First Menu
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
                  m.id === selectedId
                    ? 'border-zinc-900 bg-zinc-50'
                    : 'border-transparent hover:bg-zinc-50',
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
          {selected ? (
            <Card className="shadow-none">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold truncate">{selected.name}</h2>
                    <p className="text-[11px] text-zinc-400 font-mono">
                      key: {selected.key}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
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
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>

                {/* Locale tabs — only when the store has more than one locale.
                    The active tab decides which language the Label inputs edit;
                    URL + new-tab are shared across locales. */}
                {locales.length > 1 && (
                  <div className="flex items-center gap-1 p-0.5 rounded-md bg-zinc-100 w-fit">
                    {locales.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setActiveLocale(l)}
                        className={cn(
                          'px-2.5 py-1 text-[11px] font-medium rounded transition',
                          activeLocale === l
                            ? 'bg-white text-zinc-900 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-900',
                        )}
                      >
                        {localeLabel(l)}
                        {l === primaryLocale && (
                          <span className="ms-1 text-[8.5px] uppercase text-zinc-400">primary</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  {items.length === 0 && (
                    <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/40 px-3 py-6 text-center">
                      <p className="text-xs text-zinc-500">No items yet — add your first link below.</p>
                    </div>
                  )}
                  {items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white p-2.5"
                    >
                      <GripVertical className="size-4 text-zinc-300 mt-2 shrink-0" />
                      <div className="flex-1 grid gap-2 sm:grid-cols-2 min-w-0">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-zinc-500">
                            Label
                            {locales.length > 1 && (
                              <span className="ms-1 text-zinc-400">· {localeLabel(activeLocale)}</span>
                            )}
                          </Label>
                          <Input
                            className="h-8 text-[12.5px]"
                            value={labelFor(item, activeLocale)}
                            onChange={(e) => setLabelFor(i, activeLocale, e.target.value)}
                            placeholder={
                              activeLocale === primaryLocale
                                ? 'Home'
                                : labelFor(item, primaryLocale) || 'Translation'
                            }
                            dir={activeLocale === 'ar' ? 'rtl' : undefined}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-zinc-500">URL</Label>
                          <Input
                            className="h-8 text-[12.5px] font-mono"
                            value={item.url}
                            onChange={(e) => updateItem(i, { url: e.target.value })}
                            placeholder="/products"
                          />
                        </div>
                        <label className="flex items-center gap-1.5 text-[11px] text-zinc-600 sm:col-span-2">
                          <input
                            type="checkbox"
                            checked={!!item.open_in_new_tab}
                            onChange={(e) => updateItem(i, { open_in_new_tab: e.target.checked })}
                            className="size-3.5"
                          />
                          <ExternalLink className="size-3 text-zinc-400" />
                          Open in new tab
                        </label>
                      </div>
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                          className="size-6 inline-flex items-center justify-center rounded text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-30 transition"
                          title="Move up"
                        >
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(i, 1)}
                          disabled={i === items.length - 1}
                          className="size-6 inline-flex items-center justify-center rounded text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-30 transition"
                          title="Move down"
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(i)}
                          className="size-6 inline-flex items-center justify-center rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="Remove"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                  className="w-full border-dashed border-zinc-300 text-zinc-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/40"
                >
                  <Plus className="size-3.5" />
                  Add item
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-none border-dashed">
              <CardContent className="flex items-center justify-center py-16 text-sm text-zinc-500">
                Select a menu to edit its items.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New menu</DialogTitle>
            <DialogDescription>
              Give the menu a name. The key is auto-generated — sections reference the menu by key.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (!newKey) setNewKey('');
                }}
                placeholder="Main navigation"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Key</Label>
              <Input
                className="font-mono text-[12.5px]"
                value={newKey || slugify(newName)}
                onChange={(e) => setNewKey(slugify(e.target.value))}
                placeholder="main-nav"
              />
              <p className="text-[10.5px] text-zinc-400">
                Lowercase letters, digits, hyphens. Used by sections — e.g. <code>main-nav</code>.
              </p>
            </div>
            {createError && <p className="text-xs text-red-600">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={createMenu} disabled={creating || !newName.trim()}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete menu</DialogTitle>
            <DialogDescription>
              Delete <span className="font-medium text-foreground">{deleteTarget?.name}</span>? Sections
              referencing its key will fall back to their inline links. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteMenu}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
