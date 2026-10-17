'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { DryRunSummary } from '@/lib/importer.api';
import { TechDetail, useWarningLabel } from '@/components/importer/ImporterBits';

interface WarningGroupsProps {
  warnings: NonNullable<DryRunSummary['warnings']>;
}

/** Report warnings grouped by code, with counts and expandable samples (§13). */
export function WarningGroups({ warnings }: WarningGroupsProps) {
  const t = useTranslations('creator.importer.report');
  const label = useWarningLabel();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const groups = Object.entries(warnings)
    .filter(([, g]) => g && g.count > 0)
    .sort((a, b) => b[1].count - a[1].count);

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('noWarnings')}</p>;
  }

  return (
    <div className="divide-y rounded-lg border bg-white">
      {groups.map(([code, group]) => {
        const samples = group.samples ?? [];
        const expanded = !!open[code];
        return (
          <div key={code}>
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [code]: !o[code] }))}
              disabled={samples.length === 0}
              aria-expanded={expanded}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-zinc-50 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <TriangleAlert className="size-4 shrink-0 text-amber-500" />
              <span className="min-w-0 flex-1" title={code}>
                <span className="block text-sm font-medium">{label(code)}</span>
                <TechDetail value={code} block />
              </span>
              <Badge variant="outline" className="tabular-nums">
                {group.count}
              </Badge>
              {samples.length > 0 && (
                <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
              )}
            </button>
            {expanded && samples.length > 0 && (
              <div className="overflow-x-auto border-t bg-zinc-50/60 px-3 py-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="py-1 pe-3 text-start font-medium">{t('sampleRef')}</th>
                      <th className="py-1 pe-3 text-start font-medium">{t('sampleTitle')}</th>
                      <th className="py-1 text-start font-medium">{t('sampleMessage')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {samples.map((s, i) => (
                      <tr key={i} className="align-top">
                        <td className="py-1 pe-3 whitespace-nowrap" title={s.external_ref ?? undefined}>
                          {s.title ? <TechDetail value={s.external_ref} /> : <span className="font-mono" dir="ltr">{s.external_ref ?? '—'}</span>}
                        </td>
                        <td className="py-1 pe-3">{s.title ?? '—'}</td>
                        <td className="py-1 break-words">{s.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {group.count > samples.length && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t('moreSamples', { count: group.count - samples.length })}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
