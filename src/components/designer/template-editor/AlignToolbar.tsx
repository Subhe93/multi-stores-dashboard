'use client';

import { useTranslations } from 'next-intl';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  BringToFront,
  ChevronDown,
  ChevronUp,
  Copy,
  LocateFixed,
  SendToBack,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AlignKind } from '@/lib/designer/editorGeometry';

export type StackMove = 'front' | 'forward' | 'backward' | 'back';

interface AlignToolbarProps {
  /** Name of the selected element (shown at the start of the bar). */
  name: string;
  locked: boolean;
  canForward: boolean;
  canBackward: boolean;
  onAlign: (kind: AlignKind) => void;
  onStack: (move: StackMove) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

const BTN = 'size-8 pointer-coarse:size-11';

/** Alignment / stacking toolbar of the selected element (above the canvas). */
export function AlignToolbar({ name, locked, canForward, canBackward, onAlign, onStack, onDuplicate, onRemove }: AlignToolbarProps) {
  const t = useTranslations('creator.designer.editor.align');
  const te = useTranslations('creator.designer.editor');
  const align: { kind: AlignKind; icon: typeof AlignStartVertical; label: string }[] = [
    { kind: 'left', icon: AlignStartVertical, label: t('left') },
    { kind: 'centerX', icon: AlignCenterVertical, label: t('centerX') },
    { kind: 'right', icon: AlignEndVertical, label: t('right') },
    { kind: 'top', icon: AlignStartHorizontal, label: t('top') },
    { kind: 'centerY', icon: AlignCenterHorizontal, label: t('centerY') },
    { kind: 'bottom', icon: AlignEndHorizontal, label: t('bottom') },
  ];
  const stack: { move: StackMove; icon: typeof BringToFront; label: string; disabled: boolean }[] = [
    { move: 'front', icon: BringToFront, label: t('front'), disabled: !canForward },
    { move: 'forward', icon: ChevronUp, label: t('forward'), disabled: !canForward },
    { move: 'backward', icon: ChevronDown, label: t('backward'), disabled: !canBackward },
    { move: 'back', icon: SendToBack, label: t('back'), disabled: !canBackward },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border bg-white px-2 py-1" role="toolbar" aria-label={t('title')}>
      <span className="me-1 max-w-40 truncate text-xs font-medium">{name}</span>
      <div className="inline-flex items-center" dir="ltr">
        {align.map(({ kind, icon: Icon, label }) => (
          <Button key={kind} type="button" variant="ghost" size="icon" className={BTN} title={label} aria-label={label} disabled={locked} onClick={() => onAlign(kind)}>
            <Icon className="size-4" />
          </Button>
        ))}
        <Button type="button" variant="ghost" size="icon" className={BTN} title={t('center')} aria-label={t('center')} disabled={locked} onClick={() => onAlign('center')}>
          <LocateFixed className="size-4" />
        </Button>
      </div>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <div className="inline-flex items-center">
        {stack.map(({ move, icon: Icon, label, disabled }) => (
          <Button key={move} type="button" variant="ghost" size="icon" className={BTN} title={label} aria-label={label} disabled={disabled} onClick={() => onStack(move)}>
            <Icon className="size-4" />
          </Button>
        ))}
      </div>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <div className="inline-flex items-center">
        <Button type="button" variant="ghost" size="icon" className={BTN} title={`${te('duplicate')} (Ctrl+D)`} aria-label={te('duplicate')} onClick={onDuplicate}>
          <Copy className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={`${BTN} text-red-600`} title={`${te('removeElement')} (Del)`} aria-label={te('removeElement')} onClick={onRemove}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
