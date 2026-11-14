/**
 * Pure helpers of the product editor's mixed media grid (images + videos).
 * No React, no DOM: unit-tested with `node --test`.
 *
 * Model (plans/product-video/CONTRACT.md section 5, extended by
 * CONTRACT-AUTOPLAY.md section 4.2):
 * - The form keeps product-level images and videos in two arrays. A video's
 *   `position` is the number of product-level images shown before it.
 * - The grid shows them merged. The featured image is always the first image
 *   (the storefront orders images featured-first; cart, OG, feeds and mails
 *   use it).
 * - Without `allowFeaturedVideo` (older API) a video can never be first: a
 *   drop at index 0 snaps it to index 1 and positions are >= 1.
 * - With `allowFeaturedVideo` one video with a poster may lead the grid
 *   (`position = 0`, the "featured video"); the first image follows it.
 */

export type ProductVideoKind = 'file' | 'youtube' | 'vimeo';

/** Product video as the API returns it (editor GET). */
export interface ProductVideoOut {
  id: string;
  kind: ProductVideoKind;
  url: string;
  poster_url: string | null;
  duration_s: number | null;
  width: number | null;
  height: number | null;
  /** >= 0; 0 = featured video (first gallery slot). */
  position: number;
  alt: string | null;
  /** Muted autoplay; absent on an older API. */
  autoplay?: boolean;
  /** Loop while autoplaying; absent on an older API. */
  loop?: boolean;
  created_at?: string;
}

export interface EditorImage {
  id: string;
  url: string;
  alt_text?: string;
  is_featured?: boolean;
  variant_id?: string | null;
}

/** A video as edited in the form. */
export interface EditorVideo {
  /** Local key for the grid (equals `serverId` for stored rows). */
  id: string;
  /** Stored row id; absent for videos added in this session. */
  serverId?: string;
  kind: ProductVideoKind;
  url: string;
  poster_url: string | null;
  alt: string;
  duration_s: number | null;
  width: number | null;
  height: number | null;
  /** Images before this video; 0 = featured (only with `allowFeaturedVideo`). */
  position: number;
  /** Muted autoplay on the storefront (sent only when the API supports it). */
  autoplay: boolean;
  /** Loop while autoplaying (ignored when `autoplay` is false). */
  loop: boolean;
}

/** Feature flags of `GET /uploads/video/config` (`features`); all false on an older API. */
export interface MediaOptions {
  /** The API accepts `position: 0` (featured video). */
  allowFeaturedVideo?: boolean;
}

export interface VideoPayloadOptions extends MediaOptions {
  /** The API accepts `autoplay` / `loop` on videos. */
  allowAutoplay?: boolean;
}

export type MediaItem<I extends EditorImage = EditorImage> =
  | { type: 'image'; id: string; image: I }
  | { type: 'video'; id: string; video: EditorVideo };

/** Business limit of the API (`VIDEO_LIMIT_EXCEEDED`), files and links together. */
export const MAX_VIDEOS_PER_PRODUCT = 3;

