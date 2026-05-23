'use client';

// Menus editor — WordPress-style. Left rail lists the store's menus; the
// main panel edits the selected menu's items (label + URL + new-tab). Items
// reorder with up/down; the whole list is saved in one PUT. Sections
// reference a menu by its `key`.

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowDown,
  ArrowUp,
  CornerDownRight,
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

// Flat item as returned by the API (includes nesting + ordering metadata).
interface MenuItem {
  id?: string;
  parent_id?: string | null;
  sort_order?: number;
  label: string;
  label_i18n?: Record<string, string>;
  url: string;
  open_in_new_tab?: boolean;
}

// Editor working shape: a 2-level tree. Top-level items may carry `children`
// (one nesting level — dropdowns); child nodes keep an empty children array.
interface TreeItem {
  id?: string;
  label: string;
  label_i18n?: Record<string, string>;
  url: string;
  open_in_new_tab?: boolean;
  children: TreeItem[];
}

interface Menu {
  id: string;
  key: string;
  name: string;
  items: MenuItem[];
}

// Rebuild the editor tree from the API's flat, sort_order-ordered item list.
// Top-level items keep their order; each item's children are grouped under it
// in encounter order (which is ascending sort_order within the parent).
function buildTree(flat: MenuItem[]): TreeItem[] {
  const toNode = (i: MenuItem): TreeItem => ({
    id: i.id,
    label: i.label,
    label_i18n: i.label_i18n,
    url: i.url,
    open_in_new_tab: i.open_in_new_tab,
    children: [],
  });
  const tops: TreeItem[] = [];
  const byId = new Map<string, TreeItem>();
  for (const i of flat) {
    if (!i.parent_id) {
      const node = toNode(i);
      if (i.id) byId.set(i.id, node);
      tops.push(node);
    }
  }
  for (const i of flat) {
    if (i.parent_id) {
      const parent = byId.get(i.parent_id);
      // Orphans (missing parent) fall back to top level so they never vanish.
      (parent ? parent.children : tops).push(toNode(i));
    }
  }
  return tops;
}

