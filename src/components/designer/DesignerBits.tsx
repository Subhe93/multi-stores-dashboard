'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AssetResolution, AssetWarning, DesignTemplateStatus, PrintStatus } from '@/lib/designer/designer.api';
import { humanizeCode } from '@/components/importer/ImporterBits';

// ─── Badges ──────────────────────────────────────────────────────────────────

const TEMPLATE_TONE: Record<DesignTemplateStatus, string> = {
  DRAFT: 'bg-zinc-50 text-zinc-700 border-zinc-200',
  PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ARCHIVED: 'bg-zinc-100 text-zinc-500 border-zinc-200',
};

export function TemplateStatusBadge({ status }: { status: DesignTemplateStatus }) {
  const t = useTranslations('creator.designer.status');
  return (
    <Badge variant="outline" className={TEMPLATE_TONE[status] ?? TEMPLATE_TONE.DRAFT}>
      {t.has(status) ? t(status) : status}
    </Badge>
  );
}

const PRINT_TONE: Record<PrintStatus, string> = {
  PENDING: 'bg-sky-50 text-sky-700 border-sky-200',
  RENDERING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  READY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
  PURGED: 'bg-zinc-100 text-zinc-500 border-zinc-200',
};

export function PrintStatusBadge({ status, waiting }: { status: PrintStatus; waiting?: boolean }) {
  const t = useTranslations('creator.designer.printStatus');
  // PENDING without a request time = the order is not paid yet (no render queued).
  const label = waiting && status === 'PENDING' ? t('WAITING') : t.has(status) ? t(status) : status;
  return (
    <Badge variant="outline" className={PRINT_TONE[status] ?? PRINT_TONE.PENDING}>
      {status === 'RENDERING' && <Loader2 className="animate-spin" />}
      {label}
    </Badge>
  );
}

// ─── Print errors ────────────────────────────────────────────────────────────

/** Fixed English print errors the API writes without a code. */
const PRINT_ERROR_TEXTS: Record<string, string> = {
  'The render was interrupted (worker lost).': 'WORKER_LOST',
};

/**
 * Localized text of a stored `print_error` (`CODE: detail`). Render codes
 * resolve through `creator.designer.printErrors`, API codes through
 * `errors`; anything unknown is shown as sent.
 */
export function usePrintErrorText() {
  const tp = useTranslations('creator.designer.printErrors');
  const te = useTranslations('errors');
  return (raw: string | null | undefined): string => {
    const text = (raw ?? '').trim();
    if (!text) return '';
    const fixed = PRINT_ERROR_TEXTS[text];
    if (fixed && tp.has(fixed)) return tp(fixed);
    const m = /^([A-Z][A-Z0-9_]{2,}):\s*([\s\S]*)$/.exec(text);
    if (!m) return text;
    const code = m[1];
    const inner = PRINT_ERROR_TEXTS[m[2].trim()];
    if (inner && tp.has(inner)) return tp(inner);
    if (tp.has(code)) return tp(code);
    if (te.has(code)) return te(code);
    return text;
  };
}

// ─── Warnings ────────────────────────────────────────────────────────────────

/**
 * Text of a designer warning code. NPP import and asset-check codes live
 * under `creator.designer.importWarnings.<CODE>` (one sentence, no
 * placeholders, so the importer log can reuse it); an unknown code falls back
 * to the humanized code so a new API code never shows raw.
 */
export function useDesignerWarningLabel() {
  const t = useTranslations('creator.designer.importWarnings');
  return (code: string): string => (t.has(code) ? t(code) : humanizeCode(code));
}

/** Detail line of an upload warning (numbers from `params`), when one exists. */
function useWarningDetail() {
  const t = useTranslations('creator.designer.assets.warningDetail');
  return (w: AssetWarning): string | null => {
    const p = w.params ?? {};
    const num = (k: string) => Number(p[k] ?? 0);
    switch (w.code) {
      case 'PRINT_BG_LOW_RES':
      case 'WEB_BG_LOW_RES':
        return t('lowRes', {
          width: num('width'),
          height: num('height'),
          targetWidth: num('target_width'),
          targetHeight: num('target_height'),
          dpi: num('effective_dpi'),
        });
      case 'WEB_BG_LARGE':
        return t('large', {
          width: num('width'),
          height: num('height'),
          targetWidth: num('target_width'),
          targetHeight: num('target_height'),
        });
      case 'ASPECT_MISMATCH':
        return t('aspect', { image: String(p.image_ratio ?? '?'), template: String(p.template_ratio ?? '?') });
      default:
        return null;
    }
  };
}

/** Friendly list of the `warnings[]` of an upload (never blocking). */
export function UploadWarnings({ warnings, resolution }: { warnings: AssetWarning[]; resolution?: AssetResolution | null }) {
  const t = useTranslations('creator.designer.assets');
  const label = useDesignerWarningLabel();
  const detail = useWarningDetail();
  if (warnings.length === 0 && !resolution) return null;
  return (
    <div className="space-y-2">
      {warnings.length > 0 && (
        <div className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="size-3.5 shrink-0" />
            {t('warningsTitle')}
          </p>
          <ul className="space-y-1 ps-5">
            {warnings.map((w, i) => {
              const d = detail(w);
              return (
                <li key={`${w.code}-${i}`} className="list-disc">
                  <span>{label(w.code)}</span>
                  {d && <span className="block text-amber-700/80">{d}</span>}
                </li>
              );
            })}
          </ul>
          <p className="text-amber-700/80">{t('warningsNotBlocking')}</p>
        </div>
      )}
      {resolution && <ResolutionInfo resolution={resolution} />}
    </div>
  );
}

/** DPI line of a background: effective DPI over the trim size and the target pixels. */
export function ResolutionInfo({ resolution }: { resolution: AssetResolution }) {
  const t = useTranslations('creator.designer.assets');
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {t('resolutionInfo', {
          dpi: resolution.effective_dpi,
          width: resolution.target_px.width,
          height: resolution.target_px.height,
          mmWidth: resolution.template_mm.width,
          mmHeight: resolution.template_mm.height,
        })}
      </span>
    </p>
  );
}

/** Effective DPI of an image stretched over a trim size (min of both axes). */
export function stretchDpi(width: number, height: number, mm: { width: number; height: number }): number {
  if (!mm.width || !mm.height) return 0;
  return Math.round(Math.min(width / (mm.width / 25.4), height / (mm.height / 25.4)));
}

/** Inline error under a field (also the target of the "jump to field" flow). */
export function FieldError({ text }: { text?: string | null }) {
  if (!text) return null;
  return <p className="text-[11px] text-red-600">{text}</p>;
}
