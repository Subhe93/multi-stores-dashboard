'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Info, Loader2, Palette, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { applyTheme, type ApplyThemeResult, type ThemePresetSummary } from '@/lib/themes';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { loc } from './ThemeCard';

interface ApplyThemeDialogProps {
  preset: ThemePresetSummary | null;
  primaryLocale: string;
  onClose: () => void;
  /** Called once the preset was applied successfully (before the dialog closes). */
  onApplied: (result: ApplyThemeResult) => void | Promise<void>;
}

export function ApplyThemeDialog({ preset, primaryLocale, onClose, onApplied }: ApplyThemeDialogProps) {
  const { token } = useAuth();
  const t = useTranslations('creator.themes');
  const tc = useTranslations('common');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApplyThemeResult | null>(null);

  // Reset transient state whenever a different preset opens the dialog.
  useEffect(() => {
    if (preset) {
      setError(null);
      setResult(null);
    }
  }, [preset]);

  async function handleApply() {
    if (!preset || !token) return;
    setApplying(true);
    setError(null);
    try {
      const res = await applyTheme(token, preset.id);
      setResult(res);
      await onApplied(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedApply'));
    } finally {
      setApplying(false);
    }
  }

  const name = preset ? loc(preset.name, primaryLocale) : '';
  const updated = result ? result.header.sections_updated + result.footer.sections_updated : 0;
  const created = result ? result.header.sections_created + result.footer.sections_created : 0;
  const published = !!result && (result.header.published || result.footer.published);

  return (
    <Dialog open={!!preset} onOpenChange={(open) => !open && !applying && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('applyDialogTitle', { name })}</DialogTitle>
          <DialogDescription>{t('applyDialogDesc')}</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-emerald-800">{t('applied')}</p>
                <p className="text-[11px] text-emerald-800/80 leading-relaxed">
                  {t('appliedSummary', { updated, created })}
                  {published ? ` · ${t('appliedPublished')}` : ` · ${t('appliedUnpublished')}`}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* What changes */}
            <div className="rounded-lg border border-zinc-200 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-800">
                <Palette className="size-3.5 text-indigo-600" />
                {t('changes')}
              </p>
              <ul className="list-disc space-y-0.5 ps-4 text-[11px] text-muted-foreground leading-relaxed">
                <li>{t('changesColors')}</li>
                <li>{t('changesFonts')}</li>
                <li>{t('changesChrome')}</li>
              </ul>
            </div>

            {/* What stays */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                <ShieldCheck className="size-3.5 text-emerald-600" />
                {t('keeps')}
              </p>
              <ul className="list-disc space-y-0.5 ps-4 text-[11px] text-emerald-800/80 leading-relaxed">
                <li>{t('keepsTexts')}</li>
                <li>{t('keepsPages')}</li>
                <li>{t('keepsRestore')}</li>
              </ul>
            </div>

            {/* Publish note */}
            <div className="flex items-start gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <Info className="mt-0.5 size-4 shrink-0 text-zinc-500" />
              <p className="text-[11px] text-zinc-600 leading-relaxed">{t('publishNote')}</p>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={onClose}>{tc('close')}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={applying}>
                {tc('cancel')}
              </Button>
              <Button onClick={handleApply} disabled={applying}>
                {applying ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    {t('applying')}
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" />
                    {t('apply')}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
