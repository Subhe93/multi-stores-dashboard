'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownPos, setDropdownPos] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 280,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      o.description?.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    if (!open) return;
    const compute = () => {
      const el = buttonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const margin = 8;
      const desired = 280;
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const placeBelow = spaceBelow >= Math.min(desired, 180) || spaceBelow >= spaceAbove;
      const maxHeight = Math.max(160, Math.min(desired, placeBelow ? spaceBelow : spaceAbove));
      const top = placeBelow ? rect.bottom + 4 : Math.max(margin, rect.top - 4 - maxHeight);
      const left = Math.min(
        Math.max(margin, rect.left),
        Math.max(margin, window.innerWidth - rect.width - margin),
      );
      setDropdownPos({ top, left, width: rect.width, maxHeight });
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (buttonRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        onClick={() => setOpen(!open)}
        className="w-full justify-between h-9 text-sm font-normal"
      >
        {selected ? selected.label : <span className="text-muted-foreground">{placeholder}</span>}
        <ChevronsUpDown className="w-3.5 h-3.5 opacity-50" />
      </Button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] flex flex-col overflow-hidden rounded-md border bg-popover shadow-lg"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            maxHeight: dropdownPos.maxHeight,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="p-2 border-b shrink-0">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No results</p>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange?.(option.value);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-muted transition',
                    value === option.value && 'bg-muted',
                  )}
                >
                  <Check
                    className={cn(
                      'w-3.5 h-3.5 shrink-0',
                      value === option.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <div>
                    <p className="text-sm">{option.label}</p>
                    {option.description && (
                      <p className="text-[10px] text-muted-foreground">{option.description}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
