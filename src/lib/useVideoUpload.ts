'use client';

import { useCallback, useRef, useState } from 'react';
import { API_ORIGIN, API_URL, ApiError, api, authFetch, refreshAccessToken } from '@/lib/api';
import {
  checkVideoFile, checkVideoMetadata, DEFAULT_VIDEO_LIMITS, mapVideoUploadFailure, posterSeekTime,
  type VideoFailure, type VideoUploadLimits,
} from '@/lib/uploadError';
import { toRelativeUploadUrl, type ProductVideoKind } from '@/lib/productMedia';

/** `GET /uploads/video/config` (CONTRACT.md 4.2). */
export interface VideoUploadConfig extends VideoUploadLimits {
  uploads_enabled: boolean;
  max_kbps: number;
  max_videos_per_product: number;
  accept: string[];
  quota_bytes: number | null;
  used_bytes: number;
  /**
   * What the API accepts in a product save (CONTRACT-AUTOPLAY.md 2 / 4.1).
   * Absent on an older API: the editor never sends `position: 0`, `autoplay`
   * or `loop` then.
   */
  features?: { featured_video?: boolean; autoplay?: boolean };
}

/** Feature flags of a video config (both false when the API does not report them). */
export function videoFeatureFlags(config: VideoUploadConfig | null | undefined): {
  allowFeaturedVideo: boolean;
  allowAutoplay: boolean;
} {
  return {
    allowFeaturedVideo: config?.features?.featured_video === true,
    allowAutoplay: config?.features?.autoplay === true,
  };
}

/**
 * Video config of the API, or null when the API has no video routes (404 on
 * an older API) or the request failed: the editor then hides the video menu.
 */
export async function fetchVideoConfig(token: string): Promise<VideoUploadConfig | null> {
  try {
    const cfg = await api<Partial<VideoUploadConfig>>('/uploads/video/config', { token });
    if (!cfg || typeof cfg !== 'object') return null;
    const num = (v: unknown, fallback: number) => (typeof v === 'number' && v > 0 ? v : fallback);
    return {
      uploads_enabled: cfg.uploads_enabled !== false,
      max_bytes: num(cfg.max_bytes, DEFAULT_VIDEO_LIMITS.max_bytes),
      max_duration_s: num(cfg.max_duration_s, DEFAULT_VIDEO_LIMITS.max_duration_s),
      max_kbps: num(cfg.max_kbps, 8000),
      max_videos_per_product: num(cfg.max_videos_per_product, 3),
      accept: Array.isArray(cfg.accept) ? cfg.accept : ['video/mp4'],
      quota_bytes: typeof cfg.quota_bytes === 'number' ? cfg.quota_bytes : null,
      used_bytes: typeof cfg.used_bytes === 'number' ? cfg.used_bytes : 0,
      ...(cfg.features && typeof cfg.features === 'object'
        ? {
            features: {
              featured_video: cfg.features.featured_video === true,
              autoplay: cfg.features.autoplay === true,
            },
          }
        : {}),
    };
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) console.warn('Video config unavailable:', err);
    return null;
  }
}

/** Result of a finished upload (CONTRACT.md section 5, `useVideoUpload` step 6). */
export interface UploadedVideo {
  url: string;
  poster_url: string | null;
  duration_s: number | null;
  width: number | null;
  height: number | null;
  /** True when the poster frame could not be captured or stored. */
  posterFailed: boolean;
}

/** Result of `POST /uploads/video-link`. */
export interface VideoLinkResult {
  kind: Exclude<ProductVideoKind, 'file'>;
  url: string;
  external_id: string;
  poster_url: string | null;
}

export type VideoUploadPhase =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'uploading'; percent: number }
  | { phase: 'poster' };

class VideoUploadError extends Error {
  readonly failure: VideoFailure;
  constructor(failure: VideoFailure) {
    super(failure.message || failure.key);
    this.failure = failure;
  }
}

const METADATA_TIMEOUT_MS = 15_000;

/**
 * Reads duration and size through a hidden `<video>` and grabs the poster
 * frame. Resolves `poster: null` when only the frame capture fails.
 */
function readVideo(file: File): Promise<{ duration: number; width: number; height: number; poster: Blob | null }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    let settled = false;
    let meta: { duration: number; width: number; height: number } | null = null;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      fn();
    };
    const timer = setTimeout(() => {
      // Metadata never arrived: the browser cannot read the file.
      if (!meta) done(() => reject(new Error('metadata timeout')));
      else { const m = meta; done(() => resolve({ ...m, poster: null })); }
    }, METADATA_TIMEOUT_MS);
    video.onerror = () => {
      if (!meta) done(() => reject(new Error('decode error')));
      else { const m = meta; done(() => resolve({ ...m, poster: null })); }
    };
    video.onloadedmetadata = () => {
      meta = { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
      if (!(meta.width > 0)) { const m = meta; done(() => resolve({ ...m, poster: null })); return; }
      video.currentTime = posterSeekTime(meta.duration);
    };
    video.onseeked = () => {
      const m = meta!;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = m.width;
        canvas.height = m.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { done(() => resolve({ ...m, poster: null })); return; }
        ctx.drawImage(video, 0, 0, m.width, m.height);
        canvas.toBlob(blob => done(() => resolve({ ...m, poster: blob })), 'image/jpeg', 0.9);
      } catch {
        done(() => resolve({ ...m, poster: null }));
      }
    };
    video.src = url;
  });
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** One multipart POST by XHR so the progress can be shown. */
function xhrUpload(
  url: string,
  token: string,
  body: FormData,
  onProgress: (percent: number) => void,
): Promise<{ status: number; json: Record<string, unknown> | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => resolve({ status: xhr.status, json: parseJson(xhr.responseText) });
    xhr.onerror = () => reject(new Error('network error'));
    xhr.onabort = () => reject(new Error('aborted'));
    xhr.send(body);
  });
}

