'use client';

import { useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Pencil, ChevronDown, ChevronUp, HelpCircle, Languages, Loader2, GripVertical } from 'lucide-react';
import { LocaleTabs, filledLocales, useTranslationPlaceholder } from '@/components/common/LocaleTabs';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { CONTENT_LOCALE_LABELS } from '@/lib/contentLocales';

export interface Faq {
  id?: string;
  sort_order: number;
  translations: { locale: string; question: string; answer: string }[];
}

interface FaqManagerProps {
  productId?: string;
  faqs: Faq[];
  onChange: (faqs: Faq[]) => void;
  locales: string[];
  primaryLocale: string;
  /** Override the POST URL for creating a new FAQ (default: /products/:productId/faqs) */
  createUrl?: string;
  /** Override the base URL for PUT/DELETE on a specific FAQ (default: /faqs/:id) */
  faqBaseUrl?: string;
  /** Override the PUT URL that saves a new order (default: /products/:productId/faqs/sort) */
  sortUrl?: string;
}

const LOCALE_LABELS: Record<string, string> = CONTENT_LOCALE_LABELS;

export default function FaqManager({
  productId,
  faqs,
  onChange,
  locales,
  primaryLocale,
  createUrl,
  faqBaseUrl,
  sortUrl,
}: FaqManagerProps) {
  const t = useTranslations();
  const { token } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [activeLocale, setActiveLocale] = useState(primaryLocale);
  const translationPlaceholder = useTranslationPlaceholder();
  const [formData, setFormData] = useState<Record<string, { question: string; answer: string }>>({});
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [translatingLocale, setTranslatingLocale] = useState('');
  const [reorderError, setReorderError] = useState(false);

  // Stable drag ids: the saved id, else one per draft object (create mode).
  const draftIds = useRef(new WeakMap<Faq, string>());
  const dragId = (faq: Faq) => {
    if (faq.id) return faq.id;
    let id = draftIds.current.get(faq);
    if (!id) {
      id = `draft-${Math.random().toString(36).slice(2)}`;
      draftIds.current.set(faq, id);
    }
    return id;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // New order: shown at once, sort_order renumbered (drafts are created in
  // that order), saved right away for a stored product; reverted on failure.
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = faqs.map(dragId);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const before = faqs;
    const next = arrayMove(faqs, from, to).map((f, i) => {
      const copy = { ...f, sort_order: i };
      // Keep a draft's drag id on its renumbered copy.
      if (!f.id) draftIds.current.set(copy, dragId(f));
      return copy;
    });
    setExpandedIndex(null);
    setReorderError(false);
    onChange(next);
    if (!productId || !token || next.some((f) => !f.id)) return;
    try {
      await api(sortUrl || `/products/${productId}/faqs/sort`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ faq_ids: next.map((f) => f.id) }),
      });
    } catch {
      onChange(before);
      setReorderError(true);
    }
  };

  const handleTranslateTo = async (targetLocale: string) => {
    const sourceQuestion = formData[primaryLocale]?.question || '';
    const sourceAnswer = formData[primaryLocale]?.answer || '';
    if (!sourceQuestion.trim() || translatingLocale) return;
    setTranslatingLocale(targetLocale);
    try {
      const tasks: Promise<{ translated: string }>[] = [
        api<{ translated: string }>('/translations/translate-text', {
          method: 'POST',
          token: token ?? undefined,
          body: JSON.stringify({ text: sourceQuestion, source_locale: primaryLocale, target_locale: targetLocale }),
        }),
      ];
      if (sourceAnswer.trim()) {
        tasks.push(
          api<{ translated: string }>('/translations/translate-text', {
            method: 'POST',
            token: token ?? undefined,
            body: JSON.stringify({ text: sourceAnswer, source_locale: primaryLocale, target_locale: targetLocale }),
          }),
        );
      }
      const [qRes, aRes] = await Promise.all(tasks);
      setFormData((prev) => ({
        ...prev,
        [targetLocale]: {
          question: qRes?.translated || prev[targetLocale]?.question || '',
          answer: aRes?.translated || prev[targetLocale]?.answer || '',
        },
      }));
    } catch {
      // silent
    } finally {
      setTranslatingLocale('');
    }
  };

  const openAdd = () => {
    setEditIndex(null);
    const data: Record<string, { question: string; answer: string }> = {};
    locales.forEach((l) => { data[l] = { question: '', answer: '' }; });
    setFormData(data);
    setActiveLocale(primaryLocale);
    setShowDialog(true);
  };

  const openEdit = (index: number) => {
    setEditIndex(index);
    const faq = faqs[index];
    const data: Record<string, { question: string; answer: string }> = {};
    locales.forEach((l) => {
      const t = faq.translations.find((tr) => tr.locale === l);
      data[l] = { question: t?.question || '', answer: t?.answer || '' };
    });
    setFormData(data);
    setActiveLocale(primaryLocale);
    setShowDialog(true);
  };

  const handleSave = async () => {
    const translations = Object.entries(formData)
      .filter(([, v]) => v.question.trim())
      .map(([locale, v]) => ({ locale, question: v.question, answer: v.answer }));

    if (translations.length === 0) return;

    if (editIndex !== null) {
      const faq = faqs[editIndex];
      if (faq.id && productId && token) {
        const updateUrl = faqBaseUrl ? `${faqBaseUrl}/${faq.id}` : `/faqs/${faq.id}`;
        await api(updateUrl, {
          method: 'PUT',
          token,
          body: JSON.stringify({ translations }),
        });
      }
      const updated = [...faqs];
      updated[editIndex] = { ...updated[editIndex], translations };
      onChange(updated);
    } else {
      if (productId && token) {
        const postUrl = createUrl || `/products/${productId}/faqs`;
        const created = await api<Faq>(postUrl, {
          method: 'POST',
          token,
          body: JSON.stringify({ sort_order: faqs.length, translations }),
        });
        onChange([...faqs, created]);
      } else {
        onChange([...faqs, { sort_order: faqs.length, translations }]);
      }
    }
    setShowDialog(false);
  };

  const handleDelete = async (index: number) => {
    const faq = faqs[index];
    if (faq.id && productId && token) {
      const deleteUrl = faqBaseUrl ? `${faqBaseUrl}/${faq.id}` : `/faqs/${faq.id}`;
      await api(deleteUrl, { method: 'DELETE', token });
    }
    onChange(faqs.filter((_, i) => i !== index));
  };

  const primaryQ = (faq: Faq) =>
    faq.translations.find((tr) => tr.locale === primaryLocale)?.question ||
    faq.translations[0]?.question ||
    t('faq.untitled');

  const primaryA = (faq: Faq) =>
    faq.translations.find((t) => t.locale === primaryLocale)?.answer ||
    faq.translations[0]?.answer ||
    '';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{t('faq.title')}</span>
          <span className="text-xs text-muted-foreground">({faqs.length})</span>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={openAdd}>
          <Plus className="w-3 h-3 me-1" /> {t('faq.addFaq')}
        </Button>
      </div>

      {faqs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          {t('faq.empty')}
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={faqs.map(dragId)} strategy={verticalListSortingStrategy}>
            <div className="rounded-md border divide-y">
              {faqs.map((faq, i) => (
                <SortableFaqRow
                  key={dragId(faq)}
                  id={dragId(faq)}
                  question={primaryQ(faq)}
                  answer={primaryA(faq)}
                  expanded={expandedIndex === i}
                  dragLabel={t('faq.dragToReorder')}
                  onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
                  onEdit={() => openEdit(i)}
                  onDelete={() => handleDelete(i)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {reorderError && (
        <p role="alert" className="text-xs text-red-600">
          {t('faq.reorderFailed')}
        </p>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editIndex !== null ? t('faq.editFaq') : t('faq.addFaq')}</DialogTitle>
          </DialogHeader>

          {/* Language tabs */}
          <LocaleTabs
            className="-mx-6 px-6"
            value={activeLocale}
            onChange={setActiveLocale}
            locales={locales}
            primaryLocale={primaryLocale}
            filled={filledLocales(locales, formData, (row) => !!row?.question?.trim() && !!row?.answer?.trim())}
          />

          <div className="space-y-3 py-2">
            {/* Auto-translate from primary locale */}
            {activeLocale !== primaryLocale && (
              <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-lg border border-dashed">
                <span className="text-xs text-muted-foreground truncate">
                  {t('faq.autoTranslateFrom')} <strong>{LOCALE_LABELS[primaryLocale] || primaryLocale}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => handleTranslateTo(activeLocale)}
                  disabled={!!translatingLocale || !formData[primaryLocale]?.question?.trim()}
                  className="flex items-center gap-1 text-xs text-primary font-medium hover:underline disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ms-3"
                >
                  {translatingLocale === activeLocale ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> {t('faq.translating')}</>
                  ) : (
                    <><Languages className="w-3 h-3" /> {t('faq.autoTranslate')}</>
                  )}
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t('faq.question')} {activeLocale === primaryLocale && <span className="text-red-500">*</span>}
              </Label>
              <Input
                className="h-8 text-sm"
                placeholder={translationPlaceholder({
                  locale: activeLocale,
                  primaryLocale,
                  baseValue: formData[primaryLocale]?.question,
                  primaryPlaceholder: t('faq.questionPlaceholder'),
                })}
                value={formData[activeLocale]?.question || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    [activeLocale]: { ...prev[activeLocale], question: e.target.value },
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t('faq.answer')} {activeLocale === primaryLocale && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                rows={4}
                className="text-sm resize-none"
                placeholder={translationPlaceholder({
                  locale: activeLocale,
                  primaryLocale,
                  baseValue: formData[primaryLocale]?.answer,
                  primaryPlaceholder: t('faq.answerPlaceholder'),
                })}
                value={formData[activeLocale]?.answer || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    [activeLocale]: { ...prev[activeLocale], answer: e.target.value },
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!formData[primaryLocale]?.question?.trim()}
            >
              {editIndex !== null ? t('faq.update') : t('common.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** One FAQ row with a drag handle (pointer and keyboard: Space, arrows, Space). */
function SortableFaqRow({
  id,
  question,
  answer,
  expanded,
  dragLabel,
  onToggle,
  onEdit,
  onDelete,
}: {
  id: string;
  question: string;
  answer: string;
  expanded: boolean;
  dragLabel: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative bg-white px-3 py-2 ${isDragging ? 'shadow-md ring-1 ring-zinc-200' : ''}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={dragLabel}
          title={dragLabel}
          className="cursor-grab touch-none rounded p-1 text-muted-foreground transition hover:bg-zinc-100 active:cursor-grabbing shrink-0"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={onToggle} className="flex-1 min-w-0 text-start flex items-center gap-2">
          {expanded ? (
            <ChevronUp className="w-3 h-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium truncate">{question}</span>
        </button>
        <button type="button" onClick={onEdit} className="p-1 hover:bg-muted rounded transition shrink-0">
          <Pencil className="w-3 h-3 text-muted-foreground" />
        </button>
        <button type="button" onClick={onDelete} className="p-1 hover:bg-red-50 rounded transition shrink-0">
          <Trash2 className="w-3 h-3 text-red-500" />
        </button>
      </div>
      {expanded && <p className="text-xs text-muted-foreground mt-1.5 ms-11 whitespace-pre-wrap">{answer}</p>}
    </div>
  );
}
