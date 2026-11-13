'use client';

import { useTranslations } from 'next-intl';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ImageIcon, Play, Trash2, Video } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/media';
import { formatVideoDuration, type EditorVideo } from '@/lib/productMedia';

const KIND_LABEL: Record<EditorVideo['kind'], string | null> = {
  file: null,
  youtube: 'YouTube',
  vimeo: 'Vimeo',
};

/**
 * Sortable grid tile of a product video: poster (or a dark tile), Play badge
 * and duration chip. It has no featured star (a video is never featured).
 */
export function VideoTile({ video, onChangePoster, onDelete, posterBusy }: {
  video: EditorVideo;
  onChangePoster: () => void;
  onDelete: () => void;
  posterBusy?: boolean;
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

      {kindLabel && (
        <span className="absolute top-1 inset-s-1 rounded bg-black/60 px-1 text-[8px] font-medium text-white pointer-events-none">
          {kindLabel}
        </span>
      )}
      {duration && (
        <span dir="ltr" className="absolute bottom-1 inset-e-1 rounded bg-black/70 px-1 text-[9px] font-medium tabular-nums text-white pointer-events-none">
          {duration}
        </span>
      )}

      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
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
