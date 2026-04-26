'use client';

import { useState, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface UploadedImage {
  id: string;
  url: string;
  file_type: string;
  file_size: number;
}

export function useImageUpload(token: string | null) {
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(async (file: File, folder = 'products'): Promise<UploadedImage | null> => {
    if (!token) return null;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_URL}/uploads?folder=${folder}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json();
      if (json.data) {
        return {
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url: json.data.url.startsWith('http') ? json.data.url : `${API_URL.replace('/api', '')}${json.data.url}`,
          file_type: json.data.file_type,
          file_size: json.data.file_size,
        };
      }
      return null;
    } catch (err) {
      console.error('Upload failed:', err);
      return null;
    } finally {
      setUploading(false);
    }
  }, [token]);

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
      input.click();
    });
  }, [upload, uploadMultiple]);

  return { upload, uploadMultiple, pickAndUpload, uploading };
}
