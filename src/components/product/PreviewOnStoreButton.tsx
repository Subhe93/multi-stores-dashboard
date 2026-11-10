'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { cachedEditHintToken, ensureEditHintToken } from '@/lib/storefrontEditHint';
import { withEditHint } from '@/lib/storefrontEditHintUrl';

interface PreviewOnStoreButtonProps {
  /** Storefront product URL; null when the product has no slug yet. */
  href: string | null;
  /** Tooltip explaining why the button is disabled. */
  disabledHint?: string;
}

/**
 * "Preview on store" for a DRAFT product: opens the storefront product URL
 * in a new tab with the edit-hint hand-off (`#ms_edit=<token>`). The
 * storefront turns that token into the owner's product preview cookie, and
 * the API serves the draft to the owner only (everyone else keeps the 404),
 * so — unlike "View in store" — the hand-off is mandatory here: without a
 * token the tab is not opened. The tab is opened synchronously (inside the
 * click's user activation) and pointed at the URL once the token is known.
 */
export function PreviewOnStoreButton({ href, disabledHint }: PreviewOnStoreButtonProps) {
  const t = useTranslations('product');
  const { token, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const userId = user?.role === 'CREATOR' ? user.id : null;
  const enabled = !!href && !!token && !!userId;

  const warm = () => {
    if (enabled && !cachedEditHintToken(userId)) void ensureEditHintToken(userId, token);
  };

  const open = async () => {
    if (!enabled || busy) return;
    setFailed(false);
    const cached = cachedEditHintToken(userId);
    if (cached) {
      window.open(withEditHint(href, cached), '_blank', 'noopener,noreferrer');
      return;
    }
    // No token yet: keep the user activation by opening the tab first.
    const tab = window.open('about:blank', '_blank');
    setBusy(true);
    try {
      const hint = await ensureEditHintToken(userId, token);
      if (!hint) {
        tab?.close();
        setFailed(true);
        return;
      }
      const url = withEditHint(href, hint);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } finally {
      setBusy(false);
    }
  };

  const hint = failed ? t('previewOnStoreFailed') : enabled ? t('previewOnStoreHint') : disabledHint;
  return (
    <span className={enabled ? 'inline-flex' : 'inline-flex cursor-not-allowed'} title={hint}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={!enabled || busy}
        onClick={open}
        onPointerEnter={warm}
        onFocus={warm}
        aria-label={hint ? `${t('previewOnStore')} — ${hint}` : t('previewOnStore')}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
        {t('previewOnStore')}
      </Button>
    </span>
  );
}
