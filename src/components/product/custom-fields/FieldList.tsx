'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Trash2, GripVertical, Pencil, AlertTriangle, BookmarkPlus, Lock, CornerDownRight, ArrowUp, ArrowDown,
} from 'lucide-react';
import { isAppOnlyType } from '@/lib/personalization';
import { linkTargetName, linkTargetResolves, rawLinkTarget } from './fieldPayload';
import { displayLabelOf, type CustomField } from './types';

interface FieldListProps {
  fields: CustomField[];
  /** Personalization app on for this product. */
  on: boolean;
  primaryLocale: string;
  /** Reordering available (the manager received `onReorder`). */
  canReorder: boolean;
  /** Type value → translated label (falls back to the value). */
  typeLabel: (value: string) => string;
  onEdit: (field: CustomField) => void;
  onDelete: (id: string) => void;
  /** Moves a field one step within its sibling set. */
  onMove: (siblings: CustomField[], index: number, delta: -1 | 1) => void;
  onSaveToLibrary: (field: CustomField) => void;
  onAddChild: (parentId: string) => void;
}

/** The field rows (repeater children nested under their parent) with the row actions. */
export function FieldList({
  fields, on, primaryLocale, canReorder, typeLabel, onEdit, onDelete, onMove, onSaveToLibrary, onAddChild,
}: FieldListProps) {
  const t = useTranslations();
  const displayLabel = (field: CustomField) => displayLabelOf(field, primaryLocale);

  // Repeater children are listed under their parent; orphans stay top-level.
  const topLevelFields = fields
    .filter(f => !f.parent_id || !fields.some(p => p.id === f.parent_id))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const childrenOf = (id?: string) =>
    id ? fields.filter(f => f.parent_id === id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) : [];
  // With the app off, fields only the app can use are delete-only (D10).
  const lockedWhenOff = (field: CustomField) => !on && (isAppOnlyType(field.type) || !!field.parent_id);
  const persistedId = (field: CustomField) => !!field.id && !field.id.startsWith('temp-');

  const renderFieldRow = (field: CustomField, i: number, child: boolean, siblings: CustomField[]) => {
    const locked = lockedWhenOff(field);
    const canMove = canReorder && siblings.length > 1;
    return (
      <div key={field.id || i} className={`flex items-center gap-3 p-3 bg-zinc-50 rounded-lg border group ${child ? 'bg-white' : ''}`}>
        {child
          ? <CornerDownRight className="w-4 h-4 text-zinc-300 shrink-0 rtl:-scale-x-100" />
          : <GripVertical className="w-4 h-4 text-zinc-300 cursor-grab shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{displayLabel(field)}</p>
            <Badge variant="secondary" className="text-[9px] shrink-0">{typeLabel(field.type)}</Badge>
            {field.is_required && <Badge className="text-[9px] shrink-0">{t('customField.required')}</Badge>}
            {locked && (
              <Badge variant="outline" className="text-[9px] shrink-0 border-amber-300 bg-amber-50 text-amber-700">
                <Lock aria-hidden /> {t('customField.requiresApp')}
              </Badge>
            )}
            {on && field.conditions && (field.conditions.rules?.length ?? 0) > 0 && (
              <Badge variant="outline" className="text-[9px] shrink-0 border-violet-200 text-violet-700">{t('customField.conditionalBadge')}</Badge>
            )}
            {on && field.pricing && (
              <Badge variant="outline" className="text-[9px] shrink-0 border-emerald-200 text-emerald-700">{t('customField.pricedBadge')}</Badge>
            )}
            {on && field.preset_key && (
              <Badge variant="outline" className="text-[9px] shrink-0 font-mono" title={t('customField.presetBadge')}>{field.preset_key}</Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">{field.name}</p>
          {field.validation_rules && (
            <div className="flex gap-1 mt-1">
              {field.validation_rules.max_length && <Badge variant="outline" className="text-[8px]">{t('customField.maxBadge')}: {field.validation_rules.max_length}</Badge>}
              {field.validation_rules.pattern && <Badge variant="outline" className="text-[8px]">{t('customField.patternBadge')}: {field.validation_rules.pattern}</Badge>}
              {field.validation_rules.allowed_chars && <Badge variant="outline" className="text-[8px]">{t('customField.charsBadge')}: {field.validation_rules.allowed_chars}</Badge>}
            </div>
          )}
          {field.linked_validation && rawLinkTarget(field.linked_validation) && (
            <Badge variant="outline" className="text-[8px] mt-1 border-blue-200 text-blue-600">
              {t('customField.linkedBadge')}:{' '}
              {field.linked_validation.type === 'max_combined'
                ? t('customField.maxCombined')
                : field.linked_validation.type === 'equal_length'
                  ? t('customField.equalLength')
                  : field.linked_validation.type}
              {' → '}
              <span dir="ltr" className="font-mono">
                {linkTargetName(rawLinkTarget(field.linked_validation), fields, field.id)}
              </span>
              {field.linked_validation.type === 'max_combined' && field.linked_validation.max != null &&
                ` (${t('customField.maxBadge')}: ${field.linked_validation.max})`}
              {field.linked_validation.fill_char && ` (${t('customField.fillLabel')}: ${field.linked_validation.fill_char})`}
            </Badge>
          )}
          {field.linked_validation && rawLinkTarget(field.linked_validation) &&
            !linkTargetResolves(rawLinkTarget(field.linked_validation), fields, field.id) && (
            <Badge variant="outline" className="text-[8px] mt-1 ms-1 border-amber-300 bg-amber-50 text-amber-700">
              <AlertTriangle aria-hidden />
              {t('customField.linkTargetDangling')}
            </Badge>
          )}
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 shrink-0">
          {canMove && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500" disabled={i === 0} title={t('customField.moveUp')} aria-label={t('customField.moveUp')} onClick={() => onMove(siblings, i, -1)}>
                <ArrowUp className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500" disabled={i === siblings.length - 1} title={t('customField.moveDown')} aria-label={t('customField.moveDown')} onClick={() => onMove(siblings, i, 1)}>
                <ArrowDown className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          {on && persistedId(field) && !child && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500" title={t('customField.saveToLibrary')} aria-label={t('customField.saveToLibrary')} onClick={() => onSaveToLibrary(field)}>
              <BookmarkPlus className="w-3.5 h-3.5" />
            </Button>
          )}
          {!locked && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500" onClick={() => onEdit(field)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => field.id && onDelete(field.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  if (fields.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
        {t('customField.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {topLevelFields.map((field, i) => {
        const kids = childrenOf(field.id);
        if (field.type !== 'REPEATER' && kids.length === 0) return renderFieldRow(field, i, false, topLevelFields);
        return (
          <div key={field.id || i} className="space-y-1.5">
            {renderFieldRow(field, i, false, topLevelFields)}
            <div className="ms-7 space-y-1.5 border-s ps-3">
              {kids.map((kid, j) => renderFieldRow(kid, j, true, kids))}
              {on && field.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-primary"
                  onClick={() => onAddChild(field.id!)}
                >
                  <Plus className="w-3 h-3 me-1" /> {t('customField.addChildField')}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
