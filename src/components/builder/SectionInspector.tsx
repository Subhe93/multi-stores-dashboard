'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Settings2, Sparkles, Trash2, Type, MoreHorizontal, Copy } from 'lucide-react';
import { findSectionSchema, labelOf } from '@/lib/section-schemas';
import { cn } from '@/lib/utils';
import { FieldRenderer } from './fields/FieldRenderer';
import { SectionPreview } from './SectionPreviews';
import { StylePanel, type SectionStyle } from './StylePanel';
import type { SectionInstance } from './types';

interface SectionInspectorProps {
  section: SectionInstance | null;
  locale: string;
  primaryLocale: string;
  token: string;
  apiBase: string;
  onPatchSettings: (sectionId: string, partial: Record<string, unknown>) => void;
  onPatchContent: (sectionId: string, locale: string, partial: Record<string, unknown>) => void;
  onDelete: (sectionId: string) => void;
  onToggleHidden: (sectionId: string, hidden: boolean) => void;
}

type Tab = 'content' | 'settings' | 'style';

/**
 * Elementor-style right-pane editor. Three-tab layout (Content / Settings /
 * Style) with a polished header, sticky tab bar, and full-bleed scrollable
 * body. The header shows the section identity and quick actions; tabs use an
 * animated indicator + icon stack reminiscent of Elementor 3.x.
 */
