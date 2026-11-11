'use client';

import { API_ORIGIN, authFetch } from '@/lib/api';
import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError, API_ERROR_EVENT } from './api';
import { mapUploadFailure, UPLOAD_FILE_TOO_LARGE } from './uploadError';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/** Cap of `POST /uploads` (API `UPLOAD_MAX_BYTES`), used when a 413 carries no body (nginx). */
export const UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

export interface UploadedImage {
  id: string;
  url: string;
  file_type: string;
  file_size: number;
}

export function useImageUpload(token: string | null) {
  const [uploading, setUploading] = useState(false);
  // Localized message of the last failed upload (null once an upload succeeds
  // or `clearError()` runs). `upload()` keeps resolving `null` on failure so
  // existing callers need no change; the message is for those that show it.
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('errors');

  const describeFailure = useCallback(
    (status: number, json: Record<string, unknown> | null): string => {
      const f = mapUploadFailure(status, json, UPLOAD_MAX_BYTES);
      if (f.code === UPLOAD_FILE_TOO_LARGE && f.maxMb) {
        return t('UPLOAD_FILE_TOO_LARGE_MAX', { max: f.maxMb });
      }
      if (f.code && t.has(f.code)) return t(f.code);
      return f.message || t('generic');
    },
    [t],
  );

  const upload = useCallback(async (file: File, folder = 'products'): Promise<UploadedImage | null> => {
    if (!token) return null;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await authFetch(`${API_URL}/uploads?folder=${folder}`, token, {
        method: 'POST',
        body: formData,
      });
      // A 413 from nginx (above client_max_body_size) is an HTML page, not JSON.
      let json: Record<string, unknown> | null = null;
      try {
        json = (await res.json()) as Record<string, unknown>;
      } catch {
        json = null;
      }
      const data = json?.data as UploadedImage | undefined;
      if (res.ok && data) {
        setError(null);
        return {
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url: data.url.startsWith('http') ? data.url : `${API_ORIGIN}${data.url}`,
          file_type: data.file_type,
          file_size: data.file_size,
        };
      }
      const message = describeFailure(res.status, json);
      setError(message);
      // Mirror `api()`: a coded ApiError on the window event so global UI can react.
      const f = mapUploadFailure(res.status, json, UPLOAD_MAX_BYTES);
      const err = new ApiError(message);
      err.status = res.status;
      err.code = f.code;
      err.payload = json ?? undefined;
      if (err.code && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent<ApiError>(API_ERROR_EVENT, { detail: err }));
      }
      console.error('Upload failed:', res.status, f.code ?? f.message);
      return null;
    } catch (err) {
      console.error('Upload failed:', err);
      setError(t('generic'));
      return null;
    } finally {
      setUploading(false);
    }
  }, [token, describeFailure, t]);

  const uploadMultiple = useCallback(async (files: File[], folder = 'products'): Promise<UploadedImage[]> => {
    const results: UploadedImage[] = [];
    for (const file of files) {
      const result = await upload(file, folder);
      if (result) results.push(result);
    }
    return results;
  }, [upload]);

  const pickAndUpload = useCallback((folder = 'products', multiple = false): Promise<UploadedImage[]> => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = multiple;
      input.onchange = async () => {
        if (!input.files?.length) { resolve([]); return; }
        if (multiple) {
          const results = await uploadMultiple(Array.from(input.files), folder);
          resolve(results);
        } else {
          const result = await upload(input.files[0]!, folder);
          resolve(result ? [result] : []);
        }
      };
      // Resolve when the user dismisses the file dialog without picking,
      // so callers awaiting this promise don't hang (e.g. pending spinners).
      input.oncancel = () => resolve([]);
      input.click();
    });
  }, [upload, uploadMultiple]);

  const clearError = useCallback(() => setError(null), []);

  return { upload, uploadMultiple, pickAndUpload, uploading, error, clearError };
}
