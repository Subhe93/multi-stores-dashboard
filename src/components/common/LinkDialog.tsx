'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProductLinkPicker } from '@/components/builder/fields/ProductLinkPicker';
import { ProductRefChip } from '@/components/builder/fields/ProductRefChip';
import { pickedProductValue, productRefId } from '@/lib/linkFieldMode';
import { cn } from '@/lib/utils';

/**
 * Link dialog of the rich-text editor when product links are enabled (M165):
 * a URL tab (the old prompt) and a Product tab that stores `product:<id>`,
 * resolved by the storefront for every language. `onApply('')` removes the link.
 */
export function LinkDialog({
  open,
  onOpenChange,
  initialHref,
  onApply,
  token,
  contentLocale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialHref: string;
  onApply: (href: string) => void;
  token: string;
  contentLocale: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Remounted per opening so the fields start from the current link. */}
        {open && (
          <LinkDialogBody
            key={initialHref}
            initialHref={initialHref}
            onApply={onApply}
            onClose={() => onOpenChange(false)}
            token={token}
            contentLocale={contentLocale}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LinkDialogBody({
  initialHref,
  onApply,
  onClose,
  token,
  contentLocale,
}: {
  initialHref: string;
  onApply: (href: string) => void;
  onClose: () => void;
  token: string;
  contentLocale: string;
}) {
  const t = useTranslations('components.linkDialog');
  const tl = useTranslations('builder.linkField');
  const initialId = productRefId(initialHref);
  const [tab, setTab] = useState<'url' | 'product'>(initialId ? 'product' : 'url');
  const [url, setUrl] = useState(initialId ? '' : initialHref);
  const [productId, setProductId] = useState<string | null>(initialId);

  const href = tab === 'product' ? (productId ? pickedProductValue(productId) : '') : url.trim();

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('title')}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-1">
        <div role="tablist" className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 text-xs font-medium">
          {(['url', 'product'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn('rounded-md ps-3 pe-3 py-1 transition', tab === k ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800')}
            >
              {k === 'url' ? t('tabUrl') : t('tabProduct')}
            </button>
          ))}
        </div>
        {tab === 'url' ? (
          <div className="space-y-1.5">
            <Label className="text-xs">{t('urlLabel')}</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              dir="ltr"
              className="font-mono text-sm"
              autoFocus
            />
          </div>
        ) : productId ? (
          <ProductRefChip
            id={productId}
            token={token}
            contentLocale={contentLocale}
            onChange={() => setProductId(null)}
            onRemove={() => setProductId(null)}
            missingTitle={tl('missingTitle')}
            missingBody={tl('missingBody')}
          />
        ) : (
          <ProductLinkPicker token={token} contentLocale={contentLocale} onPick={(p) => setProductId(p.id)} />
        )}
        {tab === 'product' && <p className="text-[11px] text-muted-foreground">{tl('everyLanguageHint')}</p>}
      </div>
      <DialogFooter>
        {initialHref && (
          <Button variant="outline" size="sm" className="me-auto text-red-600" onClick={() => { onApply(''); onClose(); }}>
            {t('removeLink')}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button size="sm" disabled={!href} onClick={() => { onApply(href); onClose(); }}>
          {t('apply')}
        </Button>
      </DialogFooter>
    </>
  );
}
