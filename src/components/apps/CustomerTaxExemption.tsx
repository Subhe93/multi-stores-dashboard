'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, Loader2, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApiError } from '@/lib/useApiError';
import {
  normalizeVatNumber,
  TAX_EXEMPTION_KINDS,
  type TaxExemptionKind,
  type TaxExemptionView,
} from '@/lib/b2b';
import { createTaxExemption, getCustomerTaxExemption, revokeTaxExemption } from '@/lib/b2bTax.api';

const NOTE_MAX = 500;

interface CustomerTaxExemptionProps {
  token: string;
  orderId: string;
  // Null for guest orders (exemptions need a customer account).
  customerId: string | null | undefined;
  // Prefill for the REVERSE_CHARGE kind (the order's validated / snapshot number).
  vatNumber?: string | null;
}

/**
 * Customer-card block of the creator order detail (b2b app, D4/L7): shows the
 * customer's active tax exemption with a remove action, or the "Exempt this
 * customer from VAT" action that opens the dialog. Exemptions apply to later
 * orders where the customer is known at pricing time (logged in).
 */
export function CustomerTaxExemption({ token, orderId, customerId, vatNumber }: CustomerTaxExemptionProps) {
  const t = useTranslations('creator.orderDetail.taxExemption');
  const locale = useLocale();
  const describeError = useApiError();
  const [exemption, setExemption] = useState<TaxExemptionView | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!customerId) return;
    setLoading(true);
    getCustomerTaxExemption(token, customerId)
      .then((view) => setExemption(view && !view.revoked_at ? view : null))
      .catch(() => setExemption(null))
      .finally(() => setLoading(false));
  }, [token, customerId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!customerId) {
    return <p className="border-t pt-2 mt-2 text-[11px] text-muted-foreground">{t('guestNoExemption')}</p>;
  }

  const handleRemove = async () => {
    if (!exemption || removing) return;
    setRemoving(true);
    setError(null);
    try {
      await revokeTaxExemption(token, exemption.id);
      setExemption(null);
      setConfirmRemove(false);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-1.5 border-t pt-2 mt-2">
      {loading ? (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
      ) : exemption ? (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] font-medium bg-teal-50 text-teal-700 border-teal-200">
              {exemption.kind === 'FULL' ? t('kindFull') : t('kindReverseCharge')}
            </Badge>
            {exemption.vat_number && (
              <span dir="ltr" className="font-mono">
                {exemption.vat_number}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t('exemptSince', { date: new Date(exemption.created_at).toLocaleDateString(locale) })}
            {exemption.note ? ` — ${exemption.note}` : ''}
          </p>
          {confirmRemove ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px]">{t('removeConfirm')}</span>
              <Button size="xs" variant="destructive" disabled={removing} onClick={handleRemove}>
                {removing ? <Loader2 className="animate-spin" /> : null}
                {t('remove')}
              </Button>
              <Button size="xs" variant="ghost" disabled={removing} onClick={() => setConfirmRemove(false)}>
                {t('cancel')}
              </Button>
            </div>
          ) : (
            <Button size="xs" variant="outline" onClick={() => setConfirmRemove(true)}>
              <ShieldOff /> {t('removeExemption')}
            </Button>
          )}
        </div>
      ) : (
        <Button size="xs" variant="outline" onClick={() => setDialogOpen(true)}>
          {t('exemptCustomer')}
        </Button>
      )}
      {error && <p className="text-[11px] text-red-600">{error}</p>}

      <CustomerTaxExemptionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        token={token}
        orderId={orderId}
        vatNumber={vatNumber}
        onCreated={(view) => {
          setExemption(view);
          setDialogOpen(false);
        }}
      />
    </div>
  );
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  orderId: string;
  vatNumber?: string | null;
  onCreated: (view: TaxExemptionView) => void;
}

// Create dialog. The customer is resolved server-side from `order_id`, which
// also proves the customer bought from this store (privacy guard).
function CustomerTaxExemptionDialog({ open, onOpenChange, token, orderId, vatNumber, onCreated }: DialogProps) {
  const t = useTranslations('creator.orderDetail.taxExemption.dialog');
  const tx = useTranslations('creator.orderDetail.taxExemption');
  const describeError = useApiError();
  const [kind, setKind] = useState<TaxExemptionKind>('REVERSE_CHARGE');
  const [vat, setVat] = useState(vatNumber ?? '');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh form each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setKind('REVERSE_CHARGE');
    setVat(vatNumber ?? '');
    setNote('');
    setError(null);
  }, [open, vatNumber]);

  const normalizedVat = normalizeVatNumber(vat);
  const vatMissing = kind === 'REVERSE_CHARGE' && !/^[A-Z]{2}[0-9A-Z]{2,}$/.test(normalizedVat);

  const handleSubmit = async () => {
    if (submitting) return;
    if (vatMissing) {
      setError(t('vatRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const view = await createTaxExemption(token, {
        order_id: orderId,
        kind,
        vat_number: kind === 'REVERSE_CHARGE' ? normalizedVat : null,
        note: note.trim() ? note.trim() : null,
      });
      onCreated(view);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const kindText = (value: TaxExemptionKind) =>
    value === 'FULL'
      ? { title: tx('kindFull'), hint: t('kindFullHint') }
      : { title: tx('kindReverseCharge'), hint: t('kindReverseChargeHint') };

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('kind')}</Label>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
              {TAX_EXEMPTION_KINDS.map((value) => {
                const text = kindText(value);
                const active = kind === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setKind(value);
                      setError(null);
                    }}
                    className={`rounded-md border p-3 text-start transition ${
                      active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'
                    }`}
                  >
                    <p className="text-sm font-medium">{text.title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{text.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {kind === 'REVERSE_CHARGE' && (
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="exemption-vat">
                {t('vatNumber')}
              </Label>
              <Input
                id="exemption-vat"
                dir="ltr"
                className="font-mono"
                maxLength={32}
                placeholder="DE123456789"
                value={vat}
                onChange={(e) => {
                  setVat(e.target.value);
                  setError(null);
                }}
              />
              <p className="text-[11px] text-muted-foreground">{t('vatNumberHint')}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="exemption-note">
              {t('note')}
            </Label>
            <Textarea
              id="exemption-note"
              rows={3}
              maxLength={NOTE_MAX}
              placeholder={t('notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">{t('scopeNote')}</p>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            {tx('cancel')}
          </Button>
          <Button disabled={submitting} onClick={handleSubmit}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            {t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
