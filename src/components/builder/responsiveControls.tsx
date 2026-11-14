'use client';

// Device switcher + segmented selector shared by the Style panel and the
// imageSize field (per-breakpoint editors).

import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Breakpoint } from '@/lib/responsive';

export function DeviceTabs({
  value,
  onChange,
  labels,
}: {
  value: Breakpoint;
  onChange: (v: Breakpoint) => void;
  labels: { desktop: string; tablet: string; mobile: string };
}) {
  const tabs: { key: Breakpoint; label: string; Icon: typeof Monitor }[] = [
    { key: 'desktop', label: labels.desktop, Icon: Monitor },
    { key: 'tablet', label: labels.tablet, Icon: Tablet },
    { key: 'mobile', label: labels.mobile, Icon: Smartphone },
  ];
  return (
    <div className="flex items-center justify-center gap-1 p-1 rounded-md bg-zinc-50 border border-zinc-200">
      {tabs.map(({ key, label, Icon }) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            title={label}
            className={cn(
              'flex items-center justify-center gap-1.5 px-2.5 py-1 text-[11px] rounded transition flex-1',
              active ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900',
            )}
          >
            <Icon className="size-3.5" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Inline segmented selector. `muted` softens the active chip when the value
// is inherited from a wider breakpoint instead of explicitly set here.
// `fullWidth` makes the chips share the row equally (used in stacked layout
// when the field needs the whole panel width).
export function SegSelect<T extends string>({
  value,
  onChange,
  options,
  small,
  muted,
  fullWidth,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  small?: boolean;
  muted?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-zinc-200 bg-white p-0.5',
        fullWidth ? 'grid w-full' : 'inline-flex items-center max-w-full overflow-x-auto',
      )}
      style={fullWidth ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o) => {
        const isActive = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            title={o.title}
            aria-pressed={isActive}
            className={cn(
              'transition rounded-[4px] font-medium truncate',
              fullWidth ? 'min-w-0' : 'shrink-0',
              small ? 'text-[10px] px-1.5 py-1' : 'text-[11px] px-2 py-1',
              isActive
                ? muted
                  ? 'bg-zinc-200 text-zinc-700'
                  : 'bg-zinc-900 text-white'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
