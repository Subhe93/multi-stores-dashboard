'use client';

import type { MouseEvent } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertCircle, ArrowDown, ArrowUp, ImageIcon, Plus, Type, UserSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DesignElement } from '@multi-stores/core/designer';
import { stackOrder, type FontFaceOption } from '@/lib/designer/templateSpec';
import { ElementForm } from './ElementForm';
import type { Issue } from './specIssues';

interface ElementsPanelProps {
  elements: DesignElement[];
  /** Selected element index (already bounds-checked), or null. */
  selected: number | null;
  issues: Issue[];
  elementIssues: (index: number) => Record<string, string>;
  elementName: (el: DesignElement) => string;
  fontOptions: FontFaceOption[];
  locales: string[];
  assetUrls: Record<string, string>;
  onAdd: (kind: 'text' | 'slot') => void;
  onAddDecoration: () => void;
  onSelect: (index: number | null) => void;
  onMove: (index: number, dir: 'up' | 'down') => void;
  onChange: (index: number, next: DesignElement) => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
  onPickImage: (index: number) => void;
  /** E9: in-app links ask before leaving with unsaved changes. */
  onLeave: (e: MouseEvent<HTMLAnchorElement>, href: string) => void;
}

/** Element list in stack order, the selected element's form and the fonts hint. */
export function ElementsPanel({
  elements, selected, issues, elementIssues, elementName, fontOptions, locales, assetUrls,
  onAdd, onAddDecoration, onSelect, onMove, onChange, onDuplicate, onRemove, onPickImage, onLeave,
}: ElementsPanelProps) {
  const t = useTranslations('creator.designer.editor');
  const order = stackOrder(elements);
  const sel = selected;
  const fontsHref = '/creator/designer?tab=assets';

  return (
    <div className="space-y-3">
      <Card className="shadow-none">
        <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-semibold">{t('elementsTitle', { count: elements.length })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAdd('text')}>
              <Plus className="size-3" /> {t('addText')}
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAdd('slot')}>
              <Plus className="size-3" /> {t('addSlot')}
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onAddDecoration}>
              <Plus className="size-3" /> {t('addDecoration')}
            </Button>
          </div>
          {elements.length === 0 ? (
            <p className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">{t('elementsEmpty')}</p>
          ) : (
            <>
              <p className="text-[11px] text-muted-foreground">{t('stackHint')}</p>
              <ul className="divide-y rounded-md border">
                {order.map((index, pos) => {
                  const el = elements[index];
                  const Icon = el.type === 'text' ? Type : el.type === 'image_slot' ? UserSquare : ImageIcon;
                  const hasIssue = issues.some((i) => i.loc.elementIndex === index);
                  return (
                    <li key={`${el.id}-${index}`} className={`flex items-center gap-2 px-2 py-1.5 ${sel === index ? 'bg-sky-50' : ''}`}>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 text-start"
                        onClick={() => onSelect(sel === index ? null : index)}
                      >
                        <Icon className={`size-4 shrink-0 ${hasIssue ? 'text-red-600' : 'text-muted-foreground'}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">{elementName(el)}</span>
                          <span className="block font-mono text-[10px] text-muted-foreground" dir="ltr">
                            {el.id} · z {el.z}
                            {el.locked ? ` · ${t('lockedShort')}` : ''}
                          </span>
                        </span>
                        {hasIssue && <AlertCircle className="size-3.5 text-red-600" />}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={t('moveUp')}
                        disabled={pos === 0}
                        onClick={() => onMove(index, 'up')}
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={t('moveDown')}
                        disabled={pos === order.length - 1}
                        onClick={() => onMove(index, 'down')}
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      {sel !== null && elements[sel] && (
        <ElementForm
          element={elements[sel]}
          index={sel}
          name={elementName(elements[sel])}
          errors={elementIssues(sel)}
          fontOptions={fontOptions}
          locales={locales}
          imageUrl={(() => {
            const el = elements[sel];
            return el.type === 'image' ? assetUrls[el.asset?.asset_id] : null;
          })()}
          onChange={(next) => onChange(sel, next)}
          onDuplicate={() => onDuplicate(sel)}
          onRemove={() => onRemove(sel)}
          onPickImage={() => onPickImage(sel)}
        />
      )}
      {fontOptions.length === 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
          {t('noFontsHint')}{' '}
          <Link href={fontsHref} onClick={(e) => onLeave(e, fontsHref)} className="font-medium underline">
            {t('openFonts')}
          </Link>
        </p>
      )}
    </div>
  );
}
