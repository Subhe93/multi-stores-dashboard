'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Loader2, Monitor, Smartphone, Tablet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEVICE_WIDTHS, type DevicePreset, type SectionInstance } from './types';

interface LivePreviewProps {
  webOrigin: string;
  storeSlug: string;
  storeLocale: string;
  themeKey: string;
  themeCustomizations: Record<string, unknown>;
  sections: SectionInstance[];
  primaryLocale: string;
  // Page type drives which preview chrome to load — PRODUCT_TEMPLATE needs the
  // storefront to fetch a sample product so magic sections render with data.
  pageType?: 'HOME' | 'STATIC' | 'LANDING' | 'PRODUCT_TEMPLATE' | 'HEADER' | 'FOOTER';
  // Creator's navigation menus — forwarded so header/footer sections resolve a
  // selected menu key to its items in the preview (kept fresh from the dashboard).
  menus?: unknown[];
  onSectionClicked?: (sectionId: string) => void;
}

export interface LivePreviewHandle {
  scrollToSection: (sectionId: string) => void;
}

const DEVICES: { key: DevicePreset; label: string; Icon: typeof Monitor }[] = [
  { key: 'mobile', label: 'Mobile', Icon: Smartphone },
  { key: 'tablet', label: 'Tablet', Icon: Tablet },
  { key: 'desktop', label: 'Desktop', Icon: Monitor },
];

export const LivePreview = forwardRef<LivePreviewHandle, LivePreviewProps>(function LivePreview(
  {
    webOrigin,
    storeSlug,
    storeLocale,
    themeKey,
    themeCustomizations,
    sections,
    primaryLocale,
    pageType,
    menus,
    onSectionClicked,
  },
  ref,
) {
  const [device, setDevice] = useState<DevicePreset>('desktop');
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const typeParam = pageType ? `&type=${pageType}` : '';
  const previewUrl = `${webOrigin}/builder-preview/${storeSlug}?locale=${storeLocale}${typeParam}`;

  // Push state into the iframe whenever inputs change. The iframe acks 'PREVIEW_READY'
  // on first mount; we resend on every change after that.
  useEffect(() => {
    if (!loaded) return;
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'UPDATE_SECTIONS',
        themeKey,
        customizations: themeCustomizations,
        sections,
        locale: storeLocale,
        primaryLocale,
        menus,
      },
      '*',
    );
  }, [loaded, themeKey, themeCustomizations, sections, storeLocale, primaryLocale, menus]);

  // Listen for PREVIEW_READY (initial) and SECTION_CLICKED (click-to-edit).
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'PREVIEW_READY') {
        setLoaded(true);
        // Resend state immediately so the first paint shows current edits.
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: 'UPDATE_SECTIONS',
            themeKey,
            customizations: themeCustomizations,
            sections,
            locale: storeLocale,
            primaryLocale,
            menus,
          },
          '*',
        );
      } else if (data.type === 'SECTION_CLICKED' && onSectionClicked) {
        onSectionClicked(data.section_id);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSectionClicked]);

  useImperativeHandle(ref, () => ({
    scrollToSection(sectionId: string) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'SCROLL_TO_SECTION', section_id: sectionId },
        '*',
      );
    },
  }));

  const width = DEVICE_WIDTHS[device];

  return (
    <div className="h-full flex flex-col bg-zinc-100">
      <div className="flex items-center justify-center gap-1 px-3 py-2 border-b bg-white">
        {DEVICES.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setDevice(key)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition',
              device === key
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100',
            )}
            title={label}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto flex items-start justify-center p-4 relative">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
          </div>
        )}
        <div
          className="bg-white rounded-md shadow-sm transition-[width] duration-200 overflow-hidden"
          style={{ width, maxWidth: '100%', height: '100%' }}
        >
          <iframe
            ref={iframeRef}
            src={previewUrl}
            title="Storefront preview"
            className="w-full h-full border-0 block"
            // No sandbox here — same-origin scripts need free run to render the
            // storefront. Restrict in prod once a separate preview origin is set up.
          />
        </div>
      </div>
    </div>
  );
});
