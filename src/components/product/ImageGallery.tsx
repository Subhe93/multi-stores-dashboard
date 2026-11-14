'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { resolveMediaUrl } from '@/lib/media';
import { API_ORIGIN } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Upload, Trash2, Loader2, ImageIcon, Star, Plus, Video, Link2, ChevronDown } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { UploadedImage } from '@/lib/useImageUpload';
import {
  MAX_VIDEOS_PER_PRODUCT, mergeMedia, moveMedia, newVideoKey, removeImage, setFeaturedImage, setFeaturedVideo,
  splitMedia, toRelativeUploadUrl, unsetFeaturedVideo, type EditorVideo, type MediaItem,
} from '@/lib/productMedia';
import {
  failureOf, useVideoUpload, videoFeatureFlags, type VideoLinkResult, type VideoUploadConfig,
} from '@/lib/useVideoUpload';
import type { VideoFailure } from '@/lib/uploadError';
import { VideoTile } from './VideoTile';
import { VideoLinkDialog } from './VideoLinkDialog';

type Translator = ReturnType<typeof useTranslations>;

interface ProductImage {
  id: string;
  url: string;
  alt_text?: string;
  is_featured?: boolean;
}

interface ImageGalleryProps<I extends ProductImage> {
  images: I[];
  onChange: (images: I[]) => void;
  onPickAndUpload: (multiple?: boolean) => Promise<UploadedImage[]>;
  /** Picks and uploads a video cover image (poster folder); defaults to onPickAndUpload. */
  onPickPoster?: () => Promise<UploadedImage[]>;
  uploading?: boolean;
  /** Product videos (grid order). Omitted = no video support in this editor. */
  videos?: EditorVideo[];
  onVideosChange?: (videos: EditorVideo[]) => void;
  /** `GET /uploads/video/config`; null hides the add-video menu (older API). */
  videoConfig?: VideoUploadConfig | null;
  token?: string | null;
  /** Media error set by the form on save (e.g. a video without images). */
  mediaError?: string;
}

function SortableImage({ img, onSetFeatured, onDelete, t }: {
  img: ProductImage;
  onSetFeatured: () => void;
  onDelete: () => void;
  t: Translator;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}
      className="relative aspect-square bg-zinc-100 rounded-lg overflow-hidden group border cursor-grab active:cursor-grabbing"
      {...attributes} {...listeners}>
      <img src={resolveMediaUrl(img.url)} alt={img.alt_text || ''} className="w-full h-full object-cover pointer-events-none" />

      {img.is_featured && (
        <div className="absolute top-1 inset-s-1">
          <Badge className="text-[8px] bg-amber-500 hover:bg-amber-500 gap-0.5 px-1 py-0">
            <Star className="w-2.5 h-2.5 fill-current" /> {t('image.featured')}
          </Badge>
        </div>
      )}

      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
        {!img.is_featured && (
          <button onPointerDown={e => e.stopPropagation()} onClick={onSetFeatured}
            className="h-7 w-7 bg-white rounded-md flex items-center justify-center hover:bg-amber-50" title={t('image.setAsFeatured')}>
            <Star className="w-3.5 h-3.5 text-amber-500" />
          </button>
        )}
        <button onPointerDown={e => e.stopPropagation()} onClick={onDelete}
          className="h-7 w-7 bg-white rounded-md flex items-center justify-center hover:bg-red-50" title={t('common.delete')}>
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </button>
      </div>
    </div>
  );
}

/**
 * Product media grid: images and videos sorted together. The featured image
 * is always the first image (the storefront shows it first). On an API that
 * reports `features.featured_video`, one video with a poster may be shown
 * first (index 0); otherwise videos never take index 0.
 */
