'use client';

import { useEffect, useState } from 'react';
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
    if (
      !confirm(
        'Restore this version? Your current draft will be replaced. The live published page stays up until you publish again.',
      )
    ) return;
    setRestoringId(id);
    try {
      await api(`/v2/pages/${pageId}/versions/${id}/restore`, { method: 'POST', token });
      await onRestored();
      setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to restore');
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" title="Version history">
            <History className="w-3.5 h-3.5" />
            History
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Every publish creates a new version. Restore one to roll the draft back to its state.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
          </div>
        ) : versions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No versions yet. Publish the page to capture the first one.
          </p>
        ) : (
          <ul className="divide-y -mx-6 px-6 max-h-[360px] overflow-y-auto">
            {versions.map((v, i) => (
              <li key={v.id} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {v.label || (v.published_at ? `Published version` : 'Draft snapshot')}
                    </span>
                    {i === 0 && v.published_at && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {v.published_at
                      ? `Published ${formatDateTime(v.published_at)}`
                      : `Saved ${formatDateTime(v.created_at)}`}
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
                      Restoring…
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restore
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
