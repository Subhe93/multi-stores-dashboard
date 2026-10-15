'use client';

import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SettingsSaveError } from '@/components/apps/useStoreAppSettingsForm';

interface AppSettingsFooterProps {
  error: SettingsSaveError | null;
  saved: boolean;
  savedLabel: string;
  saving: boolean;
  dirty: boolean;
  onSave: () => void;
}

/** Save row of a store-app settings form: error, "Saved" flash and Save button. */
export function AppSettingsFooter({ error, saved, savedLabel, saving, dirty, onSave }: AppSettingsFooterProps) {
  const tc = useTranslations('common');
  return (
    <>
      {error && (
        <div className="space-y-0.5 text-xs text-red-600">
          <p>{error.text}</p>
          {error.detail && <p className="text-red-500">{error.detail}</p>}
        </div>
      )}
      <div className="flex items-center justify-end gap-2 border-t pt-4">
        {saved && <span className="text-xs font-medium text-emerald-600">{savedLabel}</span>}
        <Button type="button" size="sm" disabled={saving || !dirty} onClick={onSave}>
          {saving ? <Loader2 className="animate-spin" /> : null} {tc('save')}
        </Button>
      </div>
    </>
  );
}
