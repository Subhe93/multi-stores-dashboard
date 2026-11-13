'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Monitor, Smartphone, Tablet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import {
  buildPreviewUpdateMessage,
  loadPreviewSampleProduct,
  type PreviewProduct,
} from '@/lib/previewSampleProduct';
import { DEVICE_WIDTHS, type DevicePreset, type SectionInstance } from './types';

type Translator = ReturnType<typeof useTranslations>;

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
  pageType?: 'HOME' | 'STATIC' | 'LANDING' | 'PRODUCT_TEMPLATE' | 'CATALOG_TEMPLATE' | 'COLLECTION_TEMPLATE' | 'HEADER' | 'FOOTER';
  // Creator's navigation menus — forwarded so header/footer sections resolve a
  // selected menu key to its items in the preview (kept fresh from the dashboard).
  menus?: unknown[];
  // Currently selected section — the preview draws a highlight frame around it.
  selectedId?: string | null;
  onSectionClicked?: (sectionId: string) => void;
  // Actions fired from the floating toolbar rendered inside the preview
  // (move-up / move-down / duplicate / hide / delete / select-parent).
  onSectionAction?: (sectionId: string, action: string) => void;
  // Double-click inline edits made directly inside the preview.
  onInlineEdit?: (sectionId: string, path: (string | number)[], value: string) => void;
  // Owner session token. On a PRODUCT_TEMPLATE the builder reads the sample
  // product with it and posts it to the preview, because the preview route
  // reads it anonymously and a store that is not LIVE refuses that read.
  token?: string | null;
}

export interface LivePreviewHandle {
  scrollToSection: (sectionId: string) => void;
}

function buildDevices(t: Translator): { key: DevicePreset; label: string; Icon: typeof Monitor }[] {
  return [
    { key: 'mobile', label: t('deviceMobile'), Icon: Smartphone },
    { key: 'tablet', label: t('deviceTablet'), Icon: Tablet },
    { key: 'desktop', label: t('deviceDesktop'), Icon: Monitor },
  ];
}

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
    selectedId,
    onSectionClicked,
    onSectionAction,
    onInlineEdit,
    token,
  },
  ref,
) {
  const t = useTranslations('builder');
  const DEVICES = buildDevices(t);
  const [device, setDevice] = useState<DevicePreset>('desktop');
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const typeParam = pageType ? `&type=${pageType}` : '';
  const previewUrl = `${webOrigin}/builder-preview/${storeSlug}?locale=${storeLocale}${typeParam}`;
  // Address the iframe explicitly instead of '*', and accept messages only from
  // it — otherwise any page holding a handle to this window could inject
  // UPDATE_SECTIONS / INLINE_EDIT / SECTION_ACTION.
  const previewOrigin = useMemo(() => {
    try {
      return new URL(previewUrl, window.location.href).origin;
    } catch {
      return window.location.origin;
    }
  }, [previewUrl]);

  // The full flat list, every row with an explicit parent_id (null = root), so
  // the storefront renderer can rebuild the container tree. Flat pages send
  // the same rows as before plus parent_id: null.
  const previewSections = useMemo(
    () => sections.map((s) => ({ ...s, parent_id: s.parent_id ?? null })),
    [sections],
  );

  // Sample product for a PRODUCT_TEMPLATE, read with the owner's token (see
  // previewSampleProduct.ts). Null until loaded or when there is none: the
  // message then carries no product and the preview keeps its own sample.
  // The loaded product is keyed by store, so a store switch never shows the
  // previous store's product while the new read is in flight.
  const [loadedSample, setLoadedSample] = useState<{ key: string; product: PreviewProduct | null } | null>(null);
  const wantsSample = pageType === 'PRODUCT_TEMPLATE' && !!token;
  const sampleKey = wantsSample ? storeSlug : '';
  const sampleProduct = sampleKey && loadedSample?.key === sampleKey ? loadedSample.product : null;
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  useEffect(() => {
    if (!sampleKey) return;
    let cancelled = false;
    loadPreviewSampleProduct(
      (endpoint) => api<unknown>(endpoint, { token: tokenRef.current ?? undefined }),
      sampleKey,
    ).then((product) => {
      if (!cancelled) setLoadedSample({ key: sampleKey, product });
    });
    return () => {
      cancelled = true;
    };
  }, [sampleKey]);

  const updateMessage = useMemo(
    () =>
      buildPreviewUpdateMessage({
        themeKey,
        customizations: themeCustomizations,
        sections: previewSections,
        locale: storeLocale,
        primaryLocale,
        menus,
        product: sampleProduct,
      }),
    [themeKey, themeCustomizations, previewSections, storeLocale, primaryLocale, menus, sampleProduct],
  );
  const updateMessageRef = useRef(updateMessage);
  useEffect(() => {
    updateMessageRef.current = updateMessage;
  }, [updateMessage]);

  // Push state into the iframe whenever inputs change. The iframe acks 'PREVIEW_READY'
  // on first mount; we resend on every change after that.
  useEffect(() => {
    if (!loaded) return;
    iframeRef.current?.contentWindow?.postMessage(updateMessage, previewOrigin);
  }, [loaded, updateMessage, previewOrigin]);

  // Keep the preview's selection highlight in sync with the builder.
  useEffect(() => {
    if (!loaded) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'SELECT_SECTION', section_id: selectedId ?? null },
      previewOrigin,
    );
  }, [loaded, selectedId, previewOrigin]);

  // Listen for PREVIEW_READY (initial) and SECTION_CLICKED (click-to-edit).
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      // Only the preview iframe may drive the builder.
      if (e.origin !== previewOrigin) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'PREVIEW_READY') {
        setLoaded(true);
        // Resend state immediately so the first paint shows current edits.
        iframeRef.current?.contentWindow?.postMessage(updateMessageRef.current, previewOrigin);
      } else if (data.type === 'SECTION_CLICKED' && onSectionClicked) {
        onSectionClicked(data.section_id);
      } else if (data.type === 'SECTION_ACTION' && onSectionAction) {
        onSectionAction(data.section_id, data.action);
      } else if (data.type === 'INLINE_EDIT' && onInlineEdit) {
        onInlineEdit(data.section_id, data.path, data.value);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onSectionClicked, onSectionAction, onInlineEdit, previewOrigin]);

  useImperativeHandle(ref, () => ({
    scrollToSection(sectionId: string) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'SCROLL_TO_SECTION', section_id: sectionId },
        previewOrigin,
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
            title={t('storefrontPreview')}
            className="w-full h-full border-0 block"
            // No sandbox here — same-origin scripts need free run to render the
            // storefront. Restrict in prod once a separate preview origin is set up.
          />
        </div>
      </div>
    </div>
  );
});
