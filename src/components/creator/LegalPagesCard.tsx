'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  Pencil,
  Scale,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { effectiveStoreStatus, fetchMyStore, storefrontBaseUrl } from '@/lib/useStorefrontUrl';
import { canRequestGoLive, type StoreStatus } from '@/lib/storeStatus';
import { isPreLaunchStatus, type LegalSlug } from '@/lib/legalPages';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/** Anchor id used by the go-live checklist to link here. */
export const LEGAL_PAGES_ANCHOR = 'legal-pages';

const TRADER_DETAILS_HREF = '/creator/settings?tab=business';

/** One row of `GET /stores/my/legal-pages` (plans/store-legal-pages SPEC, API section). */
interface LegalPageRow {
  slug: LegalSlug | string;
  kind: string;
  title: string;
  state: 'published' | 'draft' | 'none';
  page_id: string | null;
  page_system: 'v2' | 'legacy' | null;
  uses_template: boolean;
  storefront_path: string;
}

interface LegalPagesResponse {
  store_type: 'MARKETPLACE' | 'INDEPENDENT';
  pages: LegalPageRow[];
}

const KNOWN_SLUGS: readonly string[] = ['privacy', 'terms', 'refund', 'shipping'];
// Pages the go-live check requires for INDEPENDENT stores.
const REQUIRED_SLUGS: readonly string[] = ['privacy', 'terms'];

function editHref(row: LegalPageRow): string | null {
  if (!row.page_id) return null;
  return row.page_system === 'legacy' ? `/creator/pages/${row.page_id}` : `/builder/${row.page_id}`;
}

/**
 * What the row's primary action does: open the existing v2 page, or create a
 * v2 draft from the template ("Review and publish"). A legacy draft keeps its
 * editor as a secondary action, since the template flow replaces it with a
 * builder page.
 */
function rowActions(row: LegalPageRow): { primary: 'create' | 'edit'; secondaryEdit: boolean } {
  if (row.state === 'none' || !row.page_id) return { primary: 'create', secondaryEdit: false };
  if (row.state === 'draft' && row.page_system === 'legacy') return { primary: 'create', secondaryEdit: true };
  return { primary: 'edit', secondaryEdit: false };
}

/**
 * Review hint for legal page drafts: what to check before publishing. The
 * templates follow Swedish law, so a trader outside Sweden gets it as a
 * warning. Shared by the "Legal pages" card and the builder banner.
 */
export function LegalReviewHint({
  traderCountry,
  draftNote,
  className,
}: {
  traderCountry?: string | null;
  /** Adds "visitors still see the standard text until you click Publish". */
  draftNote?: boolean;
  className?: string;
}) {
  const t = useTranslations('creator.storePages.legal');
  const outsideSweden = !!traderCountry && traderCountry.toUpperCase() !== 'SE';
  const Icon = outsideSweden ? AlertTriangle : AlertCircle;
  return (
    <div
      role={outsideSweden ? 'alert' : 'note'}
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
        outsideSweden
          ? 'border-orange-300 bg-orange-50 text-orange-900'
          : 'border-amber-200 bg-amber-50 text-amber-900',
        className,
      )}
    >
      <Icon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-0.5">
        {draftNote && <p className="font-medium">{t('builderDraftNote')}</p>}
        <p className={cn(outsideSweden && 'font-medium')}>{t('reviewHint')}</p>
      </div>
    </div>
  );
}

/**
 * "Legal pages" card on /creator/pages. INDEPENDENT stores own their legal
 * pages: until a page is published the storefront shows the standard text
 * filled with the trader details, so every row is either Published, Draft or
 * "Standard text shown". MARKETPLACE stores always show the standard texts
 * with Namez AB as the seller (not editable) and only get an informational line.
 */
