'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  FolderTree,
  Trash2,
  Pencil,
  Tag,
  Package,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
).replace('/api', '');

// ─── Types ───────────────────────────────────────────────────────────────────

type MatchRule = 'MANUAL' | 'TAGS';

interface CategoryTranslation {
  locale: string;
  name: string;
}

interface CategoryNode {
  id: string;
  slug: string;
  parent_id?: string | null;
  thumbnail_url?: string | null;
  match_rule: MatchRule;
  match_tags: string[];
  is_active: boolean;
  sort_order: number;
  translations: CategoryTranslation[];
  _count?: { products: number; custom_products?: number; children: number };
  children?: CategoryNode[];
}

interface FlatRow extends CategoryNode {
  /** Full path including parent names (e.g. "Apparel / Hoodies"). */
  display_path: string;
  /** Depth in the tree (0 for root). */
  depth: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDisplayName(node: CategoryNode): string {
  const en = node.translations?.find((t) => t.locale === 'en')?.name;
  if (en) return en;
  return node.translations?.[0]?.name || node.slug;
}

function flattenTree(nodes: CategoryNode[], depth = 0, prefix = ''): FlatRow[] {
  const out: FlatRow[] = [];
  for (const n of nodes) {
    const name = getDisplayName(n);
    const path = prefix ? `${prefix} / ${name}` : name;
    out.push({ ...n, display_path: path, depth });
    if (n.children?.length) {
      out.push(...flattenTree(n.children, depth + 1, path));
    }
  }
  return out;
}

function resolveUrl(url: string): string {
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CreatorCategoriesPage() {
  const { token } = useAuth();
  const router = useRouter();

  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<FlatRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<CategoryNode[]>('/creator-categories', { token });
      setTree(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load collections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const rows = useMemo(() => flattenTree(tree), [tree]);

  const handleDelete = async () => {
    if (!deleteTarget || !token) return;
    setDeleting(true);
    try {
      await api(`/creator-categories/${deleteTarget.id}`, {
        method: 'DELETE',
        token,
      });
      await fetchCategories();
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete collection:', err);
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'thumbnail',
      label: '',
      render: (item: FlatRow) => (
        <div className="h-9 w-9 overflow-hidden rounded border bg-zinc-100 flex items-center justify-center shrink-0">
          {item.thumbnail_url ? (
            <img
              src={resolveUrl(item.thumbnail_url)}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <FolderTree className="size-4 text-zinc-400" />
          )}
        </div>
      ),
    },
    {
      key: 'name',
      label: 'Name',
      render: (item: FlatRow) => (
        <div className="flex flex-col">
          <span
            className="text-sm font-medium"
            style={{ paddingLeft: item.depth * 12 }}
          >
            {item.display_path}
          </span>
          <span className="text-[11px] text-muted-foreground font-mono">
            /{item.slug}
          </span>
        </div>
      ),
    },
    {
      key: 'match_rule',
      label: 'Match Rule',
      render: (item: FlatRow) =>
        item.match_rule === 'TAGS' ? (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200"
          >
            <Tag className="size-2.5 mr-0.5" />
            By tags
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="bg-zinc-100 text-zinc-700 border-zinc-200"
          >
            <Package className="size-2.5 mr-0.5" />
            Manual
          </Badge>
        ),
    },
    {
      key: 'products',
      label: 'Products',
      render: (item: FlatRow) =>
        item.match_rule === 'TAGS' ? (
          <span className="text-sm text-muted-foreground">
            by tags ({item.match_tags?.length || 0})
          </span>
        ) : (
          <span className="text-sm tabular-nums">
            {(item._count?.products ?? 0) + (item._count?.custom_products ?? 0)}
          </span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (item: FlatRow) =>
        item.is_active ? (
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200"
          >
            Active
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="bg-zinc-100 text-zinc-600 border-zinc-200"
          >
            Inactive
          </Badge>
        ),
    },
    {
      key: 'actions',
      label: '',
      render: (item: FlatRow) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => router.push(`/creator/categories/${item.id}`)}
            title="Edit"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(item)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Collections</h1>
          <p className="text-sm text-muted-foreground">
            Group your products into shoppable collections for your storefront.
          </p>
        </div>
        <Button size="sm" onClick={() => router.push('/creator/categories/new')}>
          <Plus className="size-4" />
          New Collection
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search collections…"
        emptyMessage=""
      />

      {/* Empty state */}
      {!loading && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
            <FolderTree className="size-6" />
          </div>
          <p className="text-sm font-medium">No collections yet</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Collections let you group products together so customers can browse
            them on your storefront.
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => router.push('/creator/categories/new')}
          >
            <Plus className="size-4" />
            Create your first collection
          </Button>
        </div>
      )}

      {/* Delete confirm dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Collection</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium text-foreground">
                {deleteTarget ? getDisplayName(deleteTarget) : ''}
              </span>
              ? This won't delete the products inside — they'll just leave the
              collection.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
