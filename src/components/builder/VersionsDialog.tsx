'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { History, Loader2, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface VersionRow {
  id: string;
  label: string | null;
  published_at: string | null;
  created_at: string;
}

interface VersionsDialogProps {
  pageId: string;
  onRestored: () => Promise<void> | void;
}

function formatDateTime(s: string) {
  return new Date(s).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VersionsDialog({ pageId, onRestored }: VersionsDialogProps) {
  const t = useTranslations();
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    api<VersionRow[]>(`/v2/pages/${pageId}/versions`, { token })
      .then(setVersions)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, pageId, token]);

  async function restore(id: string) {
    if (!token || restoringId) return;
    if (!confirm(t('builder.confirmRestore'))) return;
    setRestoringId(id);
    try {
      await api(`/v2/pages/${pageId}/versions/${id}/restore`, { method: 'POST', token });
      await onRestored();
      setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('builder.failedToRestore'));
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" title={t('builder.versionHistory')}>
            <History className="w-3.5 h-3.5" />
            {t('builder.history')}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('builder.versionHistory')}</DialogTitle>
          <DialogDescription>
            {t('builder.versionHistoryDesc')}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
          </div>
        ) : versions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            {t('builder.noVersions')}
          </p>
        ) : (
          <ul className="divide-y -mx-6 px-6 max-h-[360px] overflow-y-auto">
            {versions.map((v, i) => (
              <li key={v.id} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {v.label || (v.published_at ? t('builder.publishedVersion') : t('builder.draftSnapshot'))}
                    </span>
                    {i === 0 && v.published_at && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                        {t('builder.current')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {v.published_at
                      ? t('builder.publishedAt', { date: formatDateTime(v.published_at) })
                      : t('builder.savedAt', { date: formatDateTime(v.created_at) })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => restore(v.id)}
                  disabled={!!restoringId}
                >
                  {restoringId === v.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {t('builder.restoring')}
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      {t('builder.restore')}
                    </>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
