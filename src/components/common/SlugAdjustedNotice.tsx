'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link2, XIcon } from 'lucide-react';
import { onSlugAdjusted } from '@/lib/slugNotice';

/**
 * Bottom notice shown after a save when the server stored a different slug
 * than the one typed (e.g. `-2` for a URL already in use). Mounted once in
 * the app shell.
 */
export function SlugAdjustedNotice() {
  const t = useTranslations('common.slug');
  const [slug, setSlug] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const off = onSlugAdjusted(({ slug: s }) => {
      if (timer.current) clearTimeout(timer.current);
      setSlug(s);
      timer.current = setTimeout(() => setSlug(null), 8000);
    });
    return () => {
      off();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!slug) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 inset-x-4 z-50 mx-auto flex max-w-md items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 shadow-lg"
    >
      <Link2 className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1">
        {t('adjusted')}{' '}
        <bdi className="font-mono break-all" dir="auto">{slug}</bdi>
      </p>
      <button
        type="button"
        onClick={() => setSlug(null)}
        aria-label={t('dismiss')}
        className="shrink-0 rounded p-0.5 hover:bg-amber-100"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
