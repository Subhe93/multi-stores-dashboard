import type { MouseEvent } from 'react';

const INTERACTIVE =
  'a,button,input,select,textarea,label,summary,[role="button"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="option"],[role="checkbox"],[role="switch"],[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[data-row-click-ignore]';

/**
 * True when a click on a table row should NOT open the row: it landed on an
 * interactive element (which handles itself) or the user is selecting text.
 */
export function isRowClickIgnored(e: MouseEvent<HTMLElement>): boolean {
  const target = e.target as Node | null;
  if (!target) return true;
  // React portals (dialogs, dropdown menus, popovers opened from a cell)
  // bubble synthetic events through the React tree to the row even though
  // the DOM target lives outside it; never treat those as row clicks.
  if (!e.currentTarget.contains(target)) return true;
  const el = target instanceof Element ? target : target.parentElement;
  const hit = el?.closest(INTERACTIVE);
  if (hit && e.currentTarget.contains(hit)) return true;
  const sel = typeof window !== 'undefined' ? window.getSelection() : null;
  if (sel && sel.type === 'Range' && sel.toString().trim()) return true;
  return false;
}
