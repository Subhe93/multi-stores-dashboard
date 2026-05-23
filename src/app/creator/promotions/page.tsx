'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Tag, Trash2, Pencil } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useCurrency } from '@/lib/useCurrency';

// ─── Types ───────────────────────────────────────────────────────────────────

type PromotionType =
  | 'PERCENTAGE'
  | 'FIXED_AMOUNT'
  | 'BUY_X_GET_Y'
  | 'BUNDLE'
  | 'QUANTITY_DISCOUNT'
  | 'FREE_SHIPPING'
  | 'COUPON'
  | 'FLASH_SALE';

type PromotionStatus = 'ACTIVE' | 'EXPIRED' | 'DISABLED';

interface Promotion {
  id: string;
  type: PromotionType;
  level: 'CREATOR_TO_CUSTOMER' | 'PROVIDER_TO_CREATOR';
  value: number;
  coupon_code?: string;
  usage_limit?: number;
  starts_at?: string;
  expires_at?: string;
  status: PromotionStatus;
  translations: { locale: string; title: string }[];
  _count: { usages: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Translator = ReturnType<typeof useTranslations>;

function typeLabels(t: Translator): Record<PromotionType, string> {
  return {
    PERCENTAGE: t('promotions.typePercentage'),
    FIXED_AMOUNT: t('promotions.typeFixedAmount'),
    BUY_X_GET_Y: t('promotions.typeBuyXGetY'),
    BUNDLE: t('promotions.typeBundle'),
    QUANTITY_DISCOUNT: t('promotions.typeQtyDiscount'),
    FREE_SHIPPING: t('promotions.typeFreeShipping'),
    COUPON: t('promotions.typeCoupon'),
    FLASH_SALE: t('promotions.typeFlashSale'),
  };
}

function typeBadgeClass(type: PromotionType): string {
  switch (type) {
    case 'PERCENTAGE':
    case 'COUPON':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'BUY_X_GET_Y':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'FREE_SHIPPING':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'FLASH_SALE':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-zinc-100 text-zinc-700 border-zinc-200';
  }
}

function statusBadgeClass(status: PromotionStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'EXPIRED':
      return 'bg-zinc-100 text-zinc-600 border-zinc-200';
    case 'DISABLED':
      return 'bg-amber-50 text-amber-700 border-amber-200';
  }
}

function formatValue(promo: Promotion, fmt: (v: any) => string, t: Translator): string {
  switch (promo.type) {
    case 'PERCENTAGE':
      return `${promo.value}%`;
    case 'FIXED_AMOUNT':
      return fmt(promo.value);
    case 'FREE_SHIPPING':
      return t('promotions.valueFree');
    case 'BUY_X_GET_Y':
      return t('promotions.valueBuyGet');
    default:
      return String(promo.value);
  }
}

function formatDate(dateStr: string | undefined, t: Translator): string {
  if (!dateStr) return t('promotions.never');
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreatorPromotionsPage() {
  const { fmt } = useCurrency();
  const { token } = useAuth();
  const router = useRouter();
  const tt = useTranslations('creator');
  const tc = useTranslations('common');
  const TYPE_LABELS = typeLabels(tt);

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPromotions = async (page = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<{ data: Promotion[]; meta: any }>(
        `/promotions?page=${page}&limit=20`,
        { token },
      );
      setPromotions(res?.data ?? []);
      setMeta(res?.meta ?? null);
    } catch (err) {
      console.error('Failed to load promotions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleDelete = async () => {
    if (!deleteTarget || !token) return;
    setDeleting(true);
    try {
      await api(`/promotions/${deleteTarget.id}`, { method: 'DELETE', token });
      setPromotions((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete promotion:', err);
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: tc('name'),
      render: (item: Promotion) => {
        const title = item.translations.find((t) => t.locale === 'en')?.title;
        return (
          <span className="text-sm font-medium">
            {title || TYPE_LABELS[item.type]}
          </span>
        );
      },
    },
    {
      key: 'type',
      label: tt('promotions.colType'),
      render: (item: Promotion) => (
        <span
          className={`inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-medium ${typeBadgeClass(item.type)}`}
        >
          {TYPE_LABELS[item.type]}
        </span>
      ),
    },
    {
      key: 'value',
      label: tt('promotions.colValue'),
      render: (item: Promotion) => (
        <span className="text-sm tabular-nums">{formatValue(item, fmt, tt)}</span>
      ),
    },
    {
      key: 'coupon_code',
      label: tt('promotions.colCouponCode'),
      render: (item: Promotion) =>
        item.coupon_code ? (
          <span className="font-mono text-xs tracking-widest">{item.coupon_code}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'expires_at',
      label: tt('promotions.colExpires'),
      render: (item: Promotion) => (
        <span className="text-sm text-muted-foreground">{formatDate(item.expires_at, tt)}</span>
      ),
    },
    {
      key: 'status',
      label: tc('status'),
      render: (item: Promotion) => {
        const canToggle = item.status === 'ACTIVE' || item.status === 'DISABLED';
        return (
          <button
            type="button"
            disabled={!canToggle}
            onClick={async () => {
              if (!canToggle || !token) return;
              const newStatus = item.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
              try {
                await api(`/promotions/${item.id}`, {
                  method: 'PUT',
                  token,
                  body: JSON.stringify({ status: newStatus }),
                });
                fetchPromotions(meta?.page || 1);
              } catch (err) {
                console.error('Failed to toggle status:', err);
              }
            }}
            className={`inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-medium transition ${statusBadgeClass(item.status)} ${canToggle ? 'cursor-pointer hover:opacity-70' : 'cursor-default'}`}
            title={canToggle ? (item.status === 'ACTIVE' ? tt('promotions.clickToDisable') : tt('promotions.clickToActivate')) : undefined}
          >
            {item.status.charAt(0) + item.status.slice(1).toLowerCase()}
          </button>
        );
      },
    },
    {
      key: 'actions',
      label: '',
      render: (item: Promotion) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => router.push(`/creator/promotions/${item.id}`)}
            title={tc('edit')}
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
          <h1 className="text-xl font-semibold tracking-tight">{tt('promotions.title')}</h1>
          <p className="text-sm text-muted-foreground">{tt('promotions.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => router.push('/creator/promotions/new')}>
          <Plus className="size-4" />
          {tt('promotions.createPromotion')}
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={promotions}
        searchPlaceholder={tt('promotions.searchPlaceholder')}
        emptyMessage=""
        pagination={meta}
        onPageChange={fetchPromotions}
      />

      {/* Empty state — rendered inside the card when no data and not loading */}
      {!loading && promotions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
            <Tag className="size-6" />
          </div>
          <p className="text-sm font-medium">{tt('promotions.emptyTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tt('promotions.emptyDesc')}
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => router.push('/creator/promotions/new')}
          >
            <Plus className="size-4" />
            {tt('promotions.createPromotion')}
          </Button>
        </div>
      )}

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tt('promotions.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {tt('promotions.deleteConfirmPrefix')}{' '}
              <span className="font-medium text-foreground">
                {deleteTarget
                  ? (deleteTarget.translations.find((t) => t.locale === 'en')?.title ||
                      TYPE_LABELS[deleteTarget.type])
                  : ''}
              </span>
              {tt('promotions.deleteConfirmSuffix')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {tc('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? tt('promotions.deleting') : tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
