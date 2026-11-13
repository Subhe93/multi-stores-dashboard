'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { resolveMediaUrl } from '@/lib/media';
import type { VideoLinkResult } from '@/lib/useVideoUpload';

interface VideoLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolves the link on the API (`POST /uploads/video-link`). */
  resolveLink: (url: string) => Promise<VideoLinkResult>;
  /** Localized message of a failed `resolveLink`. */
  describeError: (err: unknown) => string;
  onAdd: (link: VideoLinkResult) => void;
}

/** Quick client-side shape check; the API parser has the final word. */
const LINK_HINT = /^(https?:\/\/)?([a-z0-9-]+\.)*(youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com)\//i;

/**
 * Adds a YouTube or Vimeo video by link. The preview is the poster image
 * only, never an iframe, so the dashboard `frame-src` stays unchanged.
 */
export function VideoLinkDialog({ open, onOpenChange, resolveLink, describeError, onAdd }: VideoLinkDialogProps) {
  const t = useTranslations();
  const [value, setValue] = useState('');
  const [resolved, setResolved] = useState<VideoLinkResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setValue('');
      setResolved(null);
      setError('');
      setBusy(false);
    }
  }, [open]);

  const check = async () => {
    const url = value.trim();
    if (!url || !LINK_HINT.test(url)) {
      setError(t('image.videoLinkInvalid'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const link = await resolveLink(url);
      setResolved(link);
    } catch (err) {
      setResolved(null);
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    if (!resolved) return;
    onAdd(resolved);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="size-4 text-muted-foreground" /> {t('image.addVideoLink')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="product-video-link">{t('image.videoLinkLabel')}</Label>
            <div className="flex gap-2">
              <Input
                id="product-video-link"
                dir="ltr"
                className="h-8 text-sm"
                value={value}
                placeholder={t('image.videoLinkPlaceholder')}
                onChange={e => { setValue(e.target.value); setResolved(null); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (resolved) add(); else void check(); } }}
              />
              <Button variant="outline" size="sm" className="h-8" onClick={() => void check()} disabled={busy || !value.trim()}>
                {busy && <Loader2 className="me-1 size-3 animate-spin" />}
                {t('image.videoLinkCheck')}
              </Button>
            </div>
          </div>
          {resolved && (
            <div className="flex items-center gap-3 rounded-lg border p-2">
              <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded bg-zinc-900">
                {resolved.poster_url ? (
                  <img src={resolveMediaUrl(resolved.poster_url)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Video className="absolute inset-0 m-auto size-6 text-zinc-500" />
                )}
              </div>
              <p className="min-w-0 truncate text-xs text-muted-foreground" dir="ltr">{resolved.url}</p>
            </div>
          )}
        </div>
        {error && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={add} disabled={!resolved || busy}>
            {t('common.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
