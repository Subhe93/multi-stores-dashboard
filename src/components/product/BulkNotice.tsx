'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

export interface BulkNoticeState {
  tone: 'ok' | 'warn';
  text: string;
}

/** Result notice of a bulk action; disappears by itself after a few seconds. */
export function useBulkNotice(timeoutMs = 6000) {
  const [notice, setNotice] = useState<BulkNoticeState | null>(null);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), timeoutMs);
    return () => clearTimeout(id);
  }, [notice, timeoutMs]);
  return { notice, setNotice };
}

export function BulkNotice({ notice, onDismiss }: { notice: BulkNoticeState | null; onDismiss: () => void }) {
  const tc = useTranslations('common');
  if (!notice) return null;
  return (
    <div
      role="status"
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
        notice.tone === 'ok'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-800'
      }`}
    >
      {notice.tone === 'ok' ? (
        <CheckCircle2 className="size-3.5 shrink-0" />
      ) : (
        <AlertTriangle className="size-3.5 shrink-0" />
      )}
      <span className="flex-1">{notice.text}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="opacity-60 hover:opacity-100"
        aria-label={tc('close')}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
