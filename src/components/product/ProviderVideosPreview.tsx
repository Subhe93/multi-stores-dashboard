'use client';

import { useTranslations } from 'next-intl';
import { Play, Video } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/media';
import { formatVideoDuration } from '@/lib/productMedia';

/**
 * A provider base product's video as an API read returns it: mapped
 * (`kind: 'file'`, `alt`) or a raw row (`kind: 'FILE'`, `alt_text`).
 */
export interface ProviderVideoLike {
  id: string;
  kind: string;
  url: string;
  poster_url?: string | null;
  alt?: string | null;
  alt_text?: string | null;
  duration_s?: number | null;
}

/**
 * Read-only list of the provider's videos (decision D5): a reselling store
 * shows them on the product page, so the creator sees which ones. Each tile
 * opens the video in a new tab.
 */
export function ProviderVideosPreview({ videos }: { videos?: ProviderVideoLike[] | null }) {
  const t = useTranslations('creator.productDetail');
  if (!videos?.length) return null;
  return (
    <div className="space-y-2" data-provider-videos="">
      <p className="text-xs font-semibold">{t('providerVideos')}</p>
      <p className="text-[11px] text-muted-foreground">{t('providerVideosHint')}</p>
      <div className="flex flex-wrap gap-2">
        {videos.map((v) => {
          const kind = String(v.kind).toLowerCase();
          const href = kind === 'file' ? resolveMediaUrl(v.url) : v.url;
          const label = v.alt || v.alt_text || '';
          const duration = formatVideoDuration(v.duration_s ?? null);
          return (
            <a
              key={v.id}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={label || t('providerVideos')}
              className="relative block size-18 shrink-0 overflow-hidden rounded-xl border bg-zinc-900"
            >
              {v.poster_url ? (
                <img src={resolveMediaUrl(v.poster_url)} alt={label} className="h-full w-full object-cover" />
              ) : (
                <Video className="absolute inset-0 m-auto size-6 text-zinc-500" aria-hidden="true" />
              )}
              <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                <span className="flex size-7 items-center justify-center rounded-full bg-black/60">
                  <Play className="ms-0.5 size-3 fill-white text-white" />
                </span>
              </span>
              {duration && (
                <span dir="ltr" className="absolute bottom-1 inset-e-1 rounded bg-black/60 px-1 text-[9px] text-white">
                  {duration}
                </span>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
