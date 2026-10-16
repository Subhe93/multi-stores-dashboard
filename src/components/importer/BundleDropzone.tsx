'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FileText, FolderOpen, Files, Loader2, Play, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ARCHIVE_EXTENSIONS,
  BUNDLE_FILE_ALLOWLIST,
  MAX_BUNDLE_BYTES,
  MAX_BUNDLE_FILES,
  REQUIRED_BUNDLE_FILES,
} from '@/lib/importer.api';
import { ErrorBanner, formatBytes } from '@/components/importer/ImporterBits';

interface BundleDropzoneProps {
  disabled?: boolean;
  /** Uploads the bundle files and starts a run; rejects with an API error. */
  onUpload: (files: File[], onProgress: (fraction: number) => void) => Promise<void>;
  /** Localized text of an upload error. */
  describeError: (err: unknown) => string;
}

/** Files picked for upload, after the allowlist filter. */
interface Selection {
  files: File[];
  /** Files left out: not part of a bundle, or a second copy of the same name. */
  ignored: number;
}

/** Lower-cased basename of a picked file (folder pickers keep the path in `webkitRelativePath`). */
const baseName = (file: File): string => file.name.split(/[\\/]/).pop()!.toLowerCase();

const isArchive = (name: string): boolean => ARCHIVE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

// ─── Drag-and-drop folder walk ───────────────────────────────────────────────

// Minimal typings of the File and Directory Entries API (not in every lib.dom).
interface FsEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
}
interface FsFileEntry extends FsEntry {
  file: (ok: (file: File) => void, fail: (err: unknown) => void) => void;
}
interface FsDirectoryEntry extends FsEntry {
  createReader: () => { readEntries: (ok: (entries: FsEntry[]) => void, fail: (err: unknown) => void) => void };
}

/** Deepest folder level walked; a bundle sits at the top or one level down. */
const MAX_DEPTH = 4;
/** Stop collecting after this many files (a whole drive dropped by mistake). */
const MAX_WALKED_FILES = 2000;

async function walkEntry(entry: FsEntry, out: File[], depth: number): Promise<void> {
  if (out.length >= MAX_WALKED_FILES) return;
  if (entry.isFile) {
    const file = await new Promise<File | null>((resolve) => (entry as FsFileEntry).file(resolve, () => resolve(null)));
    if (file) out.push(file);
    return;
  }
  if (!entry.isDirectory || depth >= MAX_DEPTH) return;
  const reader = (entry as FsDirectoryEntry).createReader();
  // readEntries returns the folder in batches; an empty batch ends it.
  for (;;) {
    const batch = await new Promise<FsEntry[]>((resolve) => reader.readEntries(resolve, () => resolve([])));
    if (batch.length === 0) break;
    for (const child of batch) await walkEntry(child, out, depth + 1);
    if (out.length >= MAX_WALKED_FILES) break;
  }
}

