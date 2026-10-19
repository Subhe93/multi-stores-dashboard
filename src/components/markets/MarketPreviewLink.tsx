'use client';

import { useTranslations } from 'next-intl';
import { Check, Copy, ExternalLink, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTransientFlag } from '@/lib/useTransientFlag';

interface MarketPreviewLinkProps {
  /** `MarketView.preview_url`; the card renders nothing when null (default market). */
  previewUrl: string | null;
}

/**
 * "Preview link" of a non-default market: `https://<slug>--<key>.<platform
 * host>` opens the storefront for that market (DRAFT too) before its domain
 * is connected, with the checkout disabled. Copy + open in a new tab.
 */
export function MarketPreviewLink({ previewUrl }: MarketPreviewLinkProps) {
  const t = useTranslations('creator.markets.preview');
  const [copied, flashCopied] = useTransientFlag(1500);
  if (!previewUrl) return null;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(previewUrl);
      flashCopied();
    } catch {
      // Clipboard may be unavailable (insecure context); the value is still readable.
    }
  };

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Eye className="size-4 text-muted-foreground" aria-hidden />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <code className="block truncate rounded border bg-zinc-50 px-2 py-1.5 font-mono text-[11px] text-zinc-800" dir="ltr" title={previewUrl}>
          {previewUrl}
        </code>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-white px-3 text-xs font-medium transition hover:bg-muted"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            {t('open')}
          </a>
          <Button type="button" variant="ghost" size="sm" onClick={onCopy}>
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
            {copied ? t('copied') : t('copy')}
          </Button>
        </div>
        <p className="text-muted-foreground">{t('hint')}</p>
      </CardContent>
    </Card>
  );
}
