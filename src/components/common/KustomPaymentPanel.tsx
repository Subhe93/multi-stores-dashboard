'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Check, CheckCircle2, Copy, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';

/**
 * Kustom-specific order fields. The API exposes them to admins and the owning
 * creator only; customer-facing responses never include them.
 */
export interface KustomOrderFields {
  payment_method?: string | null;
  payment_status?: string | null;
  kustom_order_id?: string | null;
  kustom_capture_id?: string | null;
  kustom_captured_at?: string | null;
}

interface KustomCaptureResponse {
  captured: boolean;
  capture_id: string | null;
  already_captured: boolean;
}

interface KustomRefundResponse {
  refunded: true;
  amount: number;
}

/** Live order state read from Kustom's Order Management API. */
interface KustomLiveStatus {
  status: string;
  fraud_status: string | null;
  currency: string;
  order_amount: number;
  captured_amount: number;
  refunded_amount: number;
  remaining_authorized_amount: number;
  expires_at: string | null;
  payment_method: string | null;
}

interface Props {
  orderId: string;
  order: KustomOrderFields;
  token: string;
  /** Re-fetches the order after a successful capture or refund. */
  onRefresh: () => void;
  /** Render a "Provider: Kustom" row (for pages that do not already show the method). */
  showProvider?: boolean;
  /** Order currency; amounts are formatted in it rather than the dashboard default. */
  currency?: string | null;
}

/**
 * Payment-card section for orders paid through Kustom Checkout: shows the
 * Kustom order id, the capture state and the manual capture / refund actions.
 * Rendered by both the admin and the creator order detail pages.
 */
