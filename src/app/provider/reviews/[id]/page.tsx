'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, X, Loader2, Package, FileImage } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useCurrency } from '@/lib/useCurrency';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '');
function resolveUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

interface CustomProductDetail {
  id: string;
  status: string;
  pricing_type: string;
  final_price: number;
  margin_amount: number | null;
  submitted_at: string | null;
  product: {
    id: string;
    base_price: number;
    translations: { locale: string; title: string }[];
    images: { url: string }[];
  };
  creator: { display_name: string };
  translations: { locale: string; title: string; description?: string }[];
  mockup_images: { url: string; sort_order: number }[];
  field_values: {
    custom_field_id: string;
    value?: string;
    file_url?: string;
    custom_field?: { name: string; type: string; translations?: { locale: string; label: string }[] };
  }[];
  selected_variants: {
    variant_id: string;
    custom_price: number | null;
    variant: { options: Record<string, string> };
  }[];
}

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const { fmt } = useCurrency();

  const [item, setItem] = useState<CustomProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    api<CustomProductDetail>(`/custom-products/${id}`, { token })
      .then(setItem)
      .catch((err) => setError(err?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, id]);

  const handleApprove = async () => {
    if (!token || !id) return;
    setActionLoading(true);
    setError('');
    try {
      await api(`/custom-products/${id}/approve`, { method: 'POST', token });
      setSuccess('Approved successfully');
      setTimeout(() => router.push('/provider/reviews'), 1000);
    } catch (err: any) {
      setError(err?.message || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!token || !id || !rejectReason.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      await api(`/custom-products/${id}/reject`, {
        method: 'POST',
        token,
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      setShowRejectDialog(false);
      setSuccess('Rejected with feedback sent to creator');
      setTimeout(() => router.push('/provider/reviews'), 1000);
    } catch (err: any) {
      setError(err?.message || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  if (!item) return <p className="text-center py-12 text-muted-foreground text-sm">{error || 'Custom product not found'}</p>;

  const title = item.translations?.find((t) => t.locale === 'en')?.title
    || item.translations?.[0]?.title || 'Untitled';
  const description = item.translations?.find((t) => t.locale === 'en')?.description
    || item.translations?.[0]?.description;
  const baseTitle = item.product.translations?.find((t) => t.locale === 'en')?.title
    || item.product.translations?.[0]?.title;

  const isPending = item.status === 'PENDING_REVIEW';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => router.push('/provider/reviews')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">
            by {item.creator.display_name} · Base: {baseTitle || '—'}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">{item.status}</Badge>
      </div>

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Mockup images + details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Mockup images */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Mockup Images</CardTitle>
            </CardHeader>
            <CardContent>
              {item.mockup_images.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-zinc-400">
                  <Package className="w-10 h-10" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {item.mockup_images.map((img, i) => (
                    <a
                      key={i}
                      href={resolveUrl(img.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="block aspect-square rounded-lg overflow-hidden border bg-zinc-50 hover:opacity-90 transition"
                    >
                      <img src={resolveUrl(img.url)} alt={`Mockup ${i + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          {description && (
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          )}

          {/* Custom field values from creator */}
          {item.field_values.length > 0 && (
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Creator-Filled Fields</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {item.field_values.map((fv) => {
                    const label = fv.custom_field?.translations?.find((t) => t.locale === 'en')?.label
                      || fv.custom_field?.translations?.[0]?.label
                      || fv.custom_field?.name
                      || fv.custom_field_id;
                    const isImage = fv.custom_field?.type === 'IMAGE' || fv.custom_field?.type === 'MULTI_IMAGE';
                    return (
                      <div key={fv.custom_field_id} className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">{label}</p>
                        {fv.file_url ? (
                          isImage ? (
                            <a href={fv.file_url} target="_blank" rel="noreferrer" className="block">
                              <img
                                src={fv.file_url}
                                alt={label}
                                className="max-w-xs rounded-md border"
                              />
                            </a>
                          ) : (
                            <a
                              href={fv.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border bg-zinc-50 text-xs hover:bg-zinc-100 transition"
                            >
                              <FileImage className="w-3.5 h-3.5" />
                              {fv.file_url.split('/').pop() || 'File'}
                            </a>
                          )
                        ) : (
                          <p className="text-sm">{fv.value || '—'}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Pricing + actions */}
        <div className="space-y-4">
          {/* Pricing */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Strategy</span>
                <span className="font-medium">{item.pricing_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your base price</span>
                <span>{fmt(item.product.base_price)}</span>
              </div>
              {item.pricing_type === 'SINGLE' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Final price</span>
                  <span className="font-semibold">{fmt(item.final_price)}</span>
                </div>
              )}
              {item.pricing_type === 'MARGIN' && item.margin_amount != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Margin</span>
                  <span className="font-semibold">+{fmt(item.margin_amount)}</span>
                </div>
              )}
              {item.pricing_type === 'PER_VARIANT' && (
                <div className="space-y-1 pt-1 border-t mt-2">
                  {item.selected_variants.map((sv) => (
                    <div key={sv.variant_id} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {Object.entries(sv.variant.options || {}).map(([k, v]) => `${k}: ${v}`).join(' / ')}
                      </span>
                      <span>{sv.custom_price != null ? fmt(sv.custom_price) : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          {isPending && (
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Decision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleApprove}
                  disabled={actionLoading}
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  Approve & Publish
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={actionLoading}
                >
                  <X className="w-4 h-4 mr-1.5" />
                  Reject with reason
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Reject dialog */}
      <Dialog open={showRejectDialog} onOpenChange={(v) => { if (!v) setShowRejectDialog(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject custom product</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Reason for rejection *</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. The image you uploaded uses copyrighted artwork without permission..."
              rows={4}
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              The creator will see this message and can revise the product.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading || !rejectReason.trim()}
            >
              {actionLoading ? 'Rejecting...' : 'Send rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}