const LOCALE_LABELS: Record<string, string> = {
  en: 'English', ar: 'العربية', tr: 'Türkçe', de: 'Deutsch', fr: 'Français', sv: 'Svenska', es: 'Español',
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
  const t = useTranslations('creator');
  const tc = useTranslations('common');

  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Store locales drive the per-item label translation tabs. Primary first.
  const [primaryLocale, setPrimaryLocale] = useState('en');
  const [locales, setLocales] = useState<string[]>(['en']);
  const [activeLocale, setActiveLocale] = useState('en');

  // Working copy of the selected menu's items as an editable tree.
  const [items, setItems] = useState<TreeItem[]>([]);
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
        setItems(buildTree(data[0].items || []));
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
    if (dirty && !confirm(t('menus.discardChanges'))) return;
    setSelectedId(menu.id);
    setItems(buildTree(menu.items || []));
    setDirty(false);
  }

  // Read a node's label for the active locale. Primary locale uses the base
  // `label`; secondary locales use `label_i18n[locale]`.
  function labelFor(node: TreeItem, locale: string): string {
    if (locale === primaryLocale) return node.label || '';
    return node.label_i18n?.[locale] || '';
  }

  // Return a copy of `node` with its label for `locale` set to `value`.
  function withLabel(node: TreeItem, locale: string, value: string): TreeItem {
    if (locale === primaryLocale) return { ...node, label: value };
    const next = { ...(node.label_i18n || {}) };
    if (value) next[locale] = value;
    else delete next[locale];
    return { ...node, label_i18n: next };
  }

  // ── Top-level item mutations ──────────────────────────────
  function patchTop(ti: number, patch: Partial<TreeItem>) {
    setItems((prev) => prev.map((t, i) => (i === ti ? { ...t, ...patch } : t)));
    setDirty(true);
  }
  function setTopLabel(ti: number, locale: string, value: string) {
    setItems((prev) => prev.map((t, i) => (i === ti ? withLabel(t, locale, value) : t)));
    setDirty(true);
  }
  function addTop() {
    setItems((prev) => [...prev, { label: '', url: '', children: [] }]);
    setDirty(true);
  }
  function removeTop(ti: number) {
    setItems((prev) => prev.filter((_, i) => i !== ti));
    setDirty(true);
  }
  function moveTop(ti: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = prev.slice();
      const target = ti + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[ti], next[target]] = [next[target], next[ti]];
      return next;
    });
    setDirty(true);
  }

  // ── Child (sub-item) mutations ────────────────────────────
  function patchChild(ti: number, ci: number, patch: Partial<TreeItem>) {
    setItems((prev) =>
      prev.map((t, i) =>
        i === ti ? { ...t, children: t.children.map((c, j) => (j === ci ? { ...c, ...patch } : c)) } : t,
      ),
    );
    setDirty(true);
  }
  function setChildLabel(ti: number, ci: number, locale: string, value: string) {
    setItems((prev) =>
      prev.map((t, i) =>
        i === ti ? { ...t, children: t.children.map((c, j) => (j === ci ? withLabel(c, locale, value) : c)) } : t,
      ),
    );
    setDirty(true);
  }
  function addSub(ti: number) {
    setItems((prev) =>
      prev.map((t, i) => (i === ti ? { ...t, children: [...t.children, { label: '', url: '', children: [] }] } : t)),
    );
    setDirty(true);
  }
  function removeChild(ti: number, ci: number) {
    setItems((prev) =>
      prev.map((t, i) => (i === ti ? { ...t, children: t.children.filter((_, j) => j !== ci) } : t)),
    );
    setDirty(true);
  }
  function moveChild(ti: number, ci: number, dir: -1 | 1) {
    setItems((prev) =>
      prev.map((t, i) => {
        if (i !== ti) return t;
        const ch = t.children.slice();
        const target = ci + dir;
        if (target < 0 || target >= ch.length) return t;
        [ch[ci], ch[target]] = [ch[target], ch[ci]];
        return { ...t, children: ch };
      }),
    );
    setDirty(true);
  }

  async function save() {
    if (!token || !selected) return;
    setSaving(true);
    try {
      // Serialize the tree. Keep nodes that have a URL and at least one label
      // (primary or any translation); if the primary label is blank but a
      // translation exists, promote it so the item never silently vanishes.
      // Send label_i18n / children only when non-empty to keep payloads lean.
      type Payload = {
        label: string;
        url: string;
        open_in_new_tab?: boolean;
        label_i18n?: Record<string, string>;
        children?: Payload[];
      };
      const toPayload = (node: TreeItem): Payload | null => {
        const translations = node.label_i18n || {};
        const base =
          node.label.trim() || Object.values(translations).find((v) => v?.trim())?.trim() || '';
        if (!base || !node.url.trim()) return null;
        const children = node.children
          .map(toPayload)
          .filter((c): c is Payload => c !== null);
        return {
          label: base,
          url: node.url.trim(),
          open_in_new_tab: node.open_in_new_tab,
          ...(Object.keys(translations).length > 0 ? { label_i18n: translations } : {}),
          ...(children.length > 0 ? { children } : {}),
        };
      };
      const cleaned = items.map(toPayload).filter((c): c is Payload => c !== null);
      const updated = await api<Menu>(`/menus/${selected.id}/items`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ items: cleaned }),
      });
      setMenus((prev) => prev.map((m) => (m.id === selected.id ? updated : m)));
      setItems(buildTree(updated.items || []));
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
      setItems(buildTree(menu.items || []));
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

  // Shared label / URL / new-tab fields for one node. Rendered as a plain
  // function call (not a component) so the inputs keep focus across renders.
  const renderFields = (
    node: TreeItem,
    onLabel: (locale: string, v: string) => void,
    onUrl: (v: string) => void,
    onNewTab: (checked: boolean) => void,
  ) => (
    <div className="flex-1 grid gap-2 sm:grid-cols-2 min-w-0">
      <div className="space-y-1">
        <Label className="text-[10px] text-zinc-500">
          {t('menus.label')}
          {locales.length > 1 && (
            <span className="ms-1 text-zinc-400">· {localeLabel(activeLocale)}</span>
          )}
        </Label>
        <Input
          className="h-8 text-[12.5px]"
          value={labelFor(node, activeLocale)}
          onChange={(e) => onLabel(activeLocale, e.target.value)}
          placeholder={
            activeLocale === primaryLocale
              ? t('menus.labelPlaceholder')
              : labelFor(node, primaryLocale) || t('menus.translationPlaceholder')
          }
          dir={activeLocale === 'ar' ? 'rtl' : undefined}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] text-zinc-500">{t('menus.url')}</Label>
        <Input
          className="h-8 text-[12.5px] font-mono"
          value={node.url}
          onChange={(e) => onUrl(e.target.value)}
          placeholder="/products"
        />
      </div>
      <label className="flex items-center gap-1.5 text-[11px] text-zinc-600 sm:col-span-2">
        <input
          type="checkbox"
          checked={!!node.open_in_new_tab}
          onChange={(e) => onNewTab(e.target.checked)}
          className="size-3.5"
        />
        <ExternalLink className="size-3 text-zinc-400" />
        {t('menus.openInNewTab')}
      </label>
    </div>
  );

  // Vertical move + delete controls for one row.
  const renderControls = (
    onUp: () => void,
    onDown: () => void,
    onRemove: () => void,
    canUp: boolean,
    canDown: boolean,
  ) => (
    <div className="flex flex-col gap-0.5 shrink-0">
      <button
        type="button"
        onClick={onUp}
        disabled={!canUp}
        className="size-6 inline-flex items-center justify-center rounded text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-30 transition"
        title={t('menus.moveUp')}
      >
        <ArrowUp className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={!canDown}
        className="size-6 inline-flex items-center justify-center rounded text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-30 transition"
        title={t('menus.moveDown')}
      >
        <ArrowDown className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="size-6 inline-flex items-center justify-center rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 transition"
        title={tc('remove')}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('menus.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('menus.subtitle')}
          </p>
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
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              {t('menus.emptyDesc')}
            </p>
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
                      {saving ? tc('saving') : tc('save')}
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
                          <span className="ms-1 text-[8.5px] uppercase text-zinc-400">{t('menus.primary')}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  {items.length === 0 && (
                    <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/40 px-3 py-6 text-center">
                      <p className="text-xs text-zinc-500">{t('menus.noItemsYet')}</p>
                    </div>
                  )}
                  {items.map((item, ti) => (
                    <div key={ti} className="space-y-2">
                      {/* Top-level item */}
                      <div className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white p-2.5">
                        <GripVertical className="size-4 text-zinc-300 mt-2 shrink-0" />
                        {renderFields(
                          item,
                          (locale, v) => setTopLabel(ti, locale, v),
                          (v) => patchTop(ti, { url: v }),
                          (checked) => patchTop(ti, { open_in_new_tab: checked }),
                        )}
                        {renderControls(
                          () => moveTop(ti, -1),
                          () => moveTop(ti, 1),
                          () => removeTop(ti),
                          ti > 0,
                          ti < items.length - 1,
                        )}
                      </div>

                      {/* Sub-items (one nesting level) */}
                      <div className="ms-5 ps-3 border-s-2 border-zinc-100 space-y-2">
                          {item.children.map((child, ci) => (
                            <div
                              key={ci}
                              className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50/50 p-2.5"
                            >
                              <CornerDownRight className="size-4 text-zinc-300 mt-2 shrink-0" />
                              {renderFields(
                                child,
                                (locale, v) => setChildLabel(ti, ci, locale, v),
                                (v) => patchChild(ti, ci, { url: v }),
                                (checked) => patchChild(ti, ci, { open_in_new_tab: checked }),
                              )}
                              {renderControls(
                                () => moveChild(ti, ci, -1),
                                () => moveChild(ti, ci, 1),
                                () => removeChild(ti, ci),
                                ci > 0,
                                ci < item.children.length - 1,
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addSub(ti)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-indigo-600 transition"
                          >
                            <Plus className="size-3" />
                            {t('menus.addSubItem')}
                          </button>
                        </div>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTop}
                  className="w-full border-dashed border-zinc-300 text-zinc-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/40"
                >
                  <Plus className="size-3.5" />
                  {t('menus.addItem')}
                </Button>
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
            <DialogDescription>
              {t('menus.newMenuDialogDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">{tc('name')}</Label>
              <Input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (!newKey) setNewKey('');
                }}
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
              <p className="text-[10.5px] text-zinc-400">
                {t('menus.keyHint')}
              </p>
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
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('menus.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('menus.deleteConfirmPrefix')} <span className="font-medium text-foreground">{deleteTarget?.name}</span>{t('menus.deleteConfirmSuffix')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
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