export function LegalPagesCard({ reloadKey = 0 }: { reloadKey?: number }) {
  const { token } = useAuth();
  const router = useRouter();
  const t = useTranslations('creator.storePages.legal');

  const [data, setData] = useState<LegalPagesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [traderIncomplete, setTraderIncomplete] = useState(false);
  const [traderCountry, setTraderCountry] = useState<string | null>(null);
  const [storeStatus, setStoreStatus] = useState<StoreStatus | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Row waiting for the "business details incomplete" confirmation.
  const [confirmRow, setConfirmRow] = useState<LegalPageRow | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [res, store] = await Promise.all([
        api<LegalPagesResponse>('/stores/my/legal-pages', { token }),
        fetchMyStore(token).catch(() => null),
      ]);
      setData(res);
      if (store?.slug) setBaseUrl(storefrontBaseUrl(store));
      const complete = store?.golive_checklist?.trader_details_complete ?? !!store?.trader_details?.completed_at;
      setTraderIncomplete(!!store && !complete);
      setTraderCountry(store?.trader_details?.country || null);
      setStoreStatus(store ? effectiveStoreStatus(store) : null);
    } catch (err) {
      console.error('Failed to load legal pages:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const createFromTemplate = async (row: LegalPageRow) => {
    if (!token || creating) return;
    setCreating(row.slug);
    setActionError(null);
    try {
      const res = await api<{ page_id: string }>(
        `/stores/my/legal-pages/${encodeURIComponent(row.slug)}/from-template`,
        { method: 'POST', token },
      );
      router.push(`/builder/${res.page_id}`);
    } catch (err) {
      // A page of this kind already exists: just open it.
      const existingId =
        err instanceof ApiError && err.code === 'LEGAL_PAGE_EXISTS' ? err.payload?.page_id : undefined;
      if (typeof existingId === 'string' && existingId) {
        router.push(`/builder/${existingId}`);
        return;
      }
      console.error('Failed to create legal page:', err);
      setActionError(t('createFailed'));
      setCreating(null);
    }
  };

  // Missing business details leave gaps in the text: confirm first.
  const startReview = (row: LegalPageRow) => {
    if (creating) return;
    if (traderIncomplete) {
      setConfirmRow(row);
      return;
    }
    void createFromTemplate(row);
  };

  const name = (slug: string, fallback: string) => (KNOWN_SLUGS.includes(slug) ? t(`names.${slug}`) : fallback);

  // Marketplace: Namez AB is the seller of record; the standard texts are fixed.
  if (data?.store_type === 'MARKETPLACE') {
    return (
      <section
        id={LEGAL_PAGES_ANCHOR}
        className="flex scroll-mt-20 items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm"
      >
        <Scale className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-medium">{t('title')}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('marketplace')}</p>
        </div>
      </section>
    );
  }

  const rows = data?.pages ?? [];
  const anyUnpublished = rows.some((row) => row.state !== 'published');
  const requiredPublished =
    rows.length > 0 &&
    REQUIRED_SLUGS.every((slug) => rows.find((row) => row.slug === slug)?.state === 'published');
  // Go-live can still be requested: point the creator at the overview card.
  const showGoLiveLine = requiredPublished && !!storeStatus && canRequestGoLive(storeStatus);
  // Before launch the go-live check needs Privacy + Terms; afterwards they are advice.
  const preLaunch = !storeStatus || isPreLaunchStatus(storeStatus);

  return (
    <section
      id={LEGAL_PAGES_ANCHOR}
      className="scroll-mt-20 rounded-xl border bg-card"
      aria-labelledby="legal-pages-title"
    >
      <div className="flex items-start gap-3 px-4 pt-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
          <Scale className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 id="legal-pages-title" className="text-sm font-semibold">{t('title')}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t('explainer')}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('copyNote')}</p>
        </div>
      </div>

      {traderIncomplete && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <p>
            {t('traderHint')}{' '}
            <Link href={TRADER_DETAILS_HREF} className="font-medium underline underline-offset-2">
              {t('traderHintLink')}
            </Link>
          </p>
        </div>
      )}

      {data && anyUnpublished && <LegalReviewHint traderCountry={traderCountry} className="mx-4 mt-3" />}

      {showGoLiveLine && (
        <div
          role="status"
          className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
        >
          <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <Link href="/creator#store-status" className="font-medium underline underline-offset-2">
            {t('requiredPublished')}
          </Link>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {actionError}
        </div>
      )}

      <div className="mt-3 border-t">
        {loading && !data ? (
          <ul className="divide-y" aria-busy="true">
            {KNOWN_SLUGS.map((slug) => (
              <li key={slug} className="flex items-center justify-between gap-4 px-4 py-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-7 w-32" />
              </li>
            ))}
          </ul>
        ) : loadError || !data ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="size-4 text-red-500" aria-hidden="true" />
              {t('loadFailed')}
            </span>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading && <Loader2 className="size-3.5 animate-spin" />}
              {t('retry')}
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => {
              const href = editHref(row);
              const busy = creating === row.slug;
              const viewUrl = baseUrl ? `${baseUrl}${row.storefront_path || `/legal/${row.slug}`}` : null;
              const actions = rowActions(row);
              const editLink = (variant: 'outline' | 'ghost') =>
                href ? (
                  <Link href={href} className={buttonVariants({ variant, size: 'sm' })}>
                    <Pencil className="size-3.5" aria-hidden="true" />
                    {t('edit')}
                  </Link>
                ) : null;
              return (
                <li key={row.slug} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{name(row.slug, row.title)}</span>
                      <StatusChip state={row.state} t={t} />
                      {REQUIRED_SLUGS.includes(row.slug) && row.state !== 'published' && (
                        <span className="rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-800">
                          {preLaunch ? t('required') : t('recommended')}
                        </span>
                      )}
                    </div>
                    {row.state === 'draft' && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{t('stateDraftHint')}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {viewUrl && (
                      <a
                        href={viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                      >
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                        {t('view')}
                      </a>
                    )}
                    {actions.secondaryEdit && editLink('ghost')}
                    {actions.primary === 'create' ? (
                      <Button size="sm" onClick={() => startReview(row)} disabled={!!creating}>
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Sparkles className="size-3.5" aria-hidden="true" />
                        )}
                        {busy ? t('creating') : t('reviewAndPublish')}
                      </Button>
                    ) : (
                      editLink('outline')
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="flex items-start gap-1.5 border-t px-4 py-2.5 text-[11px] text-muted-foreground">
        <Info className="mt-px size-3 shrink-0" aria-hidden="true" />
        {t('disclaimer')}
      </p>

      <Dialog open={!!confirmRow} onOpenChange={(open) => !open && setConfirmRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('confirmTitle')}</DialogTitle>
            <DialogDescription>{t('confirmBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Link href={TRADER_DETAILS_HREF} className={buttonVariants({ variant: 'outline' })}>
              {t('traderHintLink')}
            </Link>
            <Button
              onClick={() => {
                const row = confirmRow;
                setConfirmRow(null);
                if (row) void createFromTemplate(row);
              }}
            >
              {t('confirmContinue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function StatusChip({
  state,
  t,
}: {
  state: LegalPageRow['state'];
  t: ReturnType<typeof useTranslations>;
}) {
  const cls = 'inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-medium';
  if (state === 'published') {
    return <span className={cn(cls, 'border-emerald-200 bg-emerald-50 text-emerald-700')}>{t('statePublished')}</span>;
  }
  if (state === 'draft') {
    return <span className={cn(cls, 'border-zinc-200 bg-zinc-100 text-zinc-600')}>{t('stateDraft')}</span>;
  }
  return <span className={cn(cls, 'border-sky-200 bg-sky-50 text-sky-700')}>{t('stateTemplate')}</span>;
}
