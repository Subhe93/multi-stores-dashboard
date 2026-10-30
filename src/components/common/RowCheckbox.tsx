'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface RowCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: () => void;
  'aria-label': string;
  className?: string;
}

/** Native checkbox for table selection (supports the indeterminate state). */
export function RowCheckbox({ checked, indeterminate, disabled, onChange, className, ...rest }: RowCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={rest['aria-label']}
      className={cn(
        'size-4 cursor-pointer rounded border-zinc-300 accent-zinc-900 align-middle disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
    />
  );
}
