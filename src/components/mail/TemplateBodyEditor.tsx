'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Code2, Eye, EyeOff, Loader2, PenLine } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface TemplateBodyEditorProps {
  // '/mail/store/templates' (creator) or '/mail/admin/templates' (admin).
  basePath: string;
  event: string;
  locale: string;
  dir: 'ltr' | 'rtl';
  subject: string;
  html: string;
  text: string;
  onHtmlChange: (html: string) => void;
}

// A designed email (tables, inline styles, a full document) cannot survive the
// visual editor, which keeps only simple text markup.
export function isDesignedHtml(html: string | undefined | null): boolean {
  return !!html && /<table|<!doctype|<html|<body|\sstyle=/i.test(html);
}

// HTML body of a template: visual editor for simple text, source editor for
// designed emails, and a preview rendered by the API with sample data.
export function TemplateBodyEditor({
  basePath,
  event,
  locale,
  dir,
  subject,
  html,
  text,
  onHtmlChange,
}: TemplateBodyEditorProps) {
  const t = useTranslations('templateEditor');
  const { token } = useAuth();

  const designed = isDesignedHtml(html);
  const hasBody = html.trim() !== '';
  const [mode, setMode] = useState<'visual' | 'html'>(designed ? 'html' : 'visual');
  const [showPreview, setShowPreview] = useState(true);
  const [preview, setPreview] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  // Designed content always opens as source, whatever was selected before.
  const activeMode = designed ? 'html' : mode;

  // Re-render the preview a moment after the last keystroke.
  useEffect(() => {
    // An empty body has nothing to render; the panel shows its empty state.
    if (!token || !showPreview || !html.trim()) return;
    let cancelled = false;
    const id = setTimeout(() => {
      setPreviewLoading(true);
      api<{ subject: string; html: string }>(`${basePath}/${event}/preview`, {
        method: 'POST',
        token,
        body: JSON.stringify({ locale, subject, body_html: html, body_text: text }),
      })
        .then((res) => {
          if (cancelled) return;
          setPreview(res.html);
          setPreviewSubject(res.subject);
          setPreviewError('');
        })
        .catch((err: unknown) => {
          if (!cancelled) setPreviewError((err instanceof Error && err.message) || t('previewFailed'));
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false);
        });
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [token, basePath, event, locale, subject, html, text, showPreview, t]);

  const modeButton = (value: 'visual' | 'html', label: string, icon: React.ReactNode, disabled = false) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setMode(value)}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${
        activeMode === value
          ? 'bg-zinc-900 text-white border-zinc-900'
          : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs">{t('body')}</Label>
        <div className="flex items-center gap-1.5">
          {modeButton('visual', t('visual'), <PenLine className="w-3 h-3" />, designed)}
          {modeButton('html', t('html'), <Code2 className="w-3 h-3" />)}
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="inline-flex items-center gap-1 ms-2 text-[11px] text-muted-foreground hover:text-foreground transition"
          >
            {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showPreview ? t('hidePreview') : t('showPreview')}
          </button>
        </div>
      </div>

      {designed && <p className="text-[11px] text-muted-foreground">{t('designedHint')}</p>}

      {activeMode === 'html' ? (
        <Textarea
          dir="ltr"
          spellCheck={false}
          className="text-xs font-mono min-h-80 leading-relaxed"
          value={html}
          onChange={(e) => onHtmlChange(e.target.value)}
        />
      ) : (
        <RichTextEditor key={`html-${locale}`} content={html} onChange={onHtmlChange} dir={dir} />
      )}

      {showPreview && (
        <div className="rounded-md border bg-white overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b bg-zinc-50 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">{t('preview')}</p>
              {hasBody && previewSubject && (
                <p className="text-xs font-medium text-zinc-800 truncate" dir={dir}>
                  {previewSubject}
                </p>
              )}
            </div>
            {previewLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />}
          </div>
          {!hasBody ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">{t('emptyPreview')}</p>
          ) : previewError ? (
            <p className="px-3 py-4 text-xs text-destructive">{previewError}</p>
          ) : preview ? (
            // Sandboxed: template HTML is never run as part of the dashboard.
            <iframe title={t('preview')} sandbox="" srcDoc={preview} className="w-full h-[640px] bg-white" />
          ) : (
            <p className="px-3 py-4 text-xs text-muted-foreground">{t('emptyPreview')}</p>
          )}
          <p className="border-t bg-zinc-50 px-3 py-2 text-[11px] text-muted-foreground">{t('previewHint')}</p>
        </div>
      )}
    </div>
  );
}
