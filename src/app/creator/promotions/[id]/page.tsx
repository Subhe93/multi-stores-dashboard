'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Percent,
  DollarSign,
  Gift,
  Package,
  TrendingDown,
  Truck,
  Tag,
  Zap,
  ArrowLeft,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { RichTextEditor } from '@/components/common/RichTextEditor';
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
  level: string;
  value: number;
  coupon_code?: string;
  usage_limit?: number;
  usage_count: number;
  starts_at?: string;
  expires_at?: string;
  status: PromotionStatus;
  conditions?: { product_ids?: string[]; min_amount?: number; min_quantity?: number };
  translations: { locale: string; title: string; description?: string }[];
}

// ─── Type options (display only) ─────────────────────────────────────────────

type Translator = ReturnType<typeof useTranslations>;

function typeOptions(t: Translator): {
  type: PromotionType;
  icon: React.ElementType;
  label: string;
  desc: string;
}[] {
  return [
    { type: 'PERCENTAGE', icon: Percent, label: t('promotionForm.typePercentageLabel'), desc: t('promotionForm.typePercentageDesc') },
    { type: 'FIXED_AMOUNT', icon: DollarSign, label: t('promotionForm.typeFixedLabel'), desc: t('promotionForm.typeFixedDesc') },
    { type: 'BUY_X_GET_Y', icon: Gift, label: t('promotionForm.typeBuyXGetYLabel'), desc: t('promotionForm.typeBuyXGetYDesc') },
    { type: 'BUNDLE', icon: Package, label: t('promotionForm.typeBundleLabel'), desc: t('promotionForm.typeBundleDesc') },
    { type: 'QUANTITY_DISCOUNT', icon: TrendingDown, label: t('promotionForm.typeQtyLabel'), desc: t('promotionForm.typeQtyDesc') },
    { type: 'FREE_SHIPPING', icon: Truck, label: t('promotionForm.typeFreeShippingLabel'), desc: t('promotionForm.typeFreeShippingDesc') },
    { type: 'COUPON', icon: Tag, label: t('promotionForm.typeCouponLabel'), desc: t('promotionForm.typeCouponDesc') },
    { type: 'FLASH_SALE', icon: Zap, label: t('promotionForm.typeFlashLabel'), desc: t('promotionForm.typeFlashDesc') },
  ];
}

