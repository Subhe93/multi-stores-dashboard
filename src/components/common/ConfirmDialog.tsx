'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Confirm button label (defaults to common.confirm / common.delete when destructive). */
  confirmLabel?: ReactNode;
  destructive?: boolean;
  /** Disables the buttons and shows the busy label while the action runs. */
  busy?: boolean;
  busyLabel?: ReactNode;
  /** Error from the last attempt, shown above the buttons. */
  error?: ReactNode;
  onConfirm: () => void;
}

/** Small confirm dialog for single and bulk actions (delete, archive, ...). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  busy,
  busyLabel,
  error,
  onConfirm,
}: ConfirmDialogProps) {
  const tc = useTranslations('common');
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            {tc('cancel')}
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} size="sm" onClick={onConfirm} disabled={busy}>
            {busy ? (busyLabel ?? '…') : (confirmLabel ?? (destructive ? tc('delete') : tc('confirm')))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