export function ImageGallery<I extends ProductImage>({
  images, onChange, onPickAndUpload, onPickPoster, uploading = false,
  videos, onVideosChange, videoConfig = null, token = null, mediaError,
}: ImageGalleryProps<I>) {
  const t = useTranslations();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const videoList = videos ?? [];
  // Async handlers (uploads) read the latest arrays, not the ones of the render that started them.
  const latest = useRef({ images, videos: videoList });
  latest.current = { images, videos: videoList };

  const video = useVideoUpload(token, videoConfig);
  const [videoError, setVideoError] = useState('');
  const [videoNotice, setVideoNotice] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [posterBusyId, setPosterBusyId] = useState<string | null>(null);

  const videoUi = !!videoConfig && !!onVideosChange;
  const maxVideos = videoConfig?.max_videos_per_product || MAX_VIDEOS_PER_PRODUCT;
  const atVideoLimit = videoList.length >= maxVideos;
  const { allowFeaturedVideo, allowAutoplay } = videoFeatureFlags(videoUi ? videoConfig : null);
  const mediaOpts = { allowFeaturedVideo };
  const media = mergeMedia(images, videoList, mediaOpts);
  const hasFeaturedVideo = allowFeaturedVideo && media[0]?.type === 'video';

  const describe = (f: VideoFailure): string =>
    t.has(f.key) ? t(f.key, f.values) : (f.message || t('errors.generic'));

  const commit = (items: MediaItem<I>[]) => {
    const next = splitMedia(items, mediaOpts);
    onChange(next.images);
    onVideosChange?.(next.videos);
  };

  const handleUpload = async (multiple = true) => {
    const uploaded = await onPickAndUpload(multiple);
    if (uploaded.length === 0) return;
    const { images: cur, videos: curVideos } = latest.current;
    const added: MediaItem<I>[] = uploaded.map(img => ({
      type: 'image',
      id: img.id,
      image: { id: img.id, url: img.url, is_featured: false } as I,
    }));
    // The first image of the grid becomes the featured one (splitMedia).
    commit([...mergeMedia(cur, curVideos, mediaOpts), ...added]);
  };

  const handleDelete = (id: string) => {
    const next = removeImage(images, videoList, id, mediaOpts);
    onChange(next.images);
    onVideosChange?.(next.videos);
  };

  const handleSetFeatured = (id: string) => {
    onChange(setFeaturedImage(images, id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const next = moveMedia(media, String(active.id), String(over.id), mediaOpts);
    const moved = media.find(it => it.id === active.id);
    const movedVideoToFront = moved?.type === 'video' && media[0]?.id === over.id;
    // A video dropped at index 0 becomes the featured video when it has a
    // poster (new API); otherwise it snaps behind the first image.
    setVideoNotice(
      !movedVideoToFront ? ''
        : !allowFeaturedVideo ? t('image.videoCannotBeFeatured')
          : moved.video.poster_url ? '' : t('image.featuredVideoNeedsPoster'),
    );
    commit(next);
  };

  const handleSetFeaturedVideo = (id: string) => {
    setVideoNotice('');
    commit(setFeaturedVideo(media, id));
  };

  const handleUnsetFeaturedVideo = (id: string) => {
    setVideoNotice('');
    commit(unsetFeaturedVideo(media, id));
  };

  const appendVideo = (v: Omit<EditorVideo, 'id' | 'position' | 'autoplay' | 'loop'>) => {
    const { images: cur, videos: curVideos } = latest.current;
    const item: EditorVideo = { ...v, id: newVideoKey(), position: Math.max(1, cur.length), autoplay: false, loop: false };
    commit([...mergeMedia(cur, curVideos, mediaOpts), { type: 'video', id: item.id, video: item }]);
  };

  const handleUploadVideo = async () => {
    if (atVideoLimit || video.busy) return;
    setVideoError('');
    setVideoNotice('');
    const file = await video.pickVideo();
    if (!file) return;
    try {
      const up = await video.uploadVideo(file);
      if (latest.current.videos.length >= maxVideos) {
        setVideoError(t('image.videoLimitReached', { max: maxVideos }));
        return;
      }
      appendVideo({
        kind: 'file', url: up.url, poster_url: up.poster_url, alt: '',
        duration_s: up.duration_s, width: up.width, height: up.height,
      });
      if (up.posterFailed) setVideoNotice(t('image.posterFailed'));
    } catch (err) {
      setVideoError(describe(failureOf(err)));
    }
  };

  const handleAddLink = (link: VideoLinkResult) => {
    if (latest.current.videos.length >= maxVideos) {
      setVideoError(t('image.videoLimitReached', { max: maxVideos }));
      return;
    }
    setVideoError('');
    appendVideo({
      kind: link.kind, url: link.url, poster_url: link.poster_url, alt: '',
      duration_s: null, width: null, height: null,
    });
  };

  const updateVideo = (id: string, patch: Partial<EditorVideo>) => {
    onVideosChange?.(latest.current.videos.map(v => (v.id === id ? { ...v, ...patch } : v)));
  };

  const handleChangePoster = async (id: string) => {
    setPosterBusyId(id);
    try {
      const [img] = await (onPickPoster ? onPickPoster() : onPickAndUpload(false));
      if (img) updateVideo(id, { poster_url: toRelativeUploadUrl(img.url, API_ORIGIN) });
    } finally {
      setPosterBusyId(null);
    }
  };

  const handleDeleteVideo = (id: string) => {
    setVideoNotice('');
    onVideosChange?.(latest.current.videos.filter(v => v.id !== id));
  };

  const phase = video.state;
  const progressLabel =
    phase.phase === 'uploading' ? t('image.uploadingProgress', { percent: phase.percent })
      : phase.phase === 'poster' ? t('image.generatingPoster')
        : phase.phase === 'checking' ? t('image.uploadingProgress', { percent: 0 })
          : '';
  const progressPercent = phase.phase === 'uploading' ? phase.percent : phase.phase === 'poster' ? 100 : 0;

  const addMenu = videoUi ? (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2.5 text-xs font-medium shadow-xs hover:bg-accent disabled:opacity-50"
        disabled={uploading || video.busy}
      >
        {uploading || video.busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        {t('image.addMedia')}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onClick={() => void handleUpload(true)}>
          <Upload /> {t('image.uploadImages')}
        </DropdownMenuItem>
        {videoConfig?.uploads_enabled && (
          <DropdownMenuItem disabled={atVideoLimit} onClick={() => void handleUploadVideo()}>
            <Video /> {t('image.uploadVideo')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem disabled={atVideoLimit} onClick={() => { setVideoError(''); setLinkOpen(true); }}>
          <Link2 /> {t('image.addVideoLink')}
        </DropdownMenuItem>
        {atVideoLimit && (
          <p className="px-2 py-1 text-[10px] text-muted-foreground">{t('image.videoLimitReached', { max: maxVideos })}</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleUpload(true)} disabled={uploading}>
      {uploading ? <Loader2 className="w-3 h-3 me-1 animate-spin" /> : <Upload className="w-3 h-3 me-1" />}
      {t('image.uploadImages')}
    </Button>
  );

  const showVideoWithoutImage = videoList.length > 0 && images.length === 0;

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">{t('image.media')}</CardTitle>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {t('image.mediaHint', { count: images.length })} · {t('image.ratioHint')}
            </p>
            {videoUi && videoConfig?.uploads_enabled && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{t('image.videoUploadHint')}</p>
            )}
          </div>
          {addMenu}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {media.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={media.map(it => it.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-5 gap-2">
                {media.map(it => it.type === 'image' ? (
                  <SortableImage
                    key={it.id}
                    img={it.image}
                    onSetFeatured={() => handleSetFeatured(it.id)}
                    onDelete={() => handleDelete(it.id)}
                    t={t}
                  />
                ) : (
                  <VideoTile
                    key={it.id}
                    video={it.video}
                    posterBusy={posterBusyId === it.id || uploading}
                    onChangePoster={() => void handleChangePoster(it.id)}
                    onDelete={() => handleDeleteVideo(it.id)}
                    allowFeatured={allowFeaturedVideo && images.length > 0}
                    featured={allowFeaturedVideo && media[0]?.id === it.id}
                    onSetFeatured={() => handleSetFeaturedVideo(it.id)}
                    onUnsetFeatured={() => handleUnsetFeaturedVideo(it.id)}
                  />
                ))}

                {video.busy && (
                  <div className="aspect-square rounded-lg border bg-zinc-50 flex flex-col items-center justify-center gap-1.5 px-2" aria-live="polite">
                    <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                    <div className="h-1 w-full overflow-hidden rounded bg-zinc-200">
                      <div className="h-full bg-zinc-600 transition-all" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <span className="text-[9px] text-muted-foreground text-center">{progressLabel}</span>
                  </div>
                )}

                <button onClick={() => handleUpload(true)} disabled={uploading}
                  className="aspect-square border-2 border-dashed border-zinc-200 rounded-lg flex flex-col items-center justify-center hover:border-zinc-300 transition disabled:opacity-50">
                  {uploading ? <Loader2 className="w-5 h-5 text-zinc-300 animate-spin" /> : (
                    <>
                      <Upload className="w-5 h-5 text-zinc-300 mb-1" />
                      <span className="text-[9px] text-muted-foreground">{t('common.add')}</span>
                    </>
                  )}
                </button>
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <button onClick={() => handleUpload(true)} disabled={uploading}
            className="w-full border-2 border-dashed border-zinc-200 rounded-lg p-10 text-center hover:border-zinc-300 transition disabled:opacity-50">
            {uploading ? (
              <Loader2 className="w-8 h-8 text-zinc-300 mx-auto mb-2 animate-spin" />
            ) : (
              <ImageIcon className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
            )}
            <p className="text-sm font-medium text-muted-foreground">{t('image.dropOrClick')}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{t('image.uploadHint')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t('image.ratioHint')}</p>
          </button>
        )}

        {media.length === 0 && video.busy && (
          <div className="space-y-1" aria-live="polite">
            <div className="h-1 w-full overflow-hidden rounded bg-zinc-200">
              <div className="h-full bg-zinc-600 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground">{progressLabel}</p>
          </div>
        )}

        {hasFeaturedVideo && (
          <p className="text-[10px] text-muted-foreground">{t('image.featuredVideoHint')}</p>
        )}

        {/* Alt text (and autoplay options) per video, kept out of the square tiles. */}
        {videoList.length > 0 && onVideosChange && (
          <div className="space-y-1.5">
            {videoList.map((v, i) => (
              <div key={v.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Video className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="w-5 shrink-0 text-[10px] text-muted-foreground tabular-nums" dir="ltr">{i + 1}</span>
                  <Input
                    className="h-7 text-xs"
                    value={v.alt}
                    maxLength={300}
                    placeholder={t('image.videoAlt')}
                    aria-label={t('image.videoAlt')}
                    onChange={e => updateVideo(v.id, { alt: e.target.value })}
                  />
                </div>
                {allowAutoplay && videoUi && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 ps-9">
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px]">
                      <input
                        type="checkbox"
                        className="rounded accent-primary"
                        checked={v.autoplay}
                        onChange={e => updateVideo(v.id, e.target.checked ? { autoplay: true } : { autoplay: false, loop: false })}
                      />
                      {t('image.videoAutoplay')}
                    </label>
                    <label className={`flex items-center gap-1.5 text-[11px] ${v.autoplay ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                      <input
                        type="checkbox"
                        className="rounded accent-primary"
                        checked={v.autoplay && v.loop}
                        disabled={!v.autoplay}
                        onChange={e => updateVideo(v.id, { loop: e.target.checked })}
                      />
                      {t('image.videoLoop')}
                    </label>
                  </div>
                )}
              </div>
            ))}
            {allowAutoplay && videoUi && (
              <p className="ps-9 text-[10px] leading-relaxed text-muted-foreground">{t('image.videoAutoplayHelp')}</p>
            )}
          </div>
        )}

        {(mediaError || showVideoWithoutImage) && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {mediaError || t('image.videoRequiresImage')}
          </p>
        )}
        {videoError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{videoError}</p>
        )}
        {videoNotice && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{videoNotice}</p>
        )}
      </CardContent>

      {videoUi && (
        <VideoLinkDialog
          open={linkOpen}
          onOpenChange={setLinkOpen}
          resolveLink={video.addVideoLink}
          describeError={err => describe(failureOf(err))}
          onAdd={handleAddLink}
        />
      )}
    </Card>
  );
}
