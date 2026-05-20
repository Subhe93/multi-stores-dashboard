'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Pencil, ChevronDown, ChevronUp, HelpCircle, Languages, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

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
}

const LOCALE_LABELS: Record<string, string> = {
  en: 'English', ar: 'العربية', tr: 'Türkçe', de: 'Deutsch', fr: 'Français',
};

export default function FaqManager({
  productId,
  faqs,
  onChange,
  locales,
  primaryLocale,
  createUrl,
  faqBaseUrl,
}: FaqManagerProps) {
  const { token } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [activeLocale, setActiveLocale] = useState(primaryLocale);
  const [formData, setFormData] = useState<Record<string, { question: string; answer: string }>>({});
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [translatingLocale, setTranslatingLocale] = useState('');

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
    faq.translations.find((t) => t.locale === primaryLocale)?.question ||
    faq.translations[0]?.question ||
    'Untitled';

  const primaryA = (faq: Faq) =>
    faq.translations.find((t) => t.locale === primaryLocale)?.answer ||
    faq.translations[0]?.answer ||
    '';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">FAQ</span>
          <span className="text-xs text-muted-foreground">({faqs.length})</span>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={openAdd}>
          <Plus className="w-3 h-3 mr-1" /> Add FAQ
        </Button>
      </div>

      {faqs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No FAQs yet. Add frequently asked questions about this product.
        </p>
      ) : (
        <div className="rounded-md border divide-y">
          {faqs.map((faq, i) => (
            <div key={faq.id || i} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                  className="flex-1 text-left flex items-center gap-2"
                >
                  {expandedIndex === i ? (
                    <ChevronUp className="w-3 h-3 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-sm font-medium truncate">{primaryQ(faq)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(i)}
                  className="p-1 hover:bg-muted rounded transition shrink-0"
                >
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(i)}
                  className="p-1 hover:bg-red-50 rounded transition shrink-0"
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </button>
              </div>
              {expandedIndex === i && (
                <p className="text-xs text-muted-foreground mt-1.5 ml-5 whitespace-pre-wrap">
                  {primaryA(faq)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editIndex !== null ? 'Edit FAQ' : 'Add FAQ'}</DialogTitle>
          </DialogHeader>

          {/* Language tabs */}
          {locales.length > 1 && (
            <div className="flex items-center gap-0 border-b -mx-6 px-6">
              {locales.map((locale) => (
                <button
                  key={locale}
                  type="button"
                  onClick={() => setActiveLocale(locale)}
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 transition -mb-px ${
                    locale === activeLocale
                      ? 'border-zinc-900 text-zinc-900'
                      : 'border-transparent text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  {LOCALE_LABELS[locale] || locale.toUpperCase()}
                  {locale === primaryLocale && <span className="text-[9px] text-zinc-400 ml-1">(primary)</span>}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-3 py-2">
            {/* Auto-translate from primary locale */}
            {activeLocale !== primaryLocale && (
              <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-lg border border-dashed">
                <span className="text-xs text-muted-foreground truncate">
                  Auto-translate from <strong>{LOCALE_LABELS[primaryLocale] || primaryLocale}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => handleTranslateTo(activeLocale)}
                  disabled={!!translatingLocale || !formData[primaryLocale]?.question?.trim()}
                  className="flex items-center gap-1 text-xs text-primary font-medium hover:underline disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ml-3"
                >
                  {translatingLocale === activeLocale ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Translating...</>
                  ) : (
                    <><Languages className="w-3 h-3" /> Auto-translate</>
                  )}
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Question {activeLocale === primaryLocale && <span className="text-red-500">*</span>}
              </Label>
              <Input
                className="h-8 text-sm"
                placeholder="e.g. What is the return policy?"
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
                Answer {activeLocale === primaryLocale && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                rows={4}
                className="text-sm resize-none"
                placeholder="Write the answer..."
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
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!formData[primaryLocale]?.question?.trim()}
            >
              {editIndex !== null ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
