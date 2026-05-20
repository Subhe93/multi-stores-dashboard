'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ExternalLink,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DataTable } from '@/components/common/DataTable';

interface PageRow {
  id: string;
  type: 'HOME' | 'STATIC' | 'LANDING' | 'PRODUCT_TEMPLATE';
  slug: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  created_at: string;
  translations: { locale: string; title?: string | null }[];
}

interface StoreLite {
  slug: string;
  language_config?: { primary_locale?: string } | null;
}

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003';
const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function titleOf(translations: { locale: string; title?: string | null }[], primaryLocale: string, fallback: string) {
  return (
    translations.find((t) => t.locale === primaryLocale)?.title ||
    translations.find((t) => t.locale === 'en')?.title ||
    translations[0]?.title ||
    fallback
  );
}

export default function LandingPagesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [store, setStore] = useState<StoreLite | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PageRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [pagesRes, storeRes] = await Promise.all([
        api<PageRow[]>('/v2/pages/mine', { token }),
        api<StoreLite>('/stores/my/store', { token }),
      ]);
      setPages(pagesRes);
      setStore(storeRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const landings = pages.filter((p) => p.type === 'LANDING');
  const primaryLocale = store?.language_config?.primary_locale || 'en';

  const handleDelete = async () => {
    if (!deleteTarget || !token) return;
    setDeleting(true);
    try {
      await api(`/v2/pages/${deleteTarget.id}`, { method: 'DELETE', token });
      setPages((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'title',
      label: 'Title',
      render: (item: PageRow) => (
        <span className="text-sm font-medium">{titleOf(item.translations, primaryLocale, item.slug || '—')}</span>
      ),
    },
    {
      key: 'slug',
      label: 'URL',
      render: (item: PageRow) => (
        <span className="font-mono text-[10px] text-muted-foreground">/p/{item.slug}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (item: PageRow) =>
        item.status === 'PUBLISHED' ? (
          <span className="inline-flex h-5 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-medium text-emerald-700">
            Published
          </span>
        ) : (
          <span className="inline-flex h-5 items-center rounded-full border border-zinc-200 bg-zinc-100 px-2 text-[10px] font-medium text-zinc-600">
            Draft
          </span>
        ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (item: PageRow) => (
        <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (item: PageRow) => (
        <div className="flex items-center justify-end gap-1">
          {item.status === 'PUBLISHED' && store && (
            <a
              href={`${WEB_ORIGIN}/store/${store.slug}/p/${item.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="icon-sm" variant="ghost" title="Open published page">
                <ExternalLink className="size-3.5" />
              </Button>
            </a>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            title="Open in builder"
            onClick={() => router.push(`/builder/${item.id}`)}
          >
            <Wand2 className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            title="Delete"
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Landing Pages</h1>
          <p className="text-sm text-muted-foreground">
            Custom URL pages for campaigns and promotions. Each gets its own builder.
          </p>
        </div>
        <CreateLandingDialog
          primaryLocale={primaryLocale}
          existingSlugs={landings.map((p) => p.slug || '')}
          onCreated={(p) => {
            setPages((prev) => [...prev, p]);
            router.push(`/builder/${p.id}`);
          }}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 text-zinc-400 animate-spin" />
        </div>
      ) : landings.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
              <Sparkles className="size-6" />
            </div>
            <p className="text-sm font-medium">No landing pages yet</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-md">
              Create a landing page for a campaign, product launch, or seasonal promotion.
              Each one gets a unique URL and its own builder canvas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DataTable columns={columns} data={landings} searchPlaceholder="Search landing pages…" emptyMessage="" />
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete landing page</DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  Delete{' '}
                  <span className="font-medium text-foreground">
                    {titleOf(deleteTarget.translations, primaryLocale, deleteTarget.slug || '')}
                  </span>
                  ? Published versions will be removed too.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Create dialog ─────────────────────────────────────────

function CreateLandingDialog({
  primaryLocale,
  existingSlugs,
  onCreated,
}: {
  primaryLocale: string;
  existingSlugs: string[];
  onCreated: (page: PageRow) => void;
}) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Derive a slug from the title until the user types their own.
  const [slugDirty, setSlugDirty] = useState(false);
  function onTitleChange(v: string) {
    setTitle(v);
    if (!slugDirty) {
      setSlug(
        v
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 80),
      );
    }
  }

  const slugError = (() => {
    if (!slug) return null;
    if (!SLUG_REGEX.test(slug)) return 'Use lowercase letters, digits, and hyphens only.';
    if (existingSlugs.includes(slug)) return 'A landing page with this URL already exists.';
    return null;
  })();

  const canSubmit = !!title.trim() && !!slug && !slugError && !creating;

  async function handleCreate() {
    if (!token || !canSubmit) return;
    setCreating(true);
    setError(null);
    try {
      const created = await api<PageRow>('/v2/pages', {
        method: 'POST',
        token,
        body: JSON.stringify({
          type: 'LANDING',
          slug,
          translations: [{ locale: primaryLocale, title }],
        }),
      });
      onCreated(created);
      setOpen(false);
      setTitle('');
      setSlug('');
      setSlugDirty(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create landing page');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-3.5" />
            New landing page
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New landing page</DialogTitle>
          <DialogDescription>
            Pick a title and URL. You can edit the design after.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lp-title" className="text-xs">Title ({primaryLocale})</Label>
            <Input
              id="lp-title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Eid sale 2026"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lp-slug" className="text-xs">URL</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">/p/</span>
              <Input
                id="lp-slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase());
                  setSlugDirty(true);
                }}
                placeholder="eid-sale"
                className="font-mono"
              />
            </div>
            {slugError && <p className="text-[11px] text-red-500">{slugError}</p>}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canSubmit}>
            {creating ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Creating…
              </>
            ) : (
              'Create & open builder'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
