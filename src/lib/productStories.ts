/**
 * Customer stories of the product editor (plans/customer-stories/CONTRACT.md
 * sections 2, 4.5 and 5). Pure helpers only (no React, no DOM) so they can be
 * unit-tested with `node --test`.
 */

export type StoryKind = 'image' | 'file' | 'youtube' | 'vimeo';

/** Story as the API returns it (editor GET, PUT response). */
export interface ProductStoryOut {
  id: string;
  kind: StoryKind;
  url: string;
  poster_url: string | null;
  duration_s: number | null;
  width: number | null;
  height: number | null;
  name: string;
  rating: number | null;
  verified: boolean;
  /** Muted autoplay of a video story; absent on an older API. */
  autoplay?: boolean;
  /** Loop while autoplaying; absent on an older API. */
  loop?: boolean;
  translations: { locale: string; quote: string; subtitle: string | null }[];
}

/** Feature flag of `GET /uploads/video/config` (`features.autoplay`). */
export interface StoryPayloadOptions {
  /** The API accepts `autoplay` / `loop` on stories. */
  allowAutoplay?: boolean;
}

/** Translated text of one content locale. */
export interface StoryText {
  quote: string;
  subtitle: string;
}

/** Media of a story; `url` '' = no media picked yet. */
export interface StoryMedia {
  kind: StoryKind;
  url: string;
  poster_url: string | null;
  duration_s: number | null;
  width: number | null;
  height: number | null;
}

/** Story as edited in the form. */
export interface EditorStory extends StoryMedia {
  /** Local key (stable across reorders; never sent). */
  key: string;
  /** Stored row id; absent for a story not saved yet. */
  id?: string;
  name: string;
  /** 0 = no rating, else 1..5. */
  rating: number;
  verified: boolean;
  /** Muted autoplay on the storefront (video media only). */
  autoplay: boolean;
  /** Loop while autoplaying (ignored when `autoplay` is false). */
  loop: boolean;
  /**
   * Text per locale. Rows of locales the store no longer uses are kept and
   * sent back unchanged (contract 5, last dialog bullet).
   */
  translations: Record<string, StoryText>;
}

/** Business limit of the API (`STORY_LIMIT_EXCEEDED`). */
export const MAX_STORIES_PER_PRODUCT = 30;
/** Input caps, identical to the API DTO (contract 3.1). */
export const STORY_NAME_MAX = 80;
export const STORY_SUBTITLE_MAX = 120;
export const STORY_QUOTE_MAX = 1000;

/** Every coded refusal of a story save (contract 4.5). */
export const STORY_ERROR_CODES = [
  'STORY_LIMIT_EXCEEDED',
  'STORY_NAME_REQUIRED',
  'STORY_MEDIA_INVALID',
  'STORY_URL_NOT_ALLOWED',
  'STORY_FILE_INVALID',
  'STORY_IMAGE_INVALID',
  'STORY_UPLOAD_EXPIRED',
  'STORY_LOCALE_DUPLICATE',
] as const;

let keySeq = 0;
export function newStoryKey(): string {
  keySeq += 1;
  return `story-${Date.now().toString(36)}-${keySeq}`;
}

const STORY_KINDS: readonly StoryKind[] = ['image', 'file', 'youtube', 'vimeo'];

function intOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : null;
}

/** API row → editor story (an unknown kind falls back to 'image'). */
export function storyFromServer(row: ProductStoryOut): EditorStory {
  const translations: Record<string, StoryText> = {};
  for (const tr of row.translations ?? []) {
    if (!tr || typeof tr.locale !== 'string') continue;
    translations[tr.locale] = { quote: tr.quote ?? '', subtitle: tr.subtitle ?? '' };
  }
  const kind = STORY_KINDS.includes(row.kind) ? row.kind : 'image';
  const rating = typeof row.rating === 'number' && row.rating >= 1 && row.rating <= 5 ? Math.round(row.rating) : 0;
  return {
    key: row.id || newStoryKey(),
    id: row.id || undefined,
    kind,
    url: row.url ?? '',
    poster_url: kind === 'image' ? null : row.poster_url ?? null,
    duration_s: intOrNull(row.duration_s),
    width: intOrNull(row.width),
    height: intOrNull(row.height),
    name: row.name ?? '',
    rating,
    verified: !!row.verified,
    autoplay: kind !== 'image' && row.autoplay === true,
    loop: kind !== 'image' && row.loop === true,
    translations,
  };
}

