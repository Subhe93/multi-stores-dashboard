'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Check, ChevronsUpDown, X, FolderTree, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Props {
  value: string[];
  onChange: (ids: string[]) => void;
}

interface CollectionNode {
  id: string;
  slug: string;
  parent_id?: string | null;
  translations?: { locale: string; name: string }[];
  children?: CollectionNode[];
}

interface FlatOption {
  id: string;
  label: string;
}

/**
 * Pick the best display name for a collection — prefer English,
 * fall back to the first available translation, then the slug.
 */
function getName(node: CollectionNode): string {
  const en = node.translations?.find((tr) => tr.locale === 'en')?.name;
  if (en) return en;
  const first = node.translations?.[0]?.name;
  return first || node.slug;
}

/**
 * Flatten the collection tree into a list of options, each labeled
 * with the full parent path (e.g. "Apparel / Hoodies").
 */
function flatten(nodes: CollectionNode[], prefix = ''): FlatOption[] {
  const out: FlatOption[] = [];
  for (const n of nodes) {
    const name = getName(n);
    const label = prefix ? `${prefix} / ${name}` : name;
    out.push({ id: n.id, label });
    if (n.children?.length) {
      out.push(...flatten(n.children, label));
    }
  }
  return out;
}

export function CollectionsMultiSelect({ value, onChange }: Props) {
  const { token } = useAuth();
  const t = useTranslations('components');
  const [options, setOptions] = useState<FlatOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxListHeight: number;
  }>({ left: 0, width: 0, maxListHeight: 280 });
  const triggerRef = useRef<HTMLDivElement>(null);

  // Fetch creator collections on mount.
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api<CollectionNode[]>('/creator-categories', { token })
      .then((tree) => {
        setOptions(flatten(Array.isArray(tree) ? tree : []));
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [token]);

  const selected = value
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is FlatOption => Boolean(o));

  const q = search.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
    : options;

  useEffect(() => {
    if (!open) return;
    const compute = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const margin = 8;
      // Approx height of the fixed search box + footer; the rest is the list.
      const chrome = 90;
      const width = Math.max(r.width, 360);
      const spaceBelow = window.innerHeight - r.bottom - margin;
      const spaceAbove = r.top - margin;
      // Open upward only when there isn't enough room below but there is above.
      const placeBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove;
      const avail = placeBelow ? spaceBelow : spaceAbove;
      const maxListHeight = Math.max(120, Math.min(280, avail - chrome));
      const left = Math.min(
        Math.max(margin, r.left),
        Math.max(margin, window.innerWidth - width - margin),
      );
      if (placeBelow) {
        setPos({ top: r.bottom + 4, bottom: undefined, left, width, maxListHeight });
      } else {
        setPos({ top: undefined, bottom: window.innerHeight - r.top + 4, left, width, maxListHeight });
      }
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  // Empty state: no collections at all — guide the user to create one.
  if (!loading && options.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-zinc-50/60 p-4 text-center">
        <FolderTree className="mx-auto mb-2 size-5 text-zinc-400" />
        <p className="text-xs text-muted-foreground mb-3">
          {t.rich('noCollectionsYetCreate', {
            link: (chunks) => (
              <Link href="/creator/categories" className="text-primary hover:underline font-medium">
                {chunks}
              </Link>
            ),
          })}
        </p>
        <Link
          href="/creator/categories/new"
          className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-zinc-100"
        >
          <Plus className="size-3" /> {t('newCollection')}
        </Link>
      </div>
    );
  }

  return (
    <div className="relative" ref={triggerRef}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(!open)}
        className={cn(
          'flex min-h-9 w-full cursor-pointer flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          open && 'ring-2 ring-ring ring-offset-1',
        )}
      >
        {selected.length === 0 ? (
          <span className="px-1 text-sm text-muted-foreground">
            {loading ? t('loadingCollections') : t('addToCollections')}
          </span>
        ) : (
          selected.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium"
            >
              <FolderTree className="size-3 text-zinc-400" />
              <span className="max-w-[220px] truncate">{c.label}</span>
              <button
                type="button"
                className="ms-0.5 text-zinc-400 hover:text-zinc-700"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(c.id);
                }}
                aria-label={t('removeNamed', { name: c.label })}
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))
        )}
        <ChevronsUpDown className="ms-auto size-3.5 shrink-0 opacity-40" />
      </div>

      {open && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed z-[9999] overflow-hidden rounded-lg border bg-popover shadow-xl"
            style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="border-b p-2">
              <input
                autoFocus
                type="text"
                placeholder={t('searchCollections')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: pos.maxListHeight }}>
              {loading ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  {t('loadingEllipsis')}
                </p>
              ) : filtered.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  {t('noCollectionsFound')}
                </p>
              ) : (
                filtered.map((c) => {
                  const isSel = value.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle(c.id)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-start text-sm transition',
                        isSel ? 'bg-zinc-100' : 'hover:bg-zinc-50',
                      )}
                    >
                      <FolderTree className="size-3.5 shrink-0 text-zinc-400" />
                      <span className="flex-1 truncate">{c.label}</span>
                      <Check
                        className={cn(
                          'size-3.5 shrink-0',
                          isSel ? 'opacity-100 text-zinc-700' : 'opacity-0',
                        )}
                      />
                    </button>
                  );
                })
              )}
            </div>
            <div className="flex items-center justify-between border-t bg-zinc-50/70 px-3 py-2">
              <Link
                href="/creator/categories/new"
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <Plus className="size-3" /> {t('newCollection')}
              </Link>
              {value.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-[11px] text-red-500 hover:underline"
                >
                  {t('clearAll')}
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
