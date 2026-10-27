'use client';

import { useState, useRef, useEffect, useId, useCallback, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { selectKeyReducer, clampActiveIndex, openingIndex } from './searchableSelectKeys';

interface Option {
  value: string;
  label: string;
  description?: string;
  // Shown but not selectable (e.g. a stored value whose option is gone).
  disabled?: boolean;
}

interface SearchableSelectProps {
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Id of the trigger button, for a `<Label htmlFor>`. */
  id?: string;
}

/**
 * Searchable dropdown (E15): the trigger is a button with `aria-haspopup`
 * / `aria-expanded`, the list is a `listbox` of `option`s navigated with
 * the arrow keys, Home / End, Enter, Escape and Tab from the search box
 * (`aria-activedescendant`). Closes on outside click and on Escape.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  id,
}: SearchableSelectProps) {
  const t = useTranslations('common');
  const placeholderText = placeholder ?? t('select');
  const searchPlaceholderText = searchPlaceholder ?? t('searchEllipsis');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 280,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-opt-${index}`;

  const selected = options.find((o) => o.value === value);
  const matching = options.filter(
    (o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      o.description?.toLowerCase().includes(search.toLowerCase()),
  );
  // Large catalogs (the ~2k Google Fonts list) would render thousands of rows
  // at once; the dropdown is search-driven, so showing the first slice and a
  // "refine your search" hint keeps it instant without hiding anything findable.
  const DISPLAY_CAP = 150;
  const filtered = matching.slice(0, DISPLAY_CAP);
  const truncatedCount = matching.length - filtered.length;
  const selectedIndex = filtered.findIndex((o) => o.value === value);
  const active = activeIndex >= 0 && activeIndex < filtered.length ? activeIndex : -1;

  const close = useCallback(() => {
    setOpen(false);
    setSearch('');
    setActiveIndex(-1);
  }, []);

  const openList = () => {
    setActiveIndex(openingIndex(selectedIndex, filtered.length));
    setOpen(true);
  };

  const commit = (index: number) => {
    const option = filtered[index];
    if (option?.disabled) return;
    if (option) onChange?.(option.value);
    close();
  };

  // One handler for the trigger and the search box; the reducer decides.
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const r = selectKeyReducer({ open, activeIndex: active }, { key: e.key, count: filtered.length, selectedIndex });
    if (r.handled) e.preventDefault();
    if (r.commit !== undefined) {
      commit(r.commit);
    } else if (!r.open) {
      if (open) close();
    } else {
      setOpen(true);
      setActiveIndex(r.activeIndex);
    }
    if (r.refocusTrigger) buttonRef.current?.focus();
  };

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
      // Viewport coordinates are direction-agnostic, so this is RTL-safe.
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

  // Close on outside click (the popup is portaled, so check both nodes) and on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close();
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  // Keep the highlighted row visible while navigating with the keyboard.
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[id="${optionId(active)}"]`)?.scrollIntoView({ block: 'nearest' });
    // optionId is derived from the stable useId value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  return (
    <div className="relative">
      <Button
        id={id}
        ref={buttonRef}
        type="button"
        variant="outline"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={(e) => {
          // Enter / Space already toggle via click; only the arrows open from the trigger.
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) onKeyDown(e);
        }}
        className="w-full justify-between h-9 text-sm font-normal"
      >
        {selected ? selected.label : <span className="text-muted-foreground">{placeholderText}</span>}
        <ChevronsUpDown className="w-3.5 h-3.5 opacity-50" aria-hidden />
      </Button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={popupRef}
          className="fixed z-[9999] flex flex-col overflow-hidden rounded-md border bg-popover shadow-lg"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            maxHeight: dropdownPos.maxHeight,
          }}
        >
          <div className="p-2 border-b shrink-0">
            <input
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? optionId(active) : undefined}
              placeholder={searchPlaceholderText}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                // The filtered list changes with the text; recomputed against the next render's length.
                const next = options.filter(
                  (o) =>
                    o.label.toLowerCase().includes(e.target.value.toLowerCase()) ||
                    o.description?.toLowerCase().includes(e.target.value.toLowerCase()),
                ).length;
                setActiveIndex((i) => clampActiveIndex(i, Math.min(next, DISPLAY_CAP)));
              }}
              onKeyDown={onKeyDown}
              className="w-full px-2 py-1.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={placeholderText}
            className="flex-1 min-h-0 overflow-y-auto p-1"
          >
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t('noResults')}</p>
            ) : (
              filtered.map((option, index) => (
                <div
                  key={option.value}
                  id={optionId(index)}
                  role="option"
                  aria-selected={value === option.value}
                  aria-disabled={option.disabled || undefined}
                  onMouseMove={() => { if (active !== index) setActiveIndex(index); }}
                  onClick={() => commit(index)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-start cursor-pointer transition',
                    value === option.value && 'bg-muted',
                    active === index && 'bg-muted',
                    option.disabled && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <Check
                    aria-hidden
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
                </div>
              ))
            )}
            {truncatedCount > 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-1.5">
                {t('moreResultsRefine', { count: truncatedCount })}
              </p>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