/** Every file of a drop, folders walked recursively. */
async function filesOfDrop(data: DataTransfer): Promise<File[]> {
  const items = Array.from(data.items ?? []);
  // Entries must be taken synchronously, before the first await.
  const entries = items
    .filter((it) => it.kind === 'file')
    .map((it) => (it as DataTransferItem & { webkitGetAsEntry?: () => FsEntry | null }).webkitGetAsEntry?.() ?? null);
  if (entries.length === 0 || entries.some((e) => !e)) return Array.from(data.files ?? []);
  const out: File[] = [];
  for (const entry of entries) await walkEntry(entry!, out, 0);
  return out;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Drop zone for an extracted WordPress export: the folder the export script
 * created (or its files). Only allowlisted bundle files are uploaded; the
 * list and total size are shown before the dry run starts.
 */
export function BundleDropzone({ disabled, onUpload, describeError }: BundleDropzoneProps) {
  const t = useTranslations('creator.importer.sources.dropzone');
  const locale = useLocale();
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [reading, setReading] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // `webkitdirectory` is not a typed React prop; set it on the element.
  useEffect(() => {
    const el = folderRef.current;
    if (!el) return;
    el.setAttribute('webkitdirectory', '');
    el.setAttribute('directory', '');
  }, []);

  const busy = uploading !== null || reading;

  const resetInputs = () => {
    if (filesRef.current) filesRef.current.value = '';
    if (folderRef.current) folderRef.current.value = '';
  };

  /** Filters picked files to the bundle allowlist and checks the limits. */
  const pick = (picked: File[]) => {
    setError(null);
    setSelection(null);
    if (picked.length === 0) return;

    const byName = new Map<string, File>();
    let ignored = 0;
    for (const file of picked) {
      const name = baseName(file);
      if (!BUNDLE_FILE_ALLOWLIST.includes(name) || byName.has(name)) {
        ignored++;
        continue;
      }
      // Send the canonical lower-case name, whatever the folder spelled.
      byName.set(name, file.name === name ? file : new File([file], name, { type: file.type, lastModified: file.lastModified }));
    }
    const files = Array.from(byName.values()).sort(
      (a, b) => BUNDLE_FILE_ALLOWLIST.indexOf(a.name) - BUNDLE_FILE_ALLOWLIST.indexOf(b.name),
    );

    if (files.length === 0) {
      setError(picked.some((f) => isArchive(f.name)) ? t('archiveHint') : t('noBundleFiles'));
      return;
    }
    const missing = REQUIRED_BUNDLE_FILES.filter((req) => !byName.has(req));
    if (missing.length > 0) {
      setError(
        picked.some((f) => isArchive(f.name))
          ? t('archiveHint')
          : t('missingFiles', { files: missing.join(', '), count: missing.length }),
      );
      return;
    }
    if (files.length > MAX_BUNDLE_FILES) {
      setError(t('tooManyFiles', { count: files.length, max: MAX_BUNDLE_FILES }));
      return;
    }
    const total = files.reduce((s, f) => s + f.size, 0);
    if (total > MAX_BUNDLE_BYTES) {
      setError(t('tooLarge', { size: formatBytes(total, locale), max: formatBytes(MAX_BUNDLE_BYTES, locale) }));
      return;
    }
    setSelection({ files, ignored });
  };

  const upload = async () => {
    if (!selection || busy || disabled) return;
    setError(null);
    setUploading(0);
    try {
      await onUpload(selection.files, (fraction) => setUploading(fraction));
      setSelection(null);
      resetInputs();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setUploading(null);
    }
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || busy) return;
    setReading(true);
    try {
      pick(await filesOfDrop(e.dataTransfer));
    } finally {
      setReading(false);
    }
  };

  const total = selection?.files.reduce((s, f) => s + f.size, 0) ?? 0;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => void onDrop(e)}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-5 text-center transition ${
          disabled ? 'border-zinc-200 opacity-60' : dragOver ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200'
        }`}
      >
        {reading ? (
          <Loader2 className="size-6 animate-spin text-zinc-400" />
        ) : dragOver ? (
          <Upload className="size-6 text-zinc-500" />
        ) : (
          <FolderOpen className="size-6 text-zinc-400" />
        )}
        <p className="text-sm font-medium">{t('title')}</p>
        <p className="text-[11px] text-muted-foreground">
          {t('hint', { max: formatBytes(MAX_BUNDLE_BYTES, locale), files: MAX_BUNDLE_FILES })}
        </p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={disabled || busy} onClick={() => folderRef.current?.click()}>
            <FolderOpen />
            {t('chooseFolder')}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={disabled || busy} onClick={() => filesRef.current?.click()}>
            <Files />
            {t('chooseFiles')}
          </Button>
        </div>
        <input
          ref={folderRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => pick(Array.from(e.target.files ?? []))}
        />
        <input
          ref={filesRef}
          type="file"
          multiple
          accept=".tsv,.csv,.txt,.json"
          className="hidden"
          onChange={(e) => pick(Array.from(e.target.files ?? []))}
        />
      </div>

      {selection && (
        <div className="space-y-2 rounded-lg border bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium">{t('selected', { count: selection.files.length, size: formatBytes(total, locale) })}</span>
            {selection.ignored > 0 && <span className="text-muted-foreground">{t('ignored', { count: selection.ignored })}</span>}
          </div>
          <ul className="max-h-40 divide-y overflow-y-auto rounded-md border text-xs">
            {selection.files.map((f) => (
              <li key={f.name} className="flex items-center gap-2 px-2 py-1">
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-mono" dir="ltr">
                  {f.name}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{formatBytes(f.size, locale)}</span>
              </li>
            ))}
          </ul>
          {uploading !== null && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('uploading', { count: selection.files.length })}</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-zinc-900 transition-[width]" style={{ width: `${Math.round(uploading * 100)}%` }} />
              </div>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setSelection(null);
                resetInputs();
              }}
            >
              <X />
              {t('clear')}
            </Button>
            <Button type="button" size="sm" disabled={disabled || busy} onClick={() => void upload()}>
              {uploading !== null ? <Loader2 className="animate-spin" /> : <Play className="rtl:-scale-x-100" />}
              {t('start')}
            </Button>
          </div>
        </div>
      )}

      {error && <ErrorBanner message={error} />}
    </div>
  );
}
