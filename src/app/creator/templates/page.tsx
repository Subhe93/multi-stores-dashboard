'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, LayoutTemplate, Loader2, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type LocalizedString = Record<string, string>;

interface KitSummary {
  id: string;
  name: LocalizedString;
  description: LocalizedString;
  tags: string[];
  previewImage: string;
}

interface StoreLite {
  language_config?: { primary_locale?: string } | null;
}

interface PageRow {
  id: string;
  type: 'HOME' | 'STATIC' | 'LANDING' | 'PRODUCT_TEMPLATE' | 'HEADER' | 'FOOTER';
}

interface ImportResult {
  pagesApplied: number;
  sectionsCreated: number;
  demoDataCreated: boolean;
}

function loc(s: LocalizedString | undefined, primary: string): string {
  if (!s) return '';
  return s[primary] || s.en || Object.values(s)[0] || '';
}

// Deterministic gradient per kit id so cards look intentional until real
// preview images ship (Phase 2). Same id → same gradient across renders.
const GRADIENTS = [
  'from-zinc-900 to-zinc-700',
  'from-orange-500 to-rose-600',
  'from-indigo-600 to-violet-700',
  'from-emerald-600 to-teal-700',
];
function gradientFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export default function TemplatesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [kits, setKits] = useState<KitSummary[]>([]);
  const [primaryLocale, setPrimaryLocale] = useState('en');
  const [active, setActive] = useState<KitSummary | null>(null);

  useEffect(() => {
    if (!token) return;
    // `loading` starts true and this runs once token is available, so no
    // synchronous setState is needed here — only clear it when settled.
    Promise.all([
      api<KitSummary[]>('/v2/templates', { token }),
      api<StoreLite>('/stores/my/store', { token }).catch(() => null),
    ])
      .then(([kitList, store]) => {
        setKits(Array.isArray(kitList) ? kitList : []);
        if (store?.language_config?.primary_locale) setPrimaryLocale(store.language_config.primary_locale);
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Templates</h1>
        <p className="text-sm text-muted-foreground">
          Import a ready-made store design in one click — pages, sections, content and theme.
          Imported pages stay as drafts so you can review before publishing.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 text-zinc-400 animate-spin" />
        </div>
      ) : kits.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
              <LayoutTemplate className="size-6" />
            </div>
            <p className="text-sm font-medium">No templates available yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {kits.map((kit) => (
            <Card key={kit.id} className="overflow-hidden shadow-none transition hover:shadow-md">
              {/* Preview — gradient placeholder until bundled images ship */}
              <div className={`relative flex h-40 items-center justify-center bg-linear-to-br ${gradientFor(kit.id)}`}>
                <Sparkles className="size-7 text-white/70" />
                <span className="absolute bottom-3 left-3 text-lg font-semibold text-white drop-shadow">
                  {loc(kit.name, primaryLocale)}
                </span>
              </div>
              <CardContent className="space-y-3 p-4">
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {loc(kit.description, primaryLocale)}
                </p>
                {kit.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {kit.tags.slice(0, 4).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px] font-normal">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <Button size="sm" className="w-full" onClick={() => setActive(kit)}>
                  Import to my store
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ImportDialog
        kit={active}
        primaryLocale={primaryLocale}
        onClose={() => setActive(null)}
        onImported={async () => {
          // Land the creator in the builder on their (now-restyled) Home page.
          try {
            const pages = await api<PageRow[]>('/v2/pages/mine', { token: token! });
            const home = pages.find((p) => p.type === 'HOME');
            if (home) {
              router.push(`/builder/${home.id}`);
              return;
            }
          } catch {
            /* fall through to the pages list */
          }
          router.push('/creator/pages');
        }}
      />
    </div>
  );
}

// ── Import dialog ─────────────────────────────────────────

function ImportDialog({
  kit,
  primaryLocale,
  onClose,
  onImported,
}: {
  kit: KitSummary | null;
  primaryLocale: string;
  onClose: () => void;
  onImported: () => void | Promise<void>;
}) {
  const { token } = useAuth();
  const [withDemoData, setWithDemoData] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset transient state whenever a different kit opens the dialog.
  useEffect(() => {
    if (kit) {
      setWithDemoData(false);
      setError(null);
    }
  }, [kit]);

  async function handleImport() {
    if (!kit || !token) return;
    setImporting(true);
    setError(null);
    try {
      const res = await api<ImportResult>(`/v2/templates/${kit.id}/import`, {
        method: 'POST',
        token,
        body: JSON.stringify({ withDemoData }),
      });
      void res;
      await onImported();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import template');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={!!kit} onOpenChange={(open) => !open && !importing && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import “{kit ? loc(kit.name, primaryLocale) : ''}”</DialogTitle>
          <DialogDescription>
            This applies the template&apos;s theme and replaces the sections of your Home,
            Header, Footer and Product template pages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Replace warning */}
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Existing sections on those pages will be overwritten — but a backup is saved first,
              so you can restore from <span className="font-medium">History</span> anytime. Pages
              import as <span className="font-medium">drafts</span>; nothing goes live until you publish.
            </p>
          </div>

          {/* Demo data toggle */}
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-200 p-3 hover:border-zinc-300">
            <input
              type="checkbox"
              checked={withDemoData}
              onChange={(e) => setWithDemoData(e.target.checked)}
              className="mt-0.5 size-4 accent-indigo-600"
            />
            <span className="min-w-0">
              <span className="block text-xs font-medium text-zinc-800">Add demo products</span>
              <span className="block text-[11px] text-muted-foreground leading-relaxed">
                Create a sample category and a few demo products so product sections look complete.
              </span>
            </span>
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={importing}>
            {importing ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Check className="size-3.5" />
                Import &amp; review
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