/** Unwraps the API's `{ data }` envelope (or a bare body). */
function payload(json: Record<string, unknown> | null): Record<string, unknown> | null {
  const data = json?.data;
  if (data && typeof data === 'object') return data as Record<string, unknown>;
  return json;
}

function intOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : null;
}

/**
 * Product video upload: client pre-checks (MP4 name/type, size, duration,
 * decodable picture), XHR upload with progress to `POST /uploads/video`,
 * then the captured poster frame through the image route.
 */
export function useVideoUpload(token: string | null, limits: VideoUploadLimits | null) {
  const [state, setState] = useState<VideoUploadPhase>({ phase: 'idle' });
  const busyRef = useRef(false);
  const effective = limits ?? DEFAULT_VIDEO_LIMITS;

  const uploadPoster = useCallback(async (blob: Blob, accessToken: string): Promise<string | null> => {
    try {
      const form = new FormData();
      form.append('file', new File([blob], 'poster.jpg', { type: 'image/jpeg' }));
      // The poster folder: the API's orphan sweep reclaims unused covers.
      const res = await authFetch(`${API_URL}/uploads?folder=video-posters`, accessToken, { method: 'POST', body: form });
      const json = payload(parseJson(await res.text()));
      const url = typeof json?.url === 'string' ? json.url : null;
      return res.ok && url ? toRelativeUploadUrl(url, API_ORIGIN) : null;
    } catch {
      return null;
    }
  }, []);

  /** Uploads one file. Throws a `VideoFailure` (via `failureOf`) on any refusal. */
  const uploadVideo = useCallback(async (file: File): Promise<UploadedVideo> => {
    if (!token) throw new VideoUploadError({ key: 'errors.generic' });
    if (busyRef.current) throw new VideoUploadError({ key: 'errors.generic' });
    busyRef.current = true;
    try {
      setState({ phase: 'checking' });
      const fileProblem = checkVideoFile(file, effective);
      if (fileProblem) throw new VideoUploadError(fileProblem);

      let local: Awaited<ReturnType<typeof readVideo>>;
      try {
        local = await readVideo(file);
      } catch {
        throw new VideoUploadError({ key: 'image.videoUnsupportedFormat' });
      }
      const metaProblem = checkVideoMetadata({ duration: local.duration, videoWidth: local.width }, effective);
      if (metaProblem) throw new VideoUploadError(metaProblem);

      setState({ phase: 'uploading', percent: 0 });
      const send = (accessToken: string) => {
        const form = new FormData();
        form.append('file', file);
        return xhrUpload(
          `${API_URL}/uploads/video?folder=products`,
          accessToken,
          form,
          percent => setState({ phase: 'uploading', percent }),
        );
      };
      let accessToken = token;
      let res: Awaited<ReturnType<typeof xhrUpload>>;
      try {
        res = await send(accessToken);
        if (res.status === 401) {
          const fresh = await refreshAccessToken();
          if (fresh) {
            accessToken = fresh;
            setState({ phase: 'uploading', percent: 0 });
            res = await send(accessToken);
          }
        }
      } catch {
        throw new VideoUploadError({ key: 'errors.generic' });
      }
      const data = payload(res.json);
      const url = typeof data?.url === 'string' ? data.url : null;
      if (res.status < 200 || res.status >= 300 || !url) {
        throw new VideoUploadError(mapVideoUploadFailure(res.status, res.json, effective));
      }

      setState({ phase: 'poster' });
      const posterUrl = local.poster ? await uploadPoster(local.poster, accessToken) : null;
      return {
        url: toRelativeUploadUrl(url, API_ORIGIN),
        poster_url: posterUrl,
        duration_s: intOrNull(data?.duration_s) ?? intOrNull(local.duration),
        width: intOrNull(data?.width) ?? intOrNull(local.width),
        height: intOrNull(data?.height) ?? intOrNull(local.height),
        posterFailed: posterUrl === null,
      };
    } finally {
      busyRef.current = false;
      setState({ phase: 'idle' });
    }
  }, [token, effective, uploadPoster]);

  /** Opens the file picker (MP4 only); resolves null when nothing was picked. */
  const pickVideo = useCallback((): Promise<File | null> => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/mp4,.mp4';
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.oncancel = () => resolve(null);
      input.click();
    });
  }, []);

  /** `POST /uploads/video-link`: canonical URL + stored poster (or null). */
  const addVideoLink = useCallback(async (rawUrl: string): Promise<VideoLinkResult> => {
    if (!token) throw new VideoUploadError({ key: 'errors.generic' });
    try {
      const res = await api<VideoLinkResult>('/uploads/video-link', {
        method: 'POST',
        token,
        body: JSON.stringify({ url: rawUrl.trim() }),
      });
      return {
        ...res,
        poster_url: res.poster_url ? toRelativeUploadUrl(res.poster_url, API_ORIGIN) : null,
      };
    } catch (err) {
      if (err instanceof ApiError) {
        throw new VideoUploadError(mapVideoUploadFailure(err.status ?? 0, err.payload, effective));
      }
      throw new VideoUploadError({ key: 'errors.generic' });
    }
  }, [token, effective]);

  return { state, busy: state.phase !== 'idle', pickVideo, uploadVideo, addVideoLink };
}

/** The failure of an error thrown by `useVideoUpload`, or a generic one. */
export function failureOf(err: unknown): VideoFailure {
  if (err instanceof VideoUploadError) return err.failure;
  return { key: 'errors.generic' };
}
