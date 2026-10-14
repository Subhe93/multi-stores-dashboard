'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ApiError } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import { formatInvoiceAmount } from '@/lib/invoices';
import { createCreditNote, type InvoiceSummary } from '@/lib/invoices.api';

type Mode = 'full' | 'amount';

const REASON_MAX = 500;

interface CreditNoteDialogProps {
  invoice: InvoiceSummary | null;
  token: string;
  onOpenChange: (open: boolean) => void;
  onCreated: (creditNote: InvoiceSummary) => void;
}

/**
 * Manual credit note for an issued invoice (L10: full remaining amount or a
 * gross amount; the API spreads it pro-rata over the VAT rates). The dialog
 * is open while `invoice` is set.
 */
export function CreditNoteDialog({ invoice, token, onOpenChange, onCreated }: CreditNoteDialogProps) {
  const t = useTranslations('creator.invoices.creditDialog');
  const tc = useTranslations('common');
  const locale = useLocale();
  const describeError = useApiError();
  const [mode, setMode] = useState<Mode>('full');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Server-reported remainder (INVOICE_CREDIT_EXCEEDS) for the invoice it
  // belongs to; overrides the possibly stale list value.
  const [serverRemaining, setServerRemaining] = useState<{ id: string; value: number } | null>(null);

  const remaining =
    serverRemaining && serverRemaining.id === invoice?.id
      ? serverRemaining.value
      : Number(invoice?.remaining_creditable ?? invoice?.gross_total ?? 0);
  const currency = invoice?.currency ?? 'SEK';
  const parsedAmount = Number(amount.replace(',', '.'));
  const amountValid =
    mode === 'full' || (Number.isFinite(parsedAmount) && parsedAmount >= 0.01 && parsedAmount <= remaining + 1e-9);

  const reset = () => {
    setMode('full');
    setAmount('');
    setReason('');
    setError(null);
    setServerRemaining(null);
  };

  const handleOpenChange = (open: boolean) => {
    if (submitting) return;
    if (!open) reset();
    onOpenChange(open);
  };

  const handleSubmit = async () => {
    if (!invoice || submitting) return;
    if (!amountValid) {
      setError(t('invalidAmount', { max: formatInvoiceAmount(remaining, currency, locale) }));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const note = await createCreditNote(token, invoice.id, {
        ...(mode === 'amount' ? { amount: Math.round(parsedAmount * 100) / 100 } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      reset();
      onCreated(note);
    } catch (err) {
      const reported = err instanceof ApiError ? Number(err.payload?.remaining) : NaN;
      if (err instanceof ApiError && err.code === 'INVOICE_CREDIT_EXCEEDS' && Number.isFinite(reported) && invoice) {
        setServerRemaining({ id: invoice.id, value: reported });
        setError(t('invalidAmount', { max: formatInvoiceAmount(reported, currency, locale) }));
      } else {
        setError(describeError(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const modeButton = (value: Mode, label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(value);
        setError(null);
      }}
      aria-pressed={mode === value}
      className={`flex-1 rounded-md border px-3 py-2 text-start text-xs transition ${
        mode === value ? 'border-primary bg-primary/5 font-medium' : 'border-input hover:bg-muted'
      }`}
    >
      {label}
    </button>
  );

  return (
    <Dialog open={!!invoice} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title', { number: invoice?.number ?? '' })}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">{t('remaining')}</span>
            <bdi dir="ltr" className="font-semibold">{formatInvoiceAmount(remaining, currency, locale)}</bdi>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t('mode')}</Label>
            <div className="flex gap-2">
              {modeButton('full', t('full'))}
              {modeButton('amount', t('amount'))}
            </div>
          </div>

          {mode === 'amount' && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t('amountLabel', { currency })}</Label>
              <Input
                type="number"
                inputMode="decimal"
                min={0.01}
                max={remaining}
                step="0.01"
                dir="ltr"
                className="h-9 text-sm"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                placeholder={remaining.toFixed(2)}
              />
              <p className="text-[11px] text-muted-foreground">
                {t('amountHint', { max: formatInvoiceAmount(remaining, currency, locale) })}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">{t('reason')}</Label>
            <Textarea
              value={reason}
              maxLength={REASON_MAX}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              className="min-h-20 text-sm"
            />
            <p className="text-end text-[10px] text-muted-foreground">
              {reason.length}/{REASON_MAX}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" disabled={submitting} onClick={() => handleOpenChange(false)}>
            {tc('cancel')}
          </Button>
          <Button size="sm" disabled={submitting || remaining <= 0} onClick={handleSubmit}>
            {submitting && <Loader2 className="animate-spin" />}
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
