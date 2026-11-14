'use client';

import { useTranslations } from 'next-intl';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ImageIcon, Play, Star, StarOff, Trash2, Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { resolveMediaUrl } from '@/lib/media';
import { formatVideoDuration, type EditorVideo } from '@/lib/productMedia';

const KIND_LABEL: Record<EditorVideo['kind'], string | null> = {
  file: null,
  youtube: 'YouTube',
  vimeo: 'Vimeo',
};

/**
 * Sortable grid tile of a product video: poster (or a dark tile), Play badge
 * and duration chip. With `allowFeatured` (API reports
 * `features.featured_video`) a star shows the video first in the gallery; it
 * needs a poster.
 */
export function VideoTile({
  video, onChangePoster, onDelete, posterBusy, allowFeatured = false, featured = false, onSetFeatured, onUnsetFeatured,
}: {
  video: EditorVideo;
  onChangePoster: () => void;
  onDelete: () => void;
  posterBusy?: boolean;
  /** The featured-video actions are available. */
  allowFeatured?: boolean;
  /** This video is shown first (grid index 0). */
  featured?: boolean;
  onSetFeatured?: () => void;
  onUnsetFeatured?: () => void;
}) {
  const t = useTranslations();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: video.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.7 : 1,
  };
  const duration = formatVideoDuration(video.duration_s);
  const kindLabel = KIND_LABEL[video.kind];
  const canFeature = !!video.poster_url;
  const starTitle = canFeature ? t('image.setFeaturedVideo') : t('image.featuredVideoNeedsPoster');

  return (
    <div ref={setNodeRef} style={style}
      className="relative aspect-square bg-zinc-900 rounded-lg overflow-hidden group border cursor-grab active:cursor-grabbing"
      title={video.alt || t('image.videoPlay')}
      {...attributes} {...listeners}>
      {video.poster_url ? (
        <img src={resolveMediaUrl(video.poster_url)} alt={video.alt || ''} className="w-full h-full object-cover pointer-events-none" />
      ) : (
        <Video className="absolute inset-0 m-auto w-6 h-6 text-zinc-500 pointer-events-none" />
      )}

      {/* Play badge */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="h-8 w-8 rounded-full bg-black/60 flex items-center justify-center" aria-hidden="true">
          <Play className="w-3.5 h-3.5 text-white fill-white ms-0.5" />
        </span>
      </div>

      {(featured || kindLabel) && (
        <div className="absolute top-1 inset-s-1 flex flex-wrap items-center gap-0.5 pointer-events-none">
          {featured && (
            <Badge className="text-[8px] bg-amber-500 hover:bg-amber-500 gap-0.5 px-1 py-0">
              <Star className="w-2.5 h-2.5 fill-current" /> {t('image.featuredVideo')}
            </Badge>
          )}
          {kindLabel && (
            <span className="rounded bg-black/60 px-1 text-[8px] font-medium text-white">
              {kindLabel}
            </span>
          )}
        </div>
      )}
      {duration && (
        <span dir="ltr" className="absolute bottom-1 inset-e-1 rounded bg-black/70 px-1 text-[9px] font-medium tabular-nums text-white pointer-events-none">
          {duration}
        </span>
      )}

      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
        {allowFeatured && !featured && (
          // Disabled buttons swallow hover titles, so the help sits on a wrapper.
          <span title={starTitle} className="inline-flex">
            <button type="button" onPointerDown={e => e.stopPropagation()} onClick={onSetFeatured} disabled={!canFeature}
              className="h-7 w-7 bg-white rounded-md flex items-center justify-center hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={starTitle}>
              <Star className="w-3.5 h-3.5 text-amber-500" />
            </button>
          </span>
        )}
        {allowFeatured && featured && (
          <button type="button" onPointerDown={e => e.stopPropagation()} onClick={onUnsetFeatured}
            className="h-7 w-7 bg-white rounded-md flex items-center justify-center hover:bg-amber-50"
            title={t('image.unsetFeaturedVideo')} aria-label={t('image.unsetFeaturedVideo')}>
            <StarOff className="w-3.5 h-3.5 text-amber-600" />
          </button>
        )}
        <button type="button" onPointerDown={e => e.stopPropagation()} onClick={onChangePoster} disabled={posterBusy}
          className="h-7 w-7 bg-white rounded-md flex items-center justify-center hover:bg-zinc-50 disabled:opacity-50"
          title={t('image.changePoster')} aria-label={t('image.changePoster')}>
          <ImageIcon className="w-3.5 h-3.5 text-zinc-700" />
        </button>
        <button type="button" onPointerDown={e => e.stopPropagation()} onClick={onDelete}
          className="h-7 w-7 bg-white rounded-md flex items-center justify-center hover:bg-red-50"
          title={t('image.removeVideo')} aria-label={t('image.removeVideo')}>
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </button>
      </div>
    </div>
  );
}
