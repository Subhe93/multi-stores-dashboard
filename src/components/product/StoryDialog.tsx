'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ImageIcon, Languages, Link2, Loader2, Play, RefreshCw, Star, Upload, Video, BadgeCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LocaleTabs, filledLocales, localeName, useTranslationPlaceholder } from '@/components/common/LocaleTabs';
import { resolveMediaUrl } from '@/lib/media';
import { API_ORIGIN, api } from '@/lib/api';
import { useImageUpload } from '@/lib/useImageUpload';
import { failureOf, useVideoUpload, videoFeatureFlags, type VideoUploadConfig } from '@/lib/useVideoUpload';
import type { VideoFailure } from '@/lib/uploadError';
import { formatVideoDuration, toRelativeUploadUrl } from '@/lib/productMedia';
import { VideoFirstFrame } from './VideoFirstFrame';
import {
  STORY_NAME_MAX, STORY_QUOTE_MAX, STORY_SUBTITLE_MAX, looksLikeVideoLink, storyDialogCloseAction, storyProblem,
  type EditorStory, type StoryText,
} from '@/lib/productStories';

interface StoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Story to edit (a fresh `emptyStory` when adding). */
  story: EditorStory | null;
  isNew: boolean;
  locales: string[];
  primaryLocale: string;
  token: string | null;
  /** `GET /uploads/video/config`; null hides both video options (older API). */
  videoConfig: VideoUploadConfig | null;
  /** Save refusal of the API for this story (shown on top). */
  externalError?: string;
  onSave: (story: EditorStory) => void;
}