/** An empty story with a slot for every locale. */
export function emptyStory(locales: readonly string[]): EditorStory {
  const translations: Record<string, StoryText> = {};
  for (const l of locales) translations[l] = { quote: '', subtitle: '' };
  return {
    key: newStoryKey(),
    kind: 'image',
    url: '',
    poster_url: null,
    duration_s: null,
    width: null,
    height: null,
    name: '',
    rating: 0,
    verified: false,
    autoplay: false,
    loop: false,
    translations,
  };
}

/** Story text in `locale`, else the primary locale, else the first filled one. */
export function storyText(story: EditorStory, locale: string, primaryLocale: string): StoryText {
  const filled = (t: StoryText | undefined) => !!t && (!!t.quote.trim() || !!t.subtitle.trim());
  const own = story.translations[locale];
  if (filled(own)) return own!;
  const primary = story.translations[primaryLocale];
  if (filled(primary)) return primary!;
  const first = Object.values(story.translations).find(filled);
  return first ?? { quote: '', subtitle: '' };
}

/** Translation rows of the save body; locales with no text at all are left out. */
export function storyTranslationsPayload(story: EditorStory) {
  return Object.entries(story.translations)
    .map(([locale, tr]) => ({ locale, quote: (tr?.quote ?? '').trim(), subtitle: (tr?.subtitle ?? '').trim() }))
    .filter((tr) => tr.quote || tr.subtitle)
    .sort((a, b) => a.locale.localeCompare(b.locale))
    .map((tr) => ({ locale: tr.locale, quote: tr.quote, subtitle: tr.subtitle || null }));
}

/**
 * `stories` of the product save body, in display order (contract 5, save rule).
 * `autoplay` / `loop` only with `allowAutoplay` (an older API rejects unknown
 * keys); always false for image stories.
 */
export function storiesPayload(stories: readonly EditorStory[], opts: StoryPayloadOptions = {}) {
  return stories.map((s) => {
    const isImage = s.kind === 'image';
    const autoplay = !isImage && !!s.autoplay;
    return {
      ...(s.id ? { id: s.id } : {}),
      kind: s.kind,
      url: s.url,
      poster_url: isImage ? null : s.poster_url || null,
      duration_s: isImage ? null : intOrNull(s.duration_s),
      width: intOrNull(s.width),
      height: intOrNull(s.height),
      name: s.name.trim(),
      rating: s.rating >= 1 && s.rating <= 5 ? Math.round(s.rating) : null,
      verified: !!s.verified,
      ...(opts.allowAutoplay ? { autoplay, loop: autoplay && !!s.loop } : {}),
      translations: storyTranslationsPayload(s),
    };
  });
}

/**
 * Comparable snapshot for the unsaved-changes tracker (no ids, no local keys).
 * Pass the same flags as the save payload.
 */
export function storiesKey(stories: readonly EditorStory[], opts: StoryPayloadOptions = {}): string {
  return JSON.stringify(storiesPayload(stories, opts).map((s) => ({ ...s, id: undefined })));
}

/**
 * Whether a save sends `stories`. Edit: only when the editor GET returned a
 * `stories` array (an older API rejects the key) and the stories differ from
 * the loaded / last saved ones (`changed`; the server rewrites every sent
 * story). Create: only when at least one story was added.
 */