export function SectionInspector({
  section,
  locale,
  primaryLocale,
  token,
  apiBase,
  onPatchSettings,
  onPatchContent,
  onDelete,
  onToggleHidden,
}: SectionInspectorProps) {
  const t = useTranslations('builder');
  const tc = useTranslations('common');
  const [tab, setTab] = useState<Tab>('content');
  const [menuOpen, setMenuOpen] = useState(false);

  if (!section) {
    return <EmptyState />;
  }

  const schema = findSectionSchema(section.section_key);
  if (!schema) {
    return (
      <div className="h-full flex items-center justify-center p-6 bg-white">
        <div className="text-center max-w-60">
          <div className="size-12 mx-auto mb-3 rounded-full bg-red-50 flex items-center justify-center">
            <Settings2 className="size-5 text-red-400" />
          </div>
          <p className="text-xs text-zinc-600 leading-relaxed">
            {t('unknownSectionType')}
          </p>
          <code className="font-mono text-[11px] text-red-500 block mt-1">{section.section_key}</code>
        </div>
      </div>
    );
  }

  const translatableKeys = new Set(schema.translatable);
  const settingsFields = schema.schema.filter((f) => !translatableKeys.has(f.key));
  const contentFields = schema.schema.filter((f) => translatableKeys.has(f.key));

  const localeContent =
    section.translations.find((tr) => tr.locale === locale)?.content ??
    section.translations.find((tr) => tr.locale === primaryLocale)?.content ??
    {};

  const sectionStyle = ((section.settings as Record<string, unknown>)._style as SectionStyle | undefined) || {};

  const tabs: { id: Tab; label: string; Icon: typeof Type; count?: number; show: boolean }[] = [
    { id: 'content', label: t('tabContent'), Icon: Type, count: contentFields.length, show: contentFields.length > 0 },
    { id: 'settings', label: t('tabSettings'), Icon: Settings2, count: settingsFields.length, show: settingsFields.length > 0 },
    { id: 'style', label: t('tabStyle'), Icon: Sparkles, show: true },
  ];
  const visibleTabs = tabs.filter((tb) => tb.show);
  const activeTab = visibleTabs.find((tb) => tb.id === tab) ? tab : visibleTabs[0]?.id;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* ─── Identity header ─────────────────────────────────── */}
      <header className="relative shrink-0 border-b border-zinc-200/80 bg-gradient-to-b from-zinc-50/80 to-white">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start gap-3">
            <div className="relative size-11 rounded-lg border border-zinc-200 bg-white overflow-hidden shrink-0 shadow-sm">
              <SectionPreview sectionKey={section.section_key} className="w-full h-full" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9.5px] uppercase tracking-[0.14em] text-indigo-600 font-bold">
                  {schema.category}
                </span>
                {section.is_hidden && (
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-semibold">
                    {t('hidden')}
                  </span>
                )}
              </div>
              <h2 className="text-[13.5px] font-semibold leading-tight text-zinc-900 truncate">
                {labelOf(schema.label, locale)}
              </h2>
              {schema.description && (
                <p className="text-[11px] text-zinc-500 leading-snug mt-1 line-clamp-2">
                  {labelOf(schema.description, locale)}
                </p>
              )}
            </div>

            {/* Overflow menu */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setMenuOpen((p) => !p)}
                onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
                className="size-7 inline-flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition"
              >
                <MoreHorizontal className="size-4" />
              </button>
              {menuOpen && (
                <div className="absolute inset-e-0 top-full mt-1 z-20 min-w-40 rounded-lg border border-zinc-200 bg-white shadow-lg p-1">
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onToggleHidden(section.id, !section.is_hidden);
                      setMenuOpen(false);
                    }}
                    className="w-full text-start flex items-center gap-2 px-2 py-1.5 text-[12px] rounded text-zinc-700 hover:bg-zinc-100"
                  >
                    {section.is_hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    {section.is_hidden ? t('showSection') : t('hideSection')}
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onDelete(section.id);
                      setMenuOpen(false);
                    }}
                    className="w-full text-start flex items-center gap-2 px-2 py-1.5 text-[12px] rounded text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5" />
                    {tc('delete')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Tab bar (Elementor-style: icon stack + indicator) ── */}
        <div className="flex items-stretch px-2 -mb-px relative">
          {visibleTabs.map((tb) => {
            const isActive = activeTab === tb.id;
            return (
              <button
                key={tb.id}
                type="button"
                onClick={() => setTab(tb.id)}
                className={cn(
                  'group relative flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11.5px] font-semibold transition-colors',
                  isActive
                    ? 'text-indigo-600'
                    : 'text-zinc-500 hover:text-zinc-900',
                )}
              >
                <tb.Icon className={cn('size-3.5 transition', isActive && 'scale-110')} />
                <span>{tb.label}</span>
                {typeof tb.count === 'number' && tb.count > 0 && (
                  <span className={cn(
                    'text-[9.5px] font-bold px-1.5 py-0.5 rounded-full leading-none transition',
                    isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-100 text-zinc-500',
                  )}>
                    {tb.count}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 inset-x-2 h-[2px] rounded-t bg-indigo-600" />
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* ─── Tab body ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto inspector-scroll">
        {activeTab === 'content' && contentFields.length > 0 && (
          <div className="p-4 space-y-4">
            {locale !== primaryLocale && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200/70 px-3 py-2 text-[11px] text-amber-900">
                <Copy className="size-3.5 mt-px shrink-0 text-amber-600" />
                <span className="leading-relaxed">
                  {t('fallbackToPrimary', { locale: primaryLocale })}
                </span>
              </div>
            )}
            <FieldGroup title={t('contentGroup')}>
              {contentFields.map((field) => (
                <FieldRenderer
                  key={field.key}
                  field={field}
                  value={localeContent[field.key]}
                  onChange={(v) => onPatchContent(section.id, locale, { [field.key]: v })}
                  locale={locale}
                  token={token}
                  apiBase={apiBase}
                />
              ))}
            </FieldGroup>
          </div>
        )}

        {activeTab === 'settings' && settingsFields.length > 0 && (
          <div className="p-4 space-y-4">
            <FieldGroup title={t('sectionSettings')}>
              {settingsFields.map((field) => (
                <FieldRenderer
                  key={field.key}
                  field={field}
                  value={section.settings[field.key]}
                  onChange={(v) => onPatchSettings(section.id, { [field.key]: v })}
                  locale={locale}
                  token={token}
                  apiBase={apiBase}
                />
              ))}
            </FieldGroup>
          </div>
        )}

        {activeTab === 'style' && (
          <div className="p-4">
            <StylePanel
              value={sectionStyle}
              onChange={(next) => onPatchSettings(section.id, { _style: next })}
              locale={locale}
              token={token}
              apiBase={apiBase}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** Empty state — shown when no section is selected. */
function EmptyState() {
  const t = useTranslations('builder');
  return (
    <div className="h-full flex items-center justify-center p-6 bg-gradient-to-b from-zinc-50/40 to-white">
      <div className="text-center max-w-65">
        <div className="relative mx-auto mb-4 size-16">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-100 via-white to-purple-100 border border-zinc-200/70 shadow-sm" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="size-6 text-indigo-500" strokeWidth={1.75} />
          </div>
        </div>
        <h3 className="text-[13px] font-semibold text-zinc-900 mb-1.5">
          {t('noSectionSelected')}
        </h3>
        <p className="text-[11.5px] text-zinc-500 leading-relaxed">
          {t('noSectionSelectedDesc')}
        </p>
      </div>
    </div>
  );
}

/**
 * Collapsible group container — Elementor-style accordion. Used inside the
 * Content/Settings tabs to give visual chunking to long forms. Defaults open
 * since most sections only have one group; can be collapsed by the user.
 */
function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-lg border border-zinc-200/80 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-zinc-50/70 hover:bg-zinc-100/70 transition border-b border-zinc-200/60"
      >
        <span className="text-[10.5px] uppercase tracking-[0.12em] font-bold text-zinc-700">
          {title}
        </span>
        <svg
          className={cn('size-3.5 text-zinc-400 transition-transform', !open && '-rotate-90')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="p-3 space-y-3">
          {children}
        </div>
      )}
    </section>
  );
}
