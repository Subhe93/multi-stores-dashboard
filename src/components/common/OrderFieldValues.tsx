'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, FileText, Loader2 } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/media';
import { useApiError } from '@/lib/useApiError';
import { downloadCustomerUploadOriginal } from '@/lib/customerUploads.api';
import {
  isFileValueRow,
  snapshotLabel,
  sortValueRows,
  type OrderFieldValueRow,
} from '@/lib/customFields';

interface OrderFieldValuesProps {
  /** `custom_field_values` of one order item (order snapshot rows). */
  values?: readonly OrderFieldValueRow[] | null;
  /** Locale to show labels in (dashboard UI locale). */
  locale: string;
  /** Store primary locale (second choice in the snapshot chain). */
  primaryLocale: string;
  token?: string | null;
  className?: string;
}

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i;

/** A run of rows of the same field: one text row, or one or more files. */
interface ValueGroup {
  key: string;
  label: string;
  text?: string;
  files: OrderFieldValueRow[];
}

/** Groups consecutive file rows of the same field (MULTI_IMAGE = one row per file). */
function groupRows(rows: OrderFieldValueRow[], locale: string, primary: string): ValueGroup[] {
  const groups: ValueGroup[] = [];
  rows.forEach((row, i) => {
    const { label, value } = snapshotLabel(row, locale, primary);
    const fieldKey = row.custom_field_id || row.field_name || `row-${i}`;
    if (isFileValueRow(row)) {
      const last = groups[groups.length - 1];
      if (last && last.text === undefined && last.key === fieldKey) {
        last.files.push(row);
        return;
      }
      groups.push({ key: fieldKey, label, files: [row] });
      return;
    }
    // Text rows without a value carry nothing to show.
    if (!value) return;
    groups.push({ key: `${fieldKey}-${i}`, label, text: value, files: [] });
  });
  return groups;
}

/**
 * Personalization values of an order item, read from the order snapshot
 * (labels survive renames and deleted fields). Customer files show the public
 * preview plus an authorized "Download original" button; purged files show the
 * retention notice. Renders nothing for items without values, so orders
 * without personalization look exactly as before.
 */
export function OrderFieldValues({ values, locale, primaryLocale, token, className }: OrderFieldValuesProps) {
  const t = useTranslations('creator.orderDetail');
  const apiError = useApiError();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const rows = sortValueRows(values);
  if (rows.length === 0) return null;
  const groups = groupRows(rows, locale, primaryLocale);
  if (groups.length === 0) return null;

  const download = async (row: OrderFieldValueRow, rowKey: string) => {
    const uploadId = row.upload?.id ?? row.upload_id;
    if (!token || !uploadId || busy) return;
    setBusy(rowKey);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
    try {
      await downloadCustomerUploadOriginal(token, uploadId, row.upload?.original_name);
    } catch (err) {
      setErrors((prev) => ({ ...prev, [rowKey]: apiError(err) }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`ms-17 ps-3 border-s-2 border-muted space-y-1 ${className ?? ''}`}>
      {groups.map((group) =>
        group.text !== undefined ? (
          <p key={group.key} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{group.label}:</span>{' '}
            <span className="whitespace-pre-wrap break-words">{group.text}</span>
          </p>
        ) : (
          <div key={group.key} className="space-y-1">
            <p className="text-xs font-medium text-foreground">{group.label}:</p>
            <div className="flex flex-wrap gap-2">
              {group.files.map((row, i) => {
                const rowKey = `${group.key}-${row.id ?? i}`;
                const purged = !!row.upload?.purged_at;
                const uploadId = row.upload?.id ?? row.upload_id;
                const previewUrl = resolveMediaUrl(row.upload?.preview_url || row.file_url);
                const isImage = !!row.upload || IMAGE_EXT_RE.test(row.file_url ?? '');
                const title = row.upload?.original_name || group.label;
                return (
                  <div key={rowKey} className="w-24 space-y-1">
                    {purged ? (
                      <div className="flex h-16 w-24 items-center justify-center rounded border border-dashed bg-zinc-50 px-1 text-center text-[10px] leading-tight text-muted-foreground">
                        {t('fileRemoved')}
                      </div>
                    ) : previewUrl ? (
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={title}
                        className="flex h-16 w-24 items-center justify-center overflow-hidden rounded border bg-zinc-50 transition hover:opacity-80"
                      >
                        {isImage ? (
                          <img src={previewUrl} alt={title} className="h-full w-full object-contain p-0.5" />
                        ) : (
                          <FileText className="h-6 w-6 text-muted-foreground" />
                        )}
                      </a>
                    ) : (
                      <div className="flex h-16 w-24 items-center justify-center rounded border bg-zinc-50 text-[10px] text-muted-foreground">
                        {t('fileUploaded')}
                      </div>
                    )}
                    {row.upload?.original_name && !purged && (
                      <p className="truncate text-[10px] text-muted-foreground" title={row.upload.original_name} dir="auto">
                        {row.upload.original_name}
                      </p>
                    )}
                    {uploadId && !purged && token && (
                      <button
                        type="button"
                        onClick={() => download(row, rowKey)}
                        disabled={busy !== null}
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy === rowKey ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                        {t('downloadOriginal')}
                      </button>
                    )}
                    {errors[rowKey] && <p className="text-[10px] text-red-600">{errors[rowKey]}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        ),
      )}
    </div>
  );
}