export function newVideoKey(): string {
  return `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Editor state of a stored video row. */
export function videoFromServer(row: ProductVideoOut): EditorVideo {
  return {
    id: row.id,
    serverId: row.id,
    kind: row.kind,
    url: row.url,
    poster_url: row.poster_url ?? null,
    alt: row.alt ?? '',
    duration_s: row.duration_s ?? null,
    width: row.width ?? null,
    height: row.height ?? null,
    // 0 (featured) only arrives from an API that supports it.
    position: typeof row.position === 'number' && Number.isFinite(row.position) ? Math.max(0, Math.floor(row.position)) : 1,
    autoplay: row.autoplay === true,
    loop: row.loop === true,
  };
}

/**
 * Featured image first, and exactly one featured image (the first) when there
 * are images. Other images keep their relative order.
 */
export function featuredFirst<I extends EditorImage>(images: readonly I[]): I[] {
  if (images.length === 0) return [];
  const idx = images.findIndex(img => img.is_featured);
  const ordered = idx > 0 ? [images[idx]!, ...images.slice(0, idx), ...images.slice(idx + 1)] : [...images];
  return ordered.map((img, i) => (!!img.is_featured === (i === 0) ? img : { ...img, is_featured: i === 0 }));
}

/**
 * Grid order: images in their order, each video after `position` images
 * (clamped to 1..images.length). Videos at the same position keep their
 * array order. Without images, videos simply follow. With
 * `allowFeaturedVideo`, a video with `position === 0` goes before the first
 * image.
 */
export function mergeMedia<I extends EditorImage>(
  images: readonly I[],
  videos: readonly EditorVideo[],
  opts: MediaOptions = {},
): MediaItem<I>[] {
  const buckets = new Map<number, EditorVideo[]>();
  for (const v of videos) {
    const at = images.length === 0
      ? 0
      : opts.allowFeaturedVideo && v.position === 0
        ? 0
        : Math.min(Math.max(1, Math.floor(v.position || 1)), images.length);
    const list = buckets.get(at) ?? [];
    list.push(v);
    buckets.set(at, list);
  }
  const out: MediaItem<I>[] = [];
  const pushVideos = (at: number) => {
    for (const v of buckets.get(at) ?? []) out.push({ type: 'video', id: v.id, video: v });
  };
  pushVideos(0);
  images.forEach((img, i) => {
    out.push({ type: 'image', id: img.id, image: img });
    pushVideos(i + 1);
  });
  return out;
}

/**
 * Enforces the grid rules on an arbitrary order. Without
 * `allowFeaturedVideo`: when a video is first and an image exists, the first
 * image moves to index 0 (so a video dropped at 0 ends up at 1). With it: of
 * the videos before the first image only one stays in front (the first one
 * that has a poster; a featured video needs one), the others move right after
 * the first image.
 */
export function normalizeMediaOrder<I extends EditorImage>(
  items: readonly MediaItem<I>[],
  opts: MediaOptions = {},
): MediaItem<I>[] {
  if (items.length === 0 || items[0]!.type === 'image') return [...items];
  const firstImage = items.findIndex(it => it.type === 'image');
  if (firstImage < 0) return [...items];
  if (!opts.allowFeaturedVideo) {
    return [items[firstImage]!, ...items.slice(0, firstImage), ...items.slice(firstImage + 1)];
  }
  const leading = items.slice(0, firstImage);
  const keep = leading.find(it => it.type === 'video' && !!it.video.poster_url);
  const moved = leading.filter(it => it !== keep);
  return [...(keep ? [keep] : []), items[firstImage]!, ...moved, ...items.slice(firstImage + 1)];
}

/**
 * Back from grid order to the form arrays: the first image is the featured
 * one, and each video's position is the number of images before it (>= 1).
 * With `allowFeaturedVideo`, the video kept in front of the first image gets
 * position 0 (featured).
 */
export function splitMedia<I extends EditorImage>(
  items: readonly MediaItem<I>[],
  opts: MediaOptions = {},
): { images: I[]; videos: EditorVideo[] } {
  const ordered = normalizeMediaOrder(items, opts);
  const hasImage = ordered.some(it => it.type === 'image');
  const images: I[] = [];
  const videos: EditorVideo[] = [];
  let featuredTaken = false;
  for (const it of ordered) {
    if (it.type === 'image') {
      const featured = images.length === 0;
      images.push(!!it.image.is_featured === featured ? it.image : { ...it.image, is_featured: featured });
    } else {
      const featuredVideo =
        !!opts.allowFeaturedVideo && hasImage && images.length === 0 && !featuredTaken && !!it.video.poster_url;
      if (featuredVideo) featuredTaken = true;
      const position = featuredVideo ? 0 : Math.max(1, images.length);
      videos.push(it.video.position === position ? it.video : { ...it.video, position });
    }
  }
  return { images, videos };
}

/** Moves one grid item onto another's index, then re-applies the grid rules. */
export function moveMedia<I extends EditorImage>(
  items: readonly MediaItem<I>[],
  activeId: string,
  overId: string,
  opts: MediaOptions = {},
): MediaItem<I>[] {
  const from = items.findIndex(it => it.id === activeId);
  const to = items.findIndex(it => it.id === overId);
  if (from < 0 || to < 0 || from === to) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return normalizeMediaOrder(next, opts);
}

/**
 * "Show first": moves a video to index 0 as the featured video. A video
 * without a poster cannot lead, so it ends up right after the first image.
 */
export function setFeaturedVideo<I extends EditorImage>(items: readonly MediaItem<I>[], id: string): MediaItem<I>[] {
  const idx = items.findIndex(it => it.id === id && it.type === 'video');
  if (idx < 0) return [...items];
  const next = [items[idx]!, ...items.slice(0, idx), ...items.slice(idx + 1)];
  return normalizeMediaOrder(next, { allowFeaturedVideo: true });
}

/** "Don't show first": moves a video right after the first image. */
export function unsetFeaturedVideo<I extends EditorImage>(items: readonly MediaItem<I>[], id: string): MediaItem<I>[] {
  const item = items.find(it => it.id === id && it.type === 'video');
  if (!item) return [...items];
  const rest = items.filter(it => it !== item);
  const firstImage = rest.findIndex(it => it.type === 'image');
  if (firstImage < 0) return [...items];
  const next = [...rest.slice(0, firstImage + 1), item, ...rest.slice(firstImage + 1)];
  return normalizeMediaOrder(next, { allowFeaturedVideo: true });
}

/** A featured video (position 0) without a poster: blocks the save (`VIDEO_FEATURED_REQUIRES_POSTER`). */
export function featuredVideoMissingPoster(videos: readonly EditorVideo[], opts: MediaOptions = {}): boolean {
  return !!opts.allowFeaturedVideo && videos.some(v => v.position === 0 && !v.poster_url);
}

/** Stars an image: it becomes the featured one and moves to the front. */
export function setFeaturedImage<I extends EditorImage>(images: readonly I[], id: string): I[] {
  return featuredFirst(images.map(img => ({ ...img, is_featured: img.id === id })));
}

/** Removes an image; the new first image becomes featured. Videos are re-clamped. */
export function removeImage<I extends EditorImage>(
  images: readonly I[],
  videos: readonly EditorVideo[],
  id: string,
  opts: MediaOptions = {},
): { images: I[]; videos: EditorVideo[] } {
  const merged = mergeMedia(images, videos, opts).filter(it => it.id !== id);
  return splitMedia(merged, opts);
}

/**
 * Save payload of the videos (grid order; `id` only for stored rows).
 * `position: 0` only with `allowFeaturedVideo`; `autoplay` / `loop` only with
 * `allowAutoplay` (an older API rejects unknown keys).
 */
export function videosPayload(videos: readonly EditorVideo[], opts: VideoPayloadOptions = {}) {
  return videos.map(v => ({
    ...(v.serverId ? { id: v.serverId } : {}),
    kind: v.kind,
    url: v.url,
    poster_url: v.poster_url || null,
    alt: v.alt.trim() || null,
    duration_s: v.duration_s ?? null,
    width: v.width ?? null,
    height: v.height ?? null,
    position: opts.allowFeaturedVideo ? Math.max(0, v.position) : Math.max(1, v.position),
    ...(opts.allowAutoplay ? { autoplay: !!v.autoplay, loop: !!v.autoplay && !!v.loop } : {}),
  }));
}

/**
 * Comparison key of the editor's videos: what a save would change (no row
 * ids, so adopting the stored ids after a save is not a change). Pass the same
 * flags as the save payload.
 */
export function videosKey(videos: readonly EditorVideo[], opts: VideoPayloadOptions = {}): string {
  return JSON.stringify(
    videosPayload(videos, opts).map(({ id: _id, ...rest }) => rest), // eslint-disable-line @typescript-eslint/no-unused-vars
  );
}

/**
 * Whether a save sends `videos`. Edit: only when the GET returned a `videos`
 * array (an API that knows videos) AND the videos changed since they were
 * loaded or last saved, so an unrelated edit never rewrites the rows.
 * Create: only when videos were added. Otherwise the key is left out, so the
 * stored rows are untouched.
 */
export function shouldSendVideos(opts: {
  mode: 'create' | 'edit';
  serverHasVideos: boolean;
  videoCount: number;
  /** Edit mode: the videos differ from the loaded / last saved ones. */
  changed?: boolean;
}): boolean {
  return opts.mode === 'edit' ? opts.serverHasVideos && opts.changed !== false : opts.videoCount > 0;
}

/** A save with videos needs at least one product-level image (`VIDEO_REQUIRES_IMAGE`). */
export function videosNeedImage(imageCount: number, videoCount: number): boolean {
  return videoCount > 0 && imageCount === 0;
}

/** `https://<api origin>/uploads/...` → `/uploads/...`; other values unchanged. */
export function toRelativeUploadUrl(url: string, apiOrigin: string): string {
  const origin = apiOrigin.replace(/\/+$/, '');
  if (origin && url.startsWith(`${origin}/uploads/`)) return url.slice(origin.length);
  return url;
}

/** `m:ss` for the duration chip. */
export function formatVideoDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