export function KustomPaymentPanel({ orderId, order, token, onRefresh, showProvider, currency }: Props) {
  const tp = useTranslations('payments');
  const tc = useTranslations('common');
  const { fmt } = useCurrency();
  // Refunds are made in the order's own currency, which for an independent
  // store can differ from the dashboard's default.
  const fmtAmount = (value: number) =>
    currency ? new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value) : fmt(value);

  const [copied, setCopied] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [live, setLive] = useState<KustomLiveStatus | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);

  const isCaptured = !!order.kustom_captured_at;
  // Our order is marked paid as soon as Kustom authorizes the payment.
  const isAuthorized = order.payment_status === 'paid';
  const canCapture = isAuthorized && !isCaptured;
  // Kustom only refunds captured money; before capture the API releases the
  // authorization instead, which is only possible as a full refund.
  const canRefund = isAuthorized;
  const partialAllowed = isCaptured;

  const handleCopy = async () => {
    if (!order.kustom_order_id) return;
    try {
      await navigator.clipboard.writeText(order.kustom_order_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access denied — nothing to do.
    }
  };

  // Ask Kustom for the authoritative state of this order (captured in the
  // portal? cancelled? expired?) so a refused capture is explainable.
  const handleRefreshLive = async () => {
    if (liveLoading) return;
    setLiveLoading(true);
    setMsg(null);
    try {
      const res = await api<KustomLiveStatus>(`/payments/kustom/orders/${orderId}/status`, { token });
      setLive(res);
    } catch (err) {
      setMsg({ type: 'error', text: (err instanceof Error && err.message) || tp('kustomStatusFailed') });
    } finally {
      setLiveLoading(false);
    }
  };

  const handleCapture = async () => {
    if (capturing) return;
    setCapturing(true);
    setMsg(null);
    try {
      await api<KustomCaptureResponse>(`/payments/kustom/orders/${orderId}/capture`, {
        method: 'POST',
        token,
      });
      setMsg({ type: 'success', text: tp('kustomCaptureDone') });
      onRefresh();
    } catch (err) {
      setMsg({ type: 'error', text: (err instanceof Error && err.message) || tp('kustomCaptureFailed') });
    } finally {
      setCapturing(false);
    }
  };

  const closeRefund = () => {
    setRefundOpen(false);
    setConfirmRefund(false);
    setRefundAmount('');
  };

  const handleRefund = async () => {
    if (refunding) return;
    const raw = refundAmount.trim();
    const amount = raw ? Number(raw) : null;
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
      setMsg({ type: 'error', text: tp('kustomRefundInvalidAmount') });
      return;
    }
    setRefunding(true);
    setMsg(null);
    try {
      // Omitting `amount` refunds the full captured amount.
      const res = await api<KustomRefundResponse>(`/payments/kustom/orders/${orderId}/refund`, {
        method: 'POST',
        token,
        body: JSON.stringify(amount !== null ? { amount } : {}),
      });
      setMsg({ type: 'success', text: tp('kustomRefundDone', { amount: fmtAmount(Number(res.amount)) }) });
      closeRefund();
      onRefresh();
    } catch (err) {
      setMsg({ type: 'error', text: (err instanceof Error && err.message) || tp('kustomRefundFailed') });
      setConfirmRefund(false);
    } finally {
      setRefunding(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {showProvider && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">{tp('kustomProviderLabel')}</span>
          <span>{tp('kustomProvider')}</span>
        </div>
      )}

      {/* Kustom order id — mono + copy */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground shrink-0">{tp('kustomOrderId')}</span>
        {order.kustom_order_id ? (
          <span className="flex items-center gap-1 min-w-0">
            <span className="font-mono truncate" title={order.kustom_order_id}>
              {order.kustom_order_id}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex size-5 shrink-0 items-center justify-center rounded hover:bg-muted transition"
              aria-label={copied ? tp('kustomCopied') : tp('kustomCopy')}
              title={copied ? tp('kustomCopied') : tp('kustomCopy')}
            >
              {copied ? (
                <Check className="size-3 text-emerald-600" />
              ) : (
                <Copy className="size-3 text-muted-foreground" />
              )}
            </button>
          </span>
        ) : (
          <span>—</span>
        )}
      </div>

      {/* Capture state */}
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground shrink-0">{tp('kustomCaptureState')}</span>
        {isCaptured ? (
          <span className="text-emerald-700 text-end">
            {tp('kustomCapturedOn', { date: new Date(order.kustom_captured_at as string).toLocaleString() })}
          </span>
        ) : isAuthorized ? (
          <span className="text-amber-700 text-end">{tp('kustomAwaitingCapture')}</span>
        ) : (
          <span className="text-muted-foreground text-end">{tp('statusAwaiting')}</span>
        )}
      </div>

      {/* Live state from Kustom, on demand */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground shrink-0">{tp('kustomLiveStatus')}</span>
        <button
          type="button"
          onClick={handleRefreshLive}
          disabled={liveLoading}
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline disabled:opacity-50"
        >
          {liveLoading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          {tp('kustomRefreshStatus')}
        </button>
      </div>
      {live && (
        <div className="rounded-lg border bg-muted/30 px-2.5 py-2 text-[11px] space-y-0.5">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">{tp('kustomLiveStatus')}</span>
            <span className="font-medium">{live.status || '—'}{live.fraud_status ? ` · ${live.fraud_status}` : ''}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">{tp('kustomLiveCaptured')}</span>
            <span>{fmtAmount(live.captured_amount)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">{tp('kustomLiveRemaining')}</span>
            <span>{fmtAmount(live.remaining_authorized_amount)}</span>
          </div>
          {live.refunded_amount > 0 && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{tp('kustomLiveRefunded')}</span>
              <span>{fmtAmount(live.refunded_amount)}</span>
            </div>
          )}
          {live.expires_at && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{tp('kustomLiveExpires')}</span>
              <span>{new Date(live.expires_at).toLocaleString()}</span>
            </div>
          )}
          {live.payment_method && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{tp('kustomLivePaymentMethod')}</span>
              <span>{live.payment_method}</span>
            </div>
          )}
        </div>
      )}

      {msg && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] ${
            msg.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-destructive/30 bg-destructive/5 text-destructive'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          )}
          {msg.text}
        </div>
      )}

      {/* Manual capture — normally happens automatically on SHIPPED. */}
      {canCapture && (
        <div className="space-y-1 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={handleCapture}
            disabled={capturing}
          >
            {capturing && <Loader2 className="size-3.5 animate-spin" />}
            {tp('kustomCapturePayment')}
          </Button>
          <p className="text-[10px] text-muted-foreground">{tp('kustomCaptureHint')}</p>
        </div>
      )}

      {/* Refund — inline form with a two-step confirm. */}
      {canRefund && (
        <div className="pt-1">
          {refundOpen ? (
            <div className="space-y-2 rounded-lg border p-2.5">
              {partialAllowed ? (
                <div className="space-y-1">
                  <Label className="text-[11px]">{tp('kustomRefundAmount')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="h-8 text-sm"
                    value={refundAmount}
                    onChange={(e) => {
                      setRefundAmount(e.target.value);
                      setConfirmRefund(false);
                    }}
                    placeholder={tp('kustomRefundFullPlaceholder')}
                    disabled={refunding}
                  />
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground">{tp('kustomCancelAuthHint')}</p>
              )}
              <div className="flex items-center justify-end gap-1.5">
                <Button size="sm" variant="outline" onClick={closeRefund} disabled={refunding}>
                  {tc('cancel')}
                </Button>
                {confirmRefund ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    onClick={handleRefund}
                    disabled={refunding}
                  >
                    {refunding && <Loader2 className="size-3.5 animate-spin" />}
                    {tp('kustomRefundConfirm')}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setConfirmRefund(true)} disabled={refunding}>
                    {tp('kustomRefund')}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              onClick={() => {
                setMsg(null);
                setRefundOpen(true);
              }}
            >
              {tp('kustomRefund')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
