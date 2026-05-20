'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Percent, DollarSign, Gift, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import type { BundleTemplate } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (tpl: BundleTemplate) => void;
}

const ICONS: Record<string, React.ElementType> = {
  percentage: Percent,
  fixed: DollarSign,
  bxgy: Gift,
  custom: Sparkles,
};

export function BundleTemplatesDialog({ open, onOpenChange, onPick }: Props) {
  const { token } = useAuth();
  const [templates, setTemplates] = useState<BundleTemplate[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || templates || !token) return;
    let cancelled = false;
    api<BundleTemplate[]>('/bundles/templates', { token })
      .then((data) => {
        if (!cancelled) setTemplates(data);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, templates, token]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Load from template</DialogTitle>
          <DialogDescription>
            Pick a bundle template to get started. You can edit every offer afterwards.
          </DialogDescription>
        </DialogHeader>

        {loading || !templates ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((tpl) => {
              const Icon = ICONS[tpl.id] ?? Sparkles;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    onPick(tpl);
                    onOpenChange(false);
                  }}
                  className="flex flex-col items-start gap-2 rounded-lg border bg-white p-4 text-left transition hover:border-zinc-400 hover:shadow-sm"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{tpl.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {tpl.description}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {tpl.offers.length === 0
                      ? 'Start blank'
                      : `${tpl.offers.length} pre-filled offer${tpl.offers.length === 1 ? '' : 's'}`}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
