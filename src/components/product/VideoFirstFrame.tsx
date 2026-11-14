'use client';

import { resolveMediaUrl } from '@/lib/media';

/**
 * First frame of an uploaded MP4 that has no poster (the poster capture on
 * upload failed, QA 2026-11-14 #17): instead of a black tile the editor shows
 * the frame at 0.1 s. `preload="metadata"` with the `#t=0.1` media fragment
 * fetches only the header and the first frame; the element is muted, never
 * plays and ignores the pointer (drag / click reach the tile underneath).
 * The caller renders it only for `kind === 'file'` without a poster.
 */
export function VideoFirstFrame({ url, className = '' }: { url: string; className?: string }) {
  if (!url) return null;
  return (
    <video
      src={`${resolveMediaUrl(url)}#t=0.1`}
      preload="metadata"
      muted
      playsInline
      aria-hidden="true"
      tabIndex={-1}
      data-video-first-frame=""
      className={`absolute inset-0 h-full w-full object-cover pointer-events-none ${className}`}
    />
  );
}
