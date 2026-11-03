'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useStorefrontUrl } from '@/lib/useStorefrontUrl';
import { cachedEditHintToken, prefetchEditHintToken } from '@/lib/storefrontEditHint';
import { isOwnStorefrontUrl, withEditHint } from '@/lib/storefrontEditHintUrl';
import { platformHosts } from '@/lib/platformHosts';

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003';
// Every platform host (old + new apex during a domain move): a link to
// `<slug>.<any of them>` is the creator's own storefront too.
const PLATFORM_HOSTS = platformHosts();

/**
 * Renders nothing. Adds the storefront edit-hint hand-off to EVERY link to
 * the creator's own storefront (header "Visit store", "View in store" rows,
 * builder "View live", …) without touching those components:
 * - hovering / focusing such a link fetches the token once (lazy; cached
 *   for its 30-day lifetime, so dashboard pages never wait on it);
 * - on click (or middle-click) the link's href gets `#ms_edit=<token>` for
 *   that navigation only. No token yet → the plain URL opens.
 */
export function StorefrontEditHandoff() {
  const { token, user } = useAuth();
  const { store } = useStorefrontUrl();
  const userId = user?.role === 'CREATOR' ? user.id : null;

  useEffect(() => {
    if (!token || !userId || !store?.slug) return;

    const ownLink = (target: EventTarget | null): HTMLAnchorElement | null => {
      const a = target instanceof Element ? target.closest('a[href]') : null;
      if (!(a instanceof HTMLAnchorElement)) return null;
      return isOwnStorefrontUrl(a.href, store, WEB_ORIGIN, PLATFORM_HOSTS) ? a : null;
    };

    const warm = (e: Event) => {
      if (ownLink(e.target)) prefetchEditHintToken(userId, token);
    };

    const decorate = (e: MouseEvent) => {
      if (e.type === 'auxclick' && e.button !== 1) return;
      const a = ownLink(e.target);
      if (!a) return;
      const hint = cachedEditHintToken(userId);
      if (!hint) {
        // Too early this time; the next visit link will carry it.
        prefetchEditHintToken(userId, token);
        return;
      }
      const original = a.getAttribute('href');
      a.href = withEditHint(a.href, hint);
      // Restore after the browser has read the href for this navigation,
      // so the token never lingers in the DOM.
      window.setTimeout(() => {
        if (original !== null) a.setAttribute('href', original);
      }, 0);
    };

    document.addEventListener('pointerover', warm, true);
    document.addEventListener('focusin', warm, true);
    document.addEventListener('click', decorate, true);
    document.addEventListener('auxclick', decorate, true);
    return () => {
      document.removeEventListener('pointerover', warm, true);
      document.removeEventListener('focusin', warm, true);
      document.removeEventListener('click', decorate, true);
      document.removeEventListener('auxclick', decorate, true);
    };
  }, [token, userId, store]);

  return null;
}
