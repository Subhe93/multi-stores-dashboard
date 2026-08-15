'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Check, Languages, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { findSectionSchema, type FieldDefinition } from '@/lib/section-schemas';
import type { SectionInstance } from './types';

// Field types the plain-text translator can handle. Rich text is skipped —
// the provider mangles HTML markup.
const TRANSLATABLE_TYPES = new Set(['text', 'textarea']);

// How many translate-text requests run concurrently.
const POOL_SIZE = 4;

interface TranslatePageDialogProps {
  sections: SectionInstance[];
  primaryLocale: string;
  secondaryLocales: string[];
  token: string;
  // Receives the sections with the new target-locale translations merged in
  // (already persisted server-side) so the builder updates local state.
  onApplied: (updated: SectionInstance[]) => void;
}

// One translatable string queued for the provider. `assign` writes the
// translated value into the prepared target-content object.
interface StringJob {
  source: string;
  target: string;
  assign: (value: string) => void;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function TranslatePageDialog({
  sections,
  primaryLocale,
  secondaryLocales,
  token,
  onApplied,
}: TranslatePageDialogProps) {
  const t = useTranslations('builder');
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<Set<string>>(new Set(secondaryLocales));
  const [overwrite, setOverwrite] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{ translated: number; failed: number } | null>(null);

  if (secondaryLocales.length === 0) return null;

  const toggleTarget = (locale: string) => {
    setTargets((prev) => {
      const next = new Set(prev);
      if (next.has(locale)) next.delete(locale);
      else next.add(locale);
      return next;
    });
  };

  async function run() {
    const selected = secondaryLocales.filter((l) => targets.has(l));
    if (selected.length === 0 || running) return;
    setRunning(true);
    setResult(null);

    // Prepared content per section per target locale + the jobs feeding it.
    const prepared = new Map<string, Map<string, Record<string, unknown>>>();
    const jobs: StringJob[] = [];

    for (const section of sections) {
      const schema = findSectionSchema(section.section_key);
      if (!schema) continue;
      const primary = section.translations.find((tr) => tr.locale === primaryLocale)?.content;
      if (!primary || Object.keys(primary).length === 0) continue;
      const defs = schema.schema.filter((f) => schema.translatable.includes(f.key));

      for (const target of selected) {
        const existing = clone(
          section.translations.find((tr) => tr.locale === target)?.content ?? {},
        );
        let touched = false;

        for (const def of defs) {
          const src = primary[def.key];
          if (TRANSLATABLE_TYPES.has(def.type)) {
            if (typeof src !== 'string' || !src.trim()) continue;
            const current = existing[def.key];
            if (!overwrite && typeof current === 'string' && current.trim()) continue;
            touched = true;
            jobs.push({
              source: src,
              target,
              assign: (value) => {
                existing[def.key] = value;
              },
            });
          } else if (def.type === 'repeater' && Array.isArray(src) && src.length > 0) {
            const current = existing[def.key];
            if (!overwrite && Array.isArray(current) && current.length > 0) continue;
            // Copy the whole repeater (images/urls/numbers ride along), then
            // translate only its plain-text subfields.
            const copy = clone(src) as Record<string, unknown>[];
            existing[def.key] = copy;
            touched = true;
            const subDefs = (def.fields ?? []).filter((f: FieldDefinition) =>
              TRANSLATABLE_TYPES.has(f.type),
            );
            copy.forEach((item) => {
              for (const sub of subDefs) {
                const sv = item[sub.key];
                if (typeof sv !== 'string' || !sv.trim()) continue;
                jobs.push({
                  source: sv,
                  target,
                  assign: (value) => {
                    item[sub.key] = value;
                  },
                });
              }
            });
          }
        }

        if (touched) {
          const bySection = prepared.get(section.id) ?? new Map<string, Record<string, unknown>>();
          bySection.set(target, existing);
          prepared.set(section.id, bySection);
        }
      }
    }

    setProgress({ done: 0, total: jobs.length });
    let failed = 0;
    let done = 0;

    // Small worker pool so a large page doesn't fire hundreds of requests at
    // once. Failures keep the source text so nothing renders empty.
    const queue = [...jobs];
    async function worker() {
      for (;;) {
        const job = queue.shift();
        if (!job) return;
        try {
          const res = await api<{ translated: string }>('/translations/translate-text', {
            method: 'POST',
            token,
            body: JSON.stringify({
              text: job.source,
              source_locale: primaryLocale,
              target_locale: job.target,
            }),
          });
          job.assign(res.translated?.trim() ? res.translated : job.source);
        } catch {
          job.assign(job.source);
          failed += 1;
        }
        done += 1;
        setProgress({ done, total: jobs.length });
      }
    }
    await Promise.all(Array.from({ length: POOL_SIZE }, () => worker()));

    // Persist per section (one PUT carrying all target locales) and merge the
    // new rows into a local copy for the builder state.
    const updated: SectionInstance[] = clone(sections);
    for (const [sectionId, byLocale] of prepared) {
      const payload = Array.from(byLocale.entries()).map(([locale, content]) => ({
        locale,
        content,
      }));
      try {
        await api(`/v2/pages/sections/${sectionId}`, {
          method: 'PUT',
          token,
          body: JSON.stringify({ translations: payload }),
        });
        const row = updated.find((s) => s.id === sectionId);
        if (row) {
          for (const { locale, content } of payload) {
            const existingRow = row.translations.find((tr) => tr.locale === locale);
            if (existingRow) existingRow.content = content;
            else row.translations.push({ locale, content });
          }
        }
      } catch {
        failed += byLocale.size;
      }
    }

    // Apply whatever persisted (partial results included) to builder state.
    if (prepared.size > 0) onApplied(updated);

    setResult({ translated: jobs.length - failed, failed });
    setRunning(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (running) return; // don't close mid-run
        setOpen(next);
        if (next) {
          setTargets(new Set(secondaryLocales));
          setResult(null);
          setProgress({ done: 0, total: 0 });
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Languages className="w-3.5 h-3.5 me-1.5" />
            {t('translatePage')}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('translatePage')}</DialogTitle>
          <DialogDescription>
            {t('translatePageDesc', { locale: primaryLocale.toUpperCase() })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-zinc-600 mb-2">{t('translateTargets')}</p>
            <div className="flex flex-wrap gap-1.5">
              {secondaryLocales.map((locale) => {
                const active = targets.has(locale);
                return (
                  <button
                    key={locale}
                    type="button"
                    disabled={running}
                    onClick={() => toggleTarget(locale)}
                    className={
                      active
                        ? 'px-2.5 py-1 text-xs rounded-md border border-indigo-600 bg-indigo-50 text-indigo-700 font-medium'
                        : 'px-2.5 py-1 text-xs rounded-md border border-zinc-200 text-zinc-500 hover:border-zinc-300'
                    }
                  >
                    {locale.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={overwrite}
              disabled={running}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="rounded border-zinc-300"
            />
            {t('translateOverwrite')}
          </label>

          {running && (
            <div className="space-y-1.5">
              <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-[width] duration-200"
                  style={{
                    width: progress.total
                      ? `${Math.round((progress.done / progress.total) * 100)}%`
                      : '10%',
                  }}
                />
              </div>
              <p className="text-[11px] text-zinc-500">
                {t('translateProgress', { done: progress.done, total: progress.total })}
              </p>
            </div>
          )}

          {result && !running && (
            <p
              className={
                result.failed > 0
                  ? 'text-[11px] text-amber-600 flex items-center gap-1'
                  : 'text-[11px] text-emerald-600 flex items-center gap-1'
              }
            >
              {result.failed > 0 ? (
                <AlertCircle className="w-3.5 h-3.5" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              {result.failed > 0
                ? t('translatePartial', { count: result.translated, failed: result.failed })
                : t('translateDone', { count: result.translated })}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={running}
              onClick={() => setOpen(false)}
            >
              {t('translateClose')}
            </Button>
            <Button size="sm" disabled={running || targets.size === 0} onClick={() => void run()}>
              {running ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" />
                  {t('translateRunning')}
                </>
              ) : (
                t('translateStart')
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
