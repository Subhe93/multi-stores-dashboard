'use client';

import { cn } from '@/lib/utils';

const LOCALE_LABELS: Record<string, string> = {
  en: 'EN',
  ar: 'AR',
  tr: 'TR',
  de: 'DE',
  fr: 'FR',
  sv: 'SV',
};

interface LocaleSwitcherProps {
  primary: string;
  secondary: string[];
  active: string;
  onChange: (locale: string) => void;
}

export function LocaleSwitcher({ primary, secondary, active, onChange }: LocaleSwitcherProps) {
  const all = [primary, ...secondary.filter((l) => l !== primary)];
  if (all.length <= 1) return null;
  return (
    <div className="flex items-center gap-1 rounded-md border bg-white p-0.5">
      {all.map((l) => {
        const isActive = l === active;
        return (
          <button
            key={l}
            type="button"
            onClick={() => onChange(l)}
            className={cn(
              'px-2 py-1 text-[11px] font-medium rounded transition',
              isActive ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100',
            )}
            title={l === primary ? `${l} (primary)` : l}
          >
            {LOCALE_LABELS[l] || l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