function statusOptions(t: Translator) {
  return [
    { value: 'ACTIVE', label: t('promotionForm.statusActiveLabel'), description: t('promotionForm.statusActiveDesc') },
    { value: 'DISABLED', label: t('promotionForm.statusDisabledLabel'), description: t('promotionForm.statusDisabledDesc') },
  ];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function valueLabel(type: PromotionType, cur: string, t: Translator): string {
  if (type === 'PERCENTAGE') return t('promotionForm.discountPercent');
  if (type === 'FIXED_AMOUNT') return t('promotionForm.discountCurrency', { currency: cur });
  return t('promotionForm.discountValue');
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditPromotionPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const { currency } = useCurrency();
  const tt = useTranslations('creator');
  const tc = useTranslations('common');
  const TYPE_OPTIONS = typeOptions(tt);
  const STATUS_OPTIONS = statusOptions(tt);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [type, setType] = useState<PromotionType | null>(null);
  const [value, setValue] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [usageCount, setUsageCount] = useState(0);
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [status, setStatus] = useState<PromotionStatus>('ACTIVE');
  const [titleEn, setTitleEn] = useState('');
  const [descEn, setDescEn] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [products, setProducts] = useState<{ id: string; title: string }[]>([]);

  const showValueField = type !== null && type !== 'FREE_SHIPPING' && type !== 'BUY_X_GET_Y';

  // Fetch creator's products for targeting
  useEffect(() => {
    if (!token) return;
    api<{ data: any[] }>('/custom-products?limit=100', { token })
      .then((res) => {
        const list = (res?.data || []).map((p: any) => ({
          id: p.id,
          title: p.translations?.find((t: any) => t.locale === 'en')?.title
            || p.translations?.[0]?.title || p.product?.translations?.[0]?.title || tt('promotionForm.untitled'),
        }));
        setProducts(list);
      })
      .catch(() => {});
  }, [token]);

  // Fetch promotion
  const fetchPromotion = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const promo = await api<Promotion>(`/promotions/${id}`, { token });
      setType(promo.type);
      setValue(String(promo.value || ''));
      setCouponCode(promo.coupon_code || '');
      setUsageLimit(promo.usage_limit ? String(promo.usage_limit) : '');
      setUsageCount(promo.usage_count || 0);
      setStartsAt(promo.starts_at ? promo.starts_at.slice(0, 10) : '');
      setExpiresAt(promo.expires_at ? promo.expires_at.slice(0, 10) : '');
      setStatus(promo.status);

      const enTrans = promo.translations?.find((t) => t.locale === 'en');
      setTitleEn(enTrans?.title || '');
      setDescEn(enTrans?.description || '');

      // Pre-fill product targeting
      const conds = promo.conditions as any;
      if (conds?.product_ids?.length) setSelectedProductIds(conds.product_ids);
    } catch {
      setError(tt('promotionForm.failedLoad'));
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    fetchPromotion();
  }, [fetchPromotion]);

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleEn.trim()) {
      setError(tt('promotionForm.titleRequired'));
      return;
    }
    if (!token) return;

    setSaving(true);
    setError('');
    setSaved(false);

    const payload: Record<string, any> = {
      value: parseFloat(value) || 0,
      status,
      translations: [
        {
          locale: 'en',
          title: titleEn.trim(),
          ...(descEn.trim() ? { description: descEn.trim() } : {}),
        },
      ],
    };

    if (usageLimit) payload.usage_limit = parseInt(usageLimit, 10);
    if (expiresAt) payload.expires_at = expiresAt;
    payload.conditions = selectedProductIds.length > 0
      ? { product_ids: selectedProductIds }
      : {};

    try {
      await api(`/promotions/${id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify(payload),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err?.message || tt('promotionForm.failedUpdate'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!type && error) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/creator/promotions')}>
          {tt('promotionForm.backToPromotions')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => router.push('/creator/promotions')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">{tt('promotionForm.editTitle')}</h1>
          <p className="text-sm text-muted-foreground">{tt('promotionForm.editSubtitle')}</p>
        </div>
        {saved && (
          <span className="text-xs text-emerald-600 font-medium">{tt('promotionForm.savedSuccess')}</span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Promotion Type (read-only) */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">{tt('promotionForm.promotionType')}</CardTitle>
              <Badge variant="secondary" className="text-[10px]">{tt('promotionForm.cannotBeChanged')}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {TYPE_OPTIONS.map(({ type: t, icon: Icon, label, desc }) => {
                const selected = type === t;
                return (
                  <div
                    key={t}
                    className={`flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all ${
                      selected
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-border bg-background opacity-40'
                    }`}
                  >
                    <Icon className={`size-4 ${selected ? 'text-white' : 'text-zinc-500'}`} />
                    <div>
                      <p className="text-xs font-semibold leading-snug">{label}</p>
                      <p className={`mt-0.5 text-[10px] leading-snug ${selected ? 'text-zinc-300' : 'text-muted-foreground'}`}>
                        {desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Promotion Details */}
        {type && (
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{tt('promotionForm.promotionDetails')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs">{tc('status')}</Label>
                  <SearchableSelect
                    value={status}
                    onChange={(v) => setStatus(v as PromotionStatus)}
                    placeholder={tt('promotionForm.selectStatus')}
                    options={STATUS_OPTIONS}
                  />
                </div>

                {/* Usage info */}
                <div className="space-y-1.5">
                  <Label className="text-xs">{tt('promotionForm.usage')}</Label>
                  <div className="flex items-center h-8 px-3 rounded-md border bg-muted/50 text-sm text-muted-foreground">
                    {usageLimit
                      ? tt('promotionForm.usedCountLimit', { count: usageCount, limit: usageLimit })
                      : tt('promotionForm.usedCount', { count: usageCount })}
                  </div>
                </div>
              </div>

              {/* Value */}
              {showValueField && (
                <div className="space-y-1.5">
                  <Label className="text-xs">{valueLabel(type, currency, tt)}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0.00"
                    className="h-8"
                  />
                </div>
              )}

              {/* Coupon code (read-only) */}
              {couponCode && (
                <div className="space-y-1.5">
                  <Label className="text-xs">{tt('promotionForm.couponCode')}</Label>
                  <div className="flex items-center h-8 px-3 rounded-md border bg-muted/50 font-mono text-sm tracking-widest">
                    {couponCode}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{tt('promotionForm.couponLocked')}</p>
                </div>
              )}

              {/* Usage limit */}
              <div className="space-y-1.5">
                <Label className="text-xs">{tt('promotionForm.usageLimit')}</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(e.target.value)}
                  placeholder={tt('promotionForm.unlimited')}
                  className="h-8"
                />
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{tt('promotionForm.startsAt')}</Label>
                  <div className="flex items-center h-8 px-3 rounded-md border bg-muted/50 text-sm text-muted-foreground">
                    {startsAt || '—'}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{tt('promotionForm.expiresAt')}</Label>
                  <Input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="h-8"
                  />
                  <p className="text-[10px] text-muted-foreground">{tt('promotionForm.leaveBlankNoExpiry')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Product targeting */}
        {type && products.length > 0 && (
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{tt('promotionForm.applyToProducts')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[10px] text-muted-foreground">
                {tt('promotionForm.applyToProductsDesc')}
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-2">
                {products.map((p) => {
                  const checked = selectedProductIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition text-sm ${
                        checked ? 'bg-zinc-100 font-medium' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedProductIds((prev) =>
                            checked ? prev.filter((pid) => pid !== p.id) : [...prev, p.id],
                          )
                        }
                        className="rounded border-zinc-300"
                      />
                      <span className="truncate">{p.title}</span>
                    </label>
                  );
                })}
              </div>
              {selectedProductIds.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {tt('promotionForm.productsSelected', { count: selectedProductIds.length })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedProductIds([])}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {tt('promotionForm.clearAll')}
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Details */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{tt('promotionForm.details')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">
                {tt('promotionForm.titleEnglish')} <span className="text-destructive">*</span>
              </Label>
              <Input
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                placeholder={tt('promotionForm.titlePlaceholder')}
                className="h-8"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{tt('promotionForm.descriptionOptional')}</Label>
              <RichTextEditor
                content={descEn}
                onChange={setDescEn}
                placeholder={tt('promotionForm.descriptionPlaceholder')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/creator/promotions')}
            disabled={saving}
          >
            {tc('cancel')}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? tc('saving') : tt('promotionForm.saveChanges')}
          </Button>
        </div>
      </form>
    </div>
  );
}
