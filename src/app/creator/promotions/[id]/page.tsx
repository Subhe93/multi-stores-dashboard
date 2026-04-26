'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

const TYPE_OPTIONS: {
  type: PromotionType;
  icon: React.ElementType;
  label: string;
  desc: string;
}[] = [
  { type: 'PERCENTAGE', icon: Percent, label: 'Percentage Off', desc: '% discount on total' },
  { type: 'FIXED_AMOUNT', icon: DollarSign, label: 'Fixed Amount', desc: 'Fixed amount off the total' },
  { type: 'BUY_X_GET_Y', icon: Gift, label: 'Buy X Get Y', desc: 'Free item with purchase' },
  { type: 'BUNDLE', icon: Package, label: 'Bundle Deal', desc: 'Products together cheaper' },
  { type: 'QUANTITY_DISCOUNT', icon: TrendingDown, label: 'Quantity Discount', desc: 'More items = better price' },
  { type: 'FREE_SHIPPING', icon: Truck, label: 'Free Shipping', desc: 'Free delivery' },
  { type: 'COUPON', icon: Tag, label: 'Coupon Code', desc: 'Shareable discount code' },
  { type: 'FLASH_SALE', icon: Zap, label: 'Flash Sale', desc: 'Time-limited discount' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active', description: 'Promotion is live and usable' },
  { value: 'DISABLED', label: 'Disabled', description: 'Temporarily paused' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function valueLabel(type: PromotionType, cur: string): string {
  if (type === 'PERCENTAGE') return 'Discount (%)';
  if (type === 'FIXED_AMOUNT') return `Discount (${cur})`;
  return 'Discount Value';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditPromotionPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const { currency } = useCurrency();

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
            || p.translations?.[0]?.title || p.product?.translations?.[0]?.title || 'Untitled',
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
      setError('Failed to load promotion');
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
      setError('Title (English) is required.');
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
      setError(err?.message || 'Failed to update promotion.');
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
          Back to Promotions
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
          <h1 className="text-xl font-semibold tracking-tight">Edit Promotion</h1>
          <p className="text-sm text-muted-foreground">Update this promotion's settings</p>
        </div>
        {saved && (
          <span className="text-xs text-emerald-600 font-medium">Saved successfully!</span>
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
              <CardTitle className="text-sm font-semibold">Promotion Type</CardTitle>
              <Badge variant="secondary" className="text-[10px]">Cannot be changed</Badge>
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
              <CardTitle className="text-sm font-semibold">Promotion Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <SearchableSelect
                    value={status}
                    onChange={(v) => setStatus(v as PromotionStatus)}
                    placeholder="Select status..."
                    options={STATUS_OPTIONS}
                  />
                </div>

                {/* Usage info */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Usage</Label>
                  <div className="flex items-center h-8 px-3 rounded-md border bg-muted/50 text-sm text-muted-foreground">
                    Used {usageCount}{usageLimit ? ` / ${usageLimit}` : ''} times
                  </div>
                </div>
              </div>

              {/* Value */}
              {showValueField && (
                <div className="space-y-1.5">
                  <Label className="text-xs">{valueLabel(type, currency)}</Label>
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
                  <Label className="text-xs">Coupon Code</Label>
                  <div className="flex items-center h-8 px-3 rounded-md border bg-muted/50 font-mono text-sm tracking-widest">
                    {couponCode}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Coupon code cannot be changed after creation.</p>
                </div>
              )}

              {/* Usage limit */}
              <div className="space-y-1.5">
                <Label className="text-xs">Usage Limit</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(e.target.value)}
                  placeholder="Unlimited"
                  className="h-8"
                />
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Starts At</Label>
                  <div className="flex items-center h-8 px-3 rounded-md border bg-muted/50 text-sm text-muted-foreground">
                    {startsAt || '—'}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Expires At</Label>
                  <Input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="h-8"
                  />
                  <p className="text-[10px] text-muted-foreground">Leave blank for no expiry.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Product targeting */}
        {type && products.length > 0 && (
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Apply to Products</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[10px] text-muted-foreground">
                Select specific products this promotion applies to. Leave empty to apply to all products.
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
                    {selectedProductIds.length} product{selectedProductIds.length > 1 ? 's' : ''} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedProductIds([])}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Details */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">
                Title (English) <span className="text-destructive">*</span>
              </Label>
              <Input
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                placeholder="e.g. Summer Sale 20% Off"
                className="h-8"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <RichTextEditor
                content={descEn}
                onChange={setDescEn}
                placeholder="Brief description of this promotion..."
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
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