export function shouldSendStories(opts: {
  mode: 'create' | 'edit';
  serverHasStories: boolean;
  storyCount: number;
  /** Edit mode: the stories differ from the loaded / last saved ones. */
  changed?: boolean;
}): boolean {
  if (opts.mode === 'edit') return opts.serverHasStories && opts.changed !== false;
  return opts.storyCount > 0;
}

/**
 * What a close request (Cancel / Esc / click outside) of the story dialog
 * does: a running upload or poster capture blocks it, an edited draft asks
 * first, otherwise the dialog closes.
 */
export function storyDialogCloseAction(opts: {
  busy: boolean;
  draft: unknown;
  /** `JSON.stringify` of the draft as the dialog opened it. */
  initialKey: string;
}): 'blocked' | 'confirm' | 'close' {
  if (opts.busy) return 'blocked';
  return JSON.stringify(opts.draft ?? null) !== opts.initialKey ? 'confirm' : 'close';
}

export type StoryProblem = 'mediaRequired' | 'nameRequired';

/** Problem of one story that blocks the save, or null. */
export function storyProblem(story: Pick<EditorStory, 'url' | 'name'>): StoryProblem | null {
  if (!story.url.trim()) return 'mediaRequired';
  if (!story.name.trim()) return 'nameRequired';
  return null;
}

/** First story that blocks the save (client side, before any request). */
export function firstInvalidStory(stories: readonly EditorStory[]): { index: number; problem: StoryProblem } | null {
  for (let i = 0; i < stories.length; i++) {
    const problem = storyProblem(stories[i]!);
    if (problem) return { index: i, problem };
  }
  return null;
}

/** Moves the item at `from` to `to` (both clamped); a no-op returns the same array. */
export function moveStory<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return [...list];
  const target = Math.max(0, Math.min(list.length - 1, to));
  if (target === from) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item!);
  return next;
}

export function isStoryErrorCode(code: unknown): code is (typeof STORY_ERROR_CODES)[number] {
  return typeof code === 'string' && (STORY_ERROR_CODES as readonly string[]).includes(code);
}

/**
 * Translation key + values of a coded story refusal, and the 0-based index of
 * the story it names (null for the list-wide limit or a missing index).
 */
export function describeStoryError(
  code: string,
  payload: Record<string, unknown> | null | undefined,
  storyCount: number,
): { key: string; values: Record<string, string | number>; index: number | null } {
  const rawIndex = payload?.index;
  const index =
    typeof rawIndex === 'number' && Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < storyCount
      ? rawIndex
      : null;
  const values: Record<string, string | number> = {};
  if (code === 'STORY_LIMIT_EXCEEDED') {
    values.max = typeof payload?.max === 'number' && payload.max > 0 ? payload.max : MAX_STORIES_PER_PRODUCT;
    return { key: `errors.${code}`, values, index: null };
  }
  if (code === 'STORY_LOCALE_DUPLICATE') {
    values.locale = typeof payload?.locale === 'string' ? payload.locale : '';
  }
  return { key: `errors.${code}`, values, index };
}

/** Quick client-side shape check of a YouTube / Vimeo link; the API has the final word. */
const VIDEO_LINK_HINT = /^(https?:\/\/)?([a-z0-9-]+\.)*(youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com)\//i;
export function looksLikeVideoLink(url: string): boolean {
  return VIDEO_LINK_HINT.test(url.trim());
}

/** Applies stored ids of a save response to stories sent without an id (same order). */
export function adoptStoryIds(
  stories: readonly EditorStory[],
  sent: readonly { id?: string; url: string }[],
  stored: readonly { id: string; url: string }[] | null | undefined,
): EditorStory[] {
  if (!Array.isArray(stored) || stored.length !== sent.length || stories.length !== sent.length) return [...stories];
  return stories.map((s, i) => {
    const row = stored[i];
    // Links are already canonical (from `/uploads/video-link`), so the URLs match;
    // anything else keeps no id and is simply re-created by the next save.
    if (s.id || !row || typeof row.id !== 'string' || sent[i]!.url !== row.url) return s;
    return { ...s, id: row.id };
  });
}
