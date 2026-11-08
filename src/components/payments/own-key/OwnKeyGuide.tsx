'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronDown, Copy, ExternalLink, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  OWN_KEY_EGRESS_IP,
  STRIPE_API_KEYS_URL,
  STRIPE_PAYMENT_METHODS_URL,
  STRIPE_SANDBOX_API_KEYS_URL,
  guideImagePath,
} from '@/lib/ownStripeKey';
import { PermissionTable } from './PermissionTable';

const STEP_COUNT = 9;
/** The IP allowlist step is optional, so it sits in a collapsed "Advanced" disclosure. */
const ADVANCED_STEP = 5;
/** Extra screenshots shown under a step's main image (file step-<id>.png). */
const EXTRA_IMAGES: Record<number, string[]> = { 6: ['6-2'] };

/**
 * Screenshot slot: renders the image when the file exists, otherwise a neat
 * placeholder with the step title. The guide only mounts on the client (after
 * the status fetch / a click), so onError always fires. Alaa supplies the
 * files later; see plans/stripe-restricted-keys/SCREENSHOTS.md.
 */
function GuideImage({ step, title }: { step: number | string; title: string }) {
  const t = useTranslations('ownStripeKey.guide');
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex aspect-[8/5] w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed bg-muted/30 px-4 text-center">
        <ImageIcon className="size-5 text-zinc-400" aria-hidden="true" />
        <span className="text-[11px] font-medium text-zinc-600">{title}</span>
        <span className="text-[10px] text-muted-foreground">{t('imagePlaceholder')}</span>
      </div>
    );
  }
  return (
    // Static guide screenshots from /public; next/image adds nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={guideImagePath(step)}
      alt={title}
      width={1200}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-auto w-full rounded-lg border bg-muted/30"
    />
  );
}

function CopyValue({ value }: { value: string }) {
  const t = useTranslations('ownStripeKey.guide');
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context): the value is still selectable.
    }
  };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1">
      <code className="select-all font-mono text-xs text-zinc-800" dir="ltr">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        aria-label={t('copy')}
      >
        {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
        {copied ? t('copied') : t('copy')}
      </button>
    </span>
  );
}

function ExternalButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-background px-2.5 text-[11px] font-medium hover:bg-muted"
    >
      {children}
      <ExternalLink className="size-3" aria-hidden="true" />
    </a>
  );
}

/** Optional step body, collapsed behind an "Advanced (optional)" toggle. */
function AdvancedStep({ children }: { children: ReactNode }) {
  const t = useTranslations('ownStripeKey.guide');
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 hover:text-foreground"
      >
        {t('advanced')}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && children}
    </div>
  );
}

/**
 * Collapsible, numbered setup guide (9 steps, each with an image slot).
 * `defaultOpen` is re-applied when it changes (e.g. 2FA turned on, key stopped working).
 */
export function OwnKeyGuide({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const t = useTranslations('ownStripeKey.guide');
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => setOpen(defaultOpen), [defaultOpen]);

  const extra = (step: number): ReactNode => {
    switch (step) {
      case 1:
        return (
          <div className="flex flex-wrap gap-2">
            <ExternalButton href={STRIPE_API_KEYS_URL}>{t('openLive')}</ExternalButton>
            <ExternalButton href={STRIPE_SANDBOX_API_KEYS_URL}>{t('openTest')}</ExternalButton>
          </div>
        );
      case 4:
        return <PermissionTable />;
      case ADVANCED_STEP:
        return (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>{t('ipLabel')}</span>
              <CopyValue value={OWN_KEY_EGRESS_IP} />
            </div>
            <p className="text-[11px] text-muted-foreground">{t('ipNotice')}</p>
          </div>
        );
      case 9:
        return (
          <div className="flex flex-wrap gap-2">
            <ExternalButton href={STRIPE_PAYMENT_METHODS_URL}>{t('openPaymentMethods')}</ExternalButton>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start text-xs font-medium hover:bg-muted/40"
      >
        <span>{t('title')}</span>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          {open ? t('toggleHide') : t('toggleShow')}
          <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </span>
      </button>
      {open && (
        <ol className="space-y-5 border-t px-3 py-4">
          {Array.from({ length: STEP_COUNT }, (_, i) => i + 1).map((step) => {
            const title = t(`steps.s${step}.title`);
            const body = (
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs font-semibold">{title}</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{t(`steps.s${step}.body`)}</p>
                {extra(step)}
                <GuideImage step={step} title={title} />
                {EXTRA_IMAGES[step]?.map((id) => <GuideImage key={id} step={id} title={title} />)}
              </div>
            );
            const advanced = step === ADVANCED_STEP;
            return (
              <li key={step} className="flex gap-3">
                <span
                  className={cn(
                    'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                    advanced ? 'border border-dashed border-zinc-300 text-zinc-500' : 'bg-zinc-900 text-white',
                  )}
                >
                  {step}
                </span>
                {advanced ? <AdvancedStep>{body}</AdvancedStep> : body}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