/** Natural size of an uploaded image (null when it cannot be read). */
function readImageSize(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Add / edit one customer story: media (image, MP4 or YouTube/Vimeo link),
 * name, per-locale subtitle + quote, rating and the verified-buyer flag.
 * The link preview is the poster only, never an iframe.
 */
export function StoryDialog({
  open, onOpenChange, story, isNew, locales, primaryLocale, token, videoConfig, externalError, onSave,
}: StoryDialogProps) {
  const t = useTranslations();
  const translationPlaceholder = useTranslationPlaceholder();
  const [draft, setDraft] = useState<EditorStory | null>(story);
  const [activeLocale, setActiveLocale] = useState(primaryLocale);
  const [translatingLocale, setTranslatingLocale] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [mediaNotice, setMediaNotice] = useState('');
  const [problem, setProblem] = useState<'mediaRequired' | 'nameRequired' | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const { pickAndUpload, uploading, error: imageError, clearError } = useImageUpload(token);
  const video = useVideoUpload(token, videoConfig);
  const nameRef = useRef<HTMLInputElement>(null);
  // The draft as opened: closing with a different draft asks first.
  const initialRef = useRef('null');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busyHint, setBusyHint] = useState(false);

  // Reset the form whenever the dialog opens on a story.
  useEffect(() => {
    if (!open) return;
    const base = story;
    if (base) {
      const translations = { ...base.translations };
      for (const l of locales) if (!translations[l]) translations[l] = { quote: '', subtitle: '' };
      const opened = { ...base, translations };
      setDraft(opened);
      initialRef.current = JSON.stringify(opened);
    } else {
      setDraft(null);
      initialRef.current = 'null';
    }
    setConfirmDiscard(false);
    setBusyHint(false);
    setActiveLocale(primaryLocale);
    setMediaError('');
    setMediaNotice('');
    setProblem(null);
    setLinkOpen(false);
    setLinkValue('');
    clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, story]);

  if (!draft) return null;

  const update = (patch: Partial<EditorStory>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  const setText = (locale: string, field: keyof StoryText, value: string) =>
    setDraft((prev) => {
      if (!prev) return prev;
      const cur = prev.translations[locale] ?? { quote: '', subtitle: '' };
      return { ...prev, translations: { ...prev.translations, [locale]: { ...cur, [field]: value } } };
    });

  const describe = (f: VideoFailure): string =>
    t.has(f.key) ? t(f.key, f.values) : (f.message || t('errors.generic'));

  const busy = uploading || video.busy || linkBusy;
  const videoOptions = !!videoConfig;
  const { allowAutoplay } = videoFeatureFlags(videoConfig);

  // Cancel / Esc / click outside. A running upload or poster capture blocks
  // the close (its file would never be saved and would hold store video quota
  // until the orphan sweep); an edited draft asks before it is discarded.
  const requestClose = () => {
    const action = storyDialogCloseAction({ busy, draft, initialKey: initialRef.current });
    if (action === 'blocked') setBusyHint(true);
    else if (action === 'confirm') setConfirmDiscard(true);
    else onOpenChange(false);
  };
  const handleOpenChange = (next: boolean) => {
    if (next) onOpenChange(true);
    else requestClose();
  };
  const discardAndClose = () => {
    setConfirmDiscard(false);
    onOpenChange(false);
  };

  const handleUploadImage = async () => {
    setMediaError('');
    setMediaNotice('');
    clearError();
    const [img] = await pickAndUpload('products', false);
    if (!img) return;
    const size = await readImageSize(img.url);
    update({
      kind: 'image',
      url: toRelativeUploadUrl(img.url, API_ORIGIN),
      poster_url: null,
      duration_s: null,
      width: size?.width ?? null,
      height: size?.height ?? null,
      // Autoplay applies to video media only.
      autoplay: false,
      loop: false,
    });
    setProblem(null);
  };

  const handleUploadVideo = async () => {
    if (video.busy) return;
    setMediaError('');
    setMediaNotice('');
    const file = await video.pickVideo();
    if (!file) return;
    try {
      const up = await video.uploadVideo(file);
      update({
        kind: 'file', url: up.url, poster_url: up.poster_url,
        duration_s: up.duration_s, width: up.width, height: up.height,
      });
      setProblem(null);
      if (up.posterFailed) setMediaNotice(t('image.posterFailed'));
    } catch (err) {
      setMediaError(describe(failureOf(err)));
    }
  };

  const handleCheckLink = async () => {
    const raw = linkValue.trim();
    if (!raw || !looksLikeVideoLink(raw)) {
      setMediaError(t('image.videoLinkInvalid'));
      return;
    }
    setLinkBusy(true);
    setMediaError('');
    setMediaNotice('');
    try {
      const link = await video.addVideoLink(raw);
      update({
        kind: link.kind, url: link.url, poster_url: link.poster_url,
        duration_s: null, width: null, height: null,
      });
      setProblem(null);
      setLinkOpen(false);
      setLinkValue('');
    } catch (err) {
      setMediaError(describe(failureOf(err)));
    } finally {
      setLinkBusy(false);
    }
  };

  const handleChangePoster = async () => {
    setMediaError('');
    clearError();
    // Video covers live in the poster folder the API sweeps when unused.
    const [img] = await pickAndUpload('video-posters', false);
    if (img) update({ poster_url: toRelativeUploadUrl(img.url, API_ORIGIN) });
  };

  const handleTranslateTo = async (targetLocale: string) => {
    const source = draft.translations[primaryLocale] ?? { quote: '', subtitle: '' };
    if ((!source.quote.trim() && !source.subtitle.trim()) || translatingLocale || !token) return;
    setTranslatingLocale(targetLocale);
    const translate = (text: string) =>
      text.trim()
        ? api<{ translated: string }>('/translations/translate-text', {
            method: 'POST',
            token,
            body: JSON.stringify({ text, source_locale: primaryLocale, target_locale: targetLocale }),
          }).then((r) => r?.translated || '')
        : Promise.resolve('');
    try {
      const [quote, subtitle] = await Promise.all([translate(source.quote), translate(source.subtitle)]);
      setDraft((prev) => {
        if (!prev) return prev;
        const cur = prev.translations[targetLocale] ?? { quote: '', subtitle: '' };
        return {
          ...prev,
          translations: {
            ...prev.translations,
            [targetLocale]: {
              quote: (quote || cur.quote).slice(0, STORY_QUOTE_MAX),
              subtitle: (subtitle || cur.subtitle).slice(0, STORY_SUBTITLE_MAX),
            },
          },
        };
      });
    } catch {
      // Silent, like the FAQ editor: the owner can still type the text.
    } finally {
      setTranslatingLocale('');
    }
  };

  const handleSave = () => {
    const p = storyProblem(draft);
    setProblem(p);
    if (p === 'nameRequired') nameRef.current?.focus();
    if (p) return;
    onSave(draft);
  };

  const hasMedia = !!draft.url;
  const isVideo = hasMedia && draft.kind !== 'image';
  const thumb = draft.kind === 'image' ? draft.url : draft.poster_url;
  const phase = video.state;
  const progressLabel =
    phase.phase === 'uploading' ? t('image.uploadingProgress', { percent: phase.percent })
      : phase.phase === 'poster' ? t('image.generatingPoster')
        : phase.phase === 'checking' ? t('image.uploadingProgress', { percent: 0 })
          : '';
  const progressPercent = phase.phase === 'uploading' ? phase.percent : phase.phase === 'poster' ? 100 : 0;
  const text = draft.translations[activeLocale] ?? { quote: '', subtitle: '' };
  const primaryText = draft.translations[primaryLocale] ?? { quote: '', subtitle: '' };
  const visibleError = externalError || mediaError || imageError || '';

  const mediaMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium shadow-xs hover:bg-accent disabled:opacity-50"
        disabled={busy}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        {hasMedia ? t('story.changeMedia') : t('story.media')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuItem onClick={() => void handleUploadImage()}>
          <ImageIcon /> {t('story.uploadImage')}
        </DropdownMenuItem>
        {videoOptions && videoConfig?.uploads_enabled && (
          <DropdownMenuItem onClick={() => void handleUploadVideo()}>
            <Video /> {t('story.uploadVideo')}
          </DropdownMenuItem>
        )}
        {videoOptions && (
          <DropdownMenuItem onClick={() => { setMediaError(''); setLinkOpen(true); }}>
            <Link2 /> {t('story.addVideoLink')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? t('story.add') : t('story.edit')}</DialogTitle>
        </DialogHeader>

        {visibleError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{visibleError}</p>
        )}

        <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
          {/* Media */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">
              {t('story.media')} <span className="text-red-500">*</span>
            </Label>
            <div
              className={`relative aspect-[9/16] w-full overflow-hidden rounded-lg border ${
                problem === 'mediaRequired' ? 'border-red-400' : ''
              } ${isVideo && thumb ? 'bg-zinc-900' : isVideo ? 'bg-zinc-200' : 'bg-zinc-50'}`}
            >
              {thumb ? (
                <img src={resolveMediaUrl(thumb)} alt="" className="h-full w-full object-cover" />
              ) : isVideo ? (
                // No poster: a neutral tile, with the upload's first frame on top.
                <>
                  <Video className="absolute inset-0 m-auto size-8 text-zinc-500" aria-hidden="true" />
                  {draft.kind === 'file' && <VideoFirstFrame url={draft.url} />}
                </>
              ) : (
                <ImageIcon className="absolute inset-0 m-auto size-8 text-zinc-300" aria-hidden="true" />
              )}
              {isVideo && (
                <span className="absolute inset-0 m-auto flex size-10 items-center justify-center rounded-full bg-black/60 text-white">
                  <Play className="size-4 fill-current" aria-hidden="true" />
                </span>
              )}
              {isVideo && draft.duration_s ? (
                <span dir="ltr" className="absolute bottom-1.5 end-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white tabular-nums">
                  {formatVideoDuration(draft.duration_s)}
                </span>
              ) : null}
              {video.busy && (
                <div className="absolute inset-x-2 bottom-2 space-y-1 rounded bg-white/90 p-2" aria-live="polite">
                  <div className="h-1 w-full overflow-hidden rounded bg-zinc-200">
                    <div className="h-full bg-zinc-600 transition-all" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{progressLabel}</p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {mediaMenu}
              {isVideo && (
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => void handleChangePoster()} disabled={busy}>
                  <RefreshCw className="size-3.5 me-1" /> {t('story.changePoster')}
                </Button>
              )}
            </div>
            {isVideo && allowAutoplay && (
              <div className="space-y-1 rounded-lg border p-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded accent-primary"
                    checked={draft.autoplay}
                    onChange={(e) => update(e.target.checked ? { autoplay: true } : { autoplay: false, loop: false })}
                  />
                  <span className="text-xs font-medium">{t('story.autoplay')}</span>
                </label>
                <label className={`flex items-center gap-2 ${draft.autoplay ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                  <input
                    type="checkbox"
                    className="rounded accent-primary"
                    checked={draft.autoplay && draft.loop}
                    disabled={!draft.autoplay}
                    onChange={(e) => update({ loop: e.target.checked })}
                  />
                  <span className="text-xs font-medium">{t('story.loop')}</span>
                </label>
                <p className="text-[10px] leading-relaxed text-muted-foreground">{t('story.autoplayHelp')}</p>
              </div>
            )}
            {problem === 'mediaRequired' && (
              <p className="text-[11px] text-red-600">{t('story.mediaRequired')}</p>
            )}
            {mediaNotice && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">{mediaNotice}</p>
            )}
            {linkOpen && (
              <div className="space-y-1.5 rounded-lg border p-2">
                <Label className="text-[11px]" htmlFor="story-video-link">{t('image.videoLinkLabel')}</Label>
                <Input
                  id="story-video-link"
                  dir="ltr"
                  className="h-8 text-xs"
                  value={linkValue}
                  placeholder={t('image.videoLinkPlaceholder')}
                  onChange={(e) => { setLinkValue(e.target.value); setMediaError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleCheckLink(); } }}
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" className="h-7 text-xs" onClick={() => void handleCheckLink()} disabled={linkBusy || !linkValue.trim()}>
                    {linkBusy && <Loader2 className="me-1 size-3 animate-spin" />}
                    {t('common.add')}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setLinkOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Person and text */}
          <div className="min-w-0 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium" htmlFor="story-name">
                {t('story.name')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="story-name"
                ref={nameRef}
                className={`h-8 text-sm ${problem === 'nameRequired' ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                maxLength={STORY_NAME_MAX}
                placeholder={t('story.namePlaceholder')}
                value={draft.name}
                onChange={(e) => { update({ name: e.target.value }); if (problem === 'nameRequired') setProblem(null); }}
              />
              {problem === 'nameRequired' && <p className="text-[11px] text-red-600">{t('story.nameRequired')}</p>}
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <LocaleTabs
                value={activeLocale}
                onChange={setActiveLocale}
                locales={locales}
                primaryLocale={primaryLocale}
                filled={filledLocales(locales, draft.translations, (row) => !!row?.quote?.trim())}
              />
              {activeLocale !== primaryLocale && (
                <div className="flex items-center justify-between rounded-lg border border-dashed bg-zinc-50 p-2.5">
                  <span className="truncate text-xs text-muted-foreground">
                    {t('story.autoTranslateFrom', { locale: localeName(primaryLocale) })}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleTranslateTo(activeLocale)}
                    disabled={!!translatingLocale || (!primaryText.quote.trim() && !primaryText.subtitle.trim())}
                    className="ms-3 flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {translatingLocale === activeLocale ? (
                      <><Loader2 className="size-3 animate-spin" /> {t('story.translating')}</>
                    ) : (
                      <><Languages className="size-3" /> {t('story.autoTranslate')}</>
                    )}
                  </button>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium" htmlFor="story-subtitle">{t('story.subtitle')}</Label>
                <Input
                  id="story-subtitle"
                  className="h-8 text-sm"
                  maxLength={STORY_SUBTITLE_MAX}
                  placeholder={translationPlaceholder({
                    locale: activeLocale,
                    primaryLocale,
                    baseValue: primaryText.subtitle,
                    primaryPlaceholder: t('story.subtitlePlaceholder'),
                  })}
                  value={text.subtitle}
                  onChange={(e) => setText(activeLocale, 'subtitle', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium" htmlFor="story-quote">{t('story.quote')}</Label>
                <Textarea
                  id="story-quote"
                  rows={5}
                  className="resize-y text-sm"
                  maxLength={STORY_QUOTE_MAX}
                  placeholder={translationPlaceholder({
                    locale: activeLocale,
                    primaryLocale,
                    baseValue: primaryText.quote,
                    primaryPlaceholder: t('story.quotePlaceholder'),
                  })}
                  value={text.quote}
                  onChange={(e) => setText(activeLocale, 'quote', e.target.value)}
                />
                <p className="text-end text-[10px] text-muted-foreground tabular-nums" dir="ltr">
                  {text.quote.length}/{STORY_QUOTE_MAX}
                </p>
              </div>
            </div>

            {/* Rating: 0 = none */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium" id="story-rating-label">{t('story.rating')}</span>
              <div role="radiogroup" aria-labelledby="story-rating-label" className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  role="radio"
                  aria-checked={draft.rating === 0}
                  onClick={() => update({ rating: 0 })}
                  className={`me-1 rounded-md border px-2 py-1 text-xs ${draft.rating === 0 ? 'border-primary bg-primary/5 font-medium' : 'hover:bg-muted'}`}
                >
                  {t('story.ratingNone')}
                </button>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={draft.rating === n}
                    aria-label={t('story.ratingValue', { rating: n })}
                    title={t('story.ratingValue', { rating: n })}
                    onClick={() => update({ rating: n })}
                    className="rounded p-0.5 hover:bg-muted"
                  >
                    <Star
                      aria-hidden="true"
                      className={`size-5 ${n <= draft.rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'}`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Verified buyer (owner-asserted, EU Omnibus) */}
            <div className="space-y-1">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded accent-primary"
                  checked={draft.verified}
                  onChange={(e) => update({ verified: e.target.checked })}
                />
                <BadgeCheck className="size-4 text-emerald-600" aria-hidden="true" />
                <span className="text-xs font-medium">{t('story.verified')}</span>
              </label>
              <p className="ms-6 text-[11px] leading-relaxed text-muted-foreground">{t('story.verifiedHelp')}</p>
            </div>
          </div>
        </div>

        {busyHint && busy && (
          <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {t('story.busyClose')}
          </p>
        )}
        {confirmDiscard ? (
          <div role="alertdialog" aria-label={t('story.discardTitle')} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <span className="text-xs font-medium text-red-800">{t('story.discardTitle')}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setConfirmDiscard(false)} autoFocus>
                {t('story.keepEditing')}
              </Button>
              <Button type="button" variant="destructive" size="sm" className="h-7 text-xs" onClick={discardAndClose}>
                {t('story.discard')}
              </Button>
            </div>
          </div>
        ) : (
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={requestClose}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={busy}>
              {t('story.save')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
