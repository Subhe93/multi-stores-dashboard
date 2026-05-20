'use client';

import { useState } from 'react';
import { ArrowLeft, Check, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LocaleSwitcher } from './LocaleSwitcher';
import { VersionsDialog } from './VersionsDialog';
import { SeoDialog } from './SeoDialog';
import { PageSwitcher, type StorePageSummary } from './PageSwitcher';
import type { PageTranslationRow } from './types';

interface PublishBarProps {
  pageId: string;
  pageTitle: string;
  pageType: string;
  status: 'DRAFT' | 'PUBLISHED';
  storeUrl?: string;
  primaryLocale: string;
  secondaryLocales: string[];
  activeLocale: string;
  // All pages in the store — drives the page-switcher dropdown.
  allPages: StorePageSummary[];
  // SEO panel data
  seo: Record<string, unknown>;
  translations: PageTranslationRow[];
  onLocaleChange: (l: string) => void;
  onBack: () => void;
  onPublish: () => Promise<void>;
  onRestored: () => Promise<void> | void;
  onSeoSaved: () => Promise<void> | void;
  // Manually clear the storefront cache so the latest publish shows immediately.
  onFlushCache?: () => Promise<void>;
}

export function PublishBar({
  pageId,
  pageTitle,
  pageType,
  status,
  storeUrl,
  primaryLocale,
  secondaryLocales,
  activeLocale,
  allPages,
  seo,
  translations,
  onLocaleChange,
  onBack,
  onPublish,
  onRestored,
  onSeoSaved,
  onFlushCache,
}: PublishBarProps) {
  const [publishing, setPublishing] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [justFlushed, setJustFlushed] = useState(false);

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b bg-white">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <PageSwitcher
          currentPageId={pageId}
          currentPageType={pageType}
          currentPageTitle={pageTitle}
          currentStatus={status}
          locale={activeLocale}
          primaryLocale={primaryLocale}
          pages={allPages}
        />
      </div>

      <div className="flex items-center gap-2">
        <LocaleSwitcher
          primary={primaryLocale}
          secondary={secondaryLocales}
          active={activeLocale}
          onChange={onLocaleChange}
        />
        <SeoDialog
          pageId={pageId}
          pageType={pageType}
          initialSeo={seo}
          initialTranslations={translations}
          primaryLocale={primaryLocale}
          secondaryLocales={secondaryLocales}
          activeLocale={activeLocale}
          onSaved={onSeoSaved}
        />
        <VersionsDialog pageId={pageId} onRestored={onRestored} />
        {onFlushCache && (
          <Button
            variant="outline"
            size="sm"
            disabled={flushing}
            onClick={async () => {
              setFlushing(true);
              setJustFlushed(false);
              try {
                await onFlushCache();
                setJustFlushed(true);
                setTimeout(() => setJustFlushed(false), 2500);
              } finally {
                setFlushing(false);
              }
            }}
            title="Clear the storefront cache to show your latest changes immediately"
          >
            {flushing ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : justFlushed ? (
              <Check className="w-3.5 h-3.5 mr-1.5" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            )}
            {justFlushed ? 'Cleared' : 'Clear Cache'}
          </Button>
        )}
        {storeUrl && (
          <a href={storeUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              View
            </Button>
          </a>
        )}
        <Button
          size="sm"
          disabled={publishing}
          onClick={async () => {
            setPublishing(true);
            setJustPublished(false);
            try {
              await onPublish();
              setJustPublished(true);
              setTimeout(() => setJustPublished(false), 2500);
            } finally {
              setPublishing(false);
            }
          }}
        >
          {publishing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Publishing…
            </>
          ) : justPublished ? (
            <>
              <Check className="w-3.5 h-3.5 mr-1.5" />
              Published
            </>
          ) : (
            'Publish'
          )}
        </Button>
      </div>
    </div>
  );
}
