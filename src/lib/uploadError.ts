/**
 * Maps a failed multipart upload response to the error code the UI translates
 * (`errors.<code>`). Pure so it can be unit-tested without a DOM.
 *
 * nginx answers 413 *before* Node for bodies above `client_max_body_size`
 * (an HTML page, no JSON), and the API answers 413 with a coded JSON body
 * (`UPLOAD_FILE_TOO_LARGE`, `max_bytes`): both become the same code. Other
 * coded API errors keep their code; anything else falls back to the message.
 */
export const UPLOAD_FILE_TOO_LARGE = 'UPLOAD_FILE_TOO_LARGE';

export interface UploadFailure {
  code?: string;
  /** Server message (English), when the body was JSON. */
  message?: string;
  /** Known size cap in whole MB (from the body's `max_bytes`, else the caller's default). */
  maxMb?: number;
  status: number;
}

export function mapUploadFailure(
  status: number,
  json: Record<string, unknown> | null | undefined,
  defaultMaxBytes?: number,
): UploadFailure {
  const code = typeof json?.code === 'string' ? json.code : undefined;
  const rawMsg = json?.message;
  const message = Array.isArray(rawMsg)
    ? rawMsg.join(' · ')
    : typeof rawMsg === 'string'
      ? rawMsg
      : undefined;
  if (status === 413 || code === UPLOAD_FILE_TOO_LARGE) {
    const maxBytes =
      typeof json?.max_bytes === 'number' && json.max_bytes > 0 ? json.max_bytes : defaultMaxBytes;
    return {
      status,
      code: UPLOAD_FILE_TOO_LARGE,
      message,
      maxMb: maxBytes ? Math.round(maxBytes / (1024 * 1024)) : undefined,
    };
  }
  return { status, code, message };
}

// ── Product videos (plans/product-video/CONTRACT.md 4.3, 4.7, 5) ─────────────

/** Video upload limits of `GET /uploads/video/config` (defaults = API defaults). */
export interface VideoUploadLimits {
  max_bytes: number;
  max_duration_s: number;
}

export const DEFAULT_VIDEO_LIMITS: VideoUploadLimits = {
  max_bytes: 50 * 1024 * 1024,
  max_duration_s: 60,
};

/** The API accepts up to `max_duration_s + 0.5` (rounding tolerance). */
const DURATION_TOLERANCE_S = 0.5;

/** Translation key (with `image.` or `errors.` prefix) plus ICU values. */
export interface VideoFailure {
  key: string;
  values?: Record<string, number>;
  /** Server message (English) for codes the UI has no translation for. */
  message?: string;
  status?: number;
}

export function bytesToMb(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}

/** Checks before any byte is sent: `.mp4` name, MP4 type (when given) and size. */
export function checkVideoFile(
  file: { name: string; size: number; type?: string },
  limits: VideoUploadLimits = DEFAULT_VIDEO_LIMITS,
): VideoFailure | null {
  const typeOk = !file.type || file.type === 'video/mp4';
  if (!/\.mp4$/i.test(file.name) || !typeOk) return { key: 'image.videoUnsupportedFormat' };
  if (file.size > limits.max_bytes) {
    return { key: 'image.videoTooLarge', values: { max: bytesToMb(limits.max_bytes) } };
  }
  return null;
}

/**
 * Checks of the browser-decoded metadata. A file the browser cannot decode
 * (HEVC on most desktops, a renamed file) reports no picture: `videoWidth` 0.
 */
export function checkVideoMetadata(
  meta: { duration: number; videoWidth: number },
  limits: VideoUploadLimits = DEFAULT_VIDEO_LIMITS,
): VideoFailure | null {
  if (!(meta.videoWidth > 0) || !Number.isFinite(meta.duration) || meta.duration <= 0) {
    return { key: 'image.videoUnsupportedFormat' };
  }
  if (meta.duration > limits.max_duration_s + DURATION_TOLERANCE_S) {
    return { key: 'image.videoTooLong', values: { max: limits.max_duration_s } };
  }
  return null;
}

/** Poster frame time: 1 s in, or 10 % of a shorter clip. */
export function posterSeekTime(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(1, duration * 0.1);
}

function numberField(json: Record<string, unknown> | null | undefined, ...names: string[]): number | undefined {
  for (const n of names) {
    const v = json?.[n];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  }
  return undefined;
}

/**
 * Maps a failed video upload / video-link response to a translation key.
 * A 413 without JSON comes from nginx (above `client_max_body_size`).
 */
export function mapVideoUploadFailure(
  status: number,
  json: Record<string, unknown> | null | undefined,
  limits: VideoUploadLimits = DEFAULT_VIDEO_LIMITS,
): VideoFailure {
  const base = mapUploadFailure(status, json);
  const code = typeof json?.code === 'string' ? json.code : undefined;
  if (status === 413 || code === 'UPLOAD_VIDEO_TOO_LARGE' || code === UPLOAD_FILE_TOO_LARGE) {
    const maxBytes = numberField(json, 'maxBytes', 'max_bytes') ?? limits.max_bytes;
    return { key: 'image.videoTooLarge', values: { max: bytesToMb(maxBytes) }, status };
  }
  if (code === 'UPLOAD_VIDEO_TOO_LONG') {
    const max = numberField(json, 'maxSeconds') ?? limits.max_duration_s;
    return { key: 'image.videoTooLong', values: { max }, status };
  }
  if (code === 'VIDEO_LIMIT_EXCEEDED') {
    return { key: 'image.videoLimitReached', values: { max: numberField(json, 'max') ?? 3 }, status };
  }
  if (code === 'VIDEO_REQUIRES_IMAGE') return { key: 'image.videoRequiresImage', status };
  if (code) return { key: `errors.${code}`, message: base.message, status };
  if (status === 429) return { key: 'image.videoRateLimited', status };
  return { key: 'errors.generic', message: base.message, status };
}
