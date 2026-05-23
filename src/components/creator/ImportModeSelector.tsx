'use client';

import { useTranslations } from 'next-intl';
import { Package, Palette } from 'lucide-react';

type ImportMode = 'AS_IS' | 'CUSTOMIZE';

interface ImportModeSelectorProps {
  value: ImportMode | null;
  onChange: (mode: ImportMode) => void;
}

export default function ImportModeSelector({ value, onChange }: ImportModeSelectorProps) {
  const t = useTranslations('components');
  const modes = [
    {
      key: 'AS_IS' as ImportMode,
      icon: Package,
      title: t('importAsIsTitle'),
      description: t('importAsIsDesc'),
    },
    {
      key: 'CUSTOMIZE' as ImportMode,
      icon: Palette,
      title: t('importCustomizeTitle'),
      description: t('importCustomizeDesc'),
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {modes.map(({ key, icon: Icon, title, description }) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`flex flex-col items-center gap-3 rounded-lg border-2 p-5 text-center transition hover:bg-muted ${
              selected
                ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900'
                : 'border-zinc-200'
            }`}
          >
            <Icon className={`w-7 h-7 ${selected ? 'text-zinc-900' : 'text-zinc-400'}`} />
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
