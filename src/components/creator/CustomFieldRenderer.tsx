'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';

type Translator = ReturnType<typeof useTranslations>;

interface CustomFieldTranslation {
  locale: string;
  label: string;
  placeholder?: string;
  option_labels?: Record<string, string>;
}

interface CustomField {
  id: string;
  name: string;
  type: string;
  is_required: boolean;
  placeholder?: string;
  options?: any;
  validation_rules?: any;
  translations: CustomFieldTranslation[];
}

interface CustomFieldRendererProps {
  fields: CustomField[];
  values: Record<string, { value?: string; file_url?: string }>;
  onChange: (fieldId: string, data: { value?: string; file_url?: string }) => void;
  locale?: string;
  token?: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const API_BASE = API_URL.replace('/api', '');

export default function CustomFieldRenderer({
  fields,
  values,
  onChange,
  locale = 'en',
  token,
}: CustomFieldRendererProps) {
  const t = useTranslations('components');
  const tc = useTranslations('common');

  if (!fields || fields.length === 0) return null;

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const translation = field.translations?.find((tr) => tr.locale === locale) ||
          field.translations?.[0];
        const label = translation?.label || field.name;
        const placeholder = translation?.placeholder || field.placeholder || '';
        const fieldValue = values[field.id] || {};

        return (
          <div key={field.id} className="space-y-1.5">
            <Label className="text-xs font-medium">
              {label}
              {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
            </Label>

            {renderField(field, fieldValue, placeholder, onChange, translation, token, t, tc)}
          </div>
        );
      })}
    </div>
  );
}

function renderField(
  field: CustomField,
  fieldValue: { value?: string; file_url?: string },
  placeholder: string,
  onChange: (fieldId: string, data: { value?: string; file_url?: string }) => void,
  translation: CustomFieldTranslation | undefined,
  token: string | null | undefined,
  t: Translator,
  tc: Translator,
) {
  const handleChange = (value: string) => onChange(field.id, { ...fieldValue, value });

  switch (field.type) {
    case 'TEXT':
      return (
        <Input
          type="text"
          placeholder={placeholder}
          value={fieldValue.value || ''}
          onChange={(e) => handleChange(e.target.value)}
          className="h-8 text-sm"
          maxLength={field.validation_rules?.max_length}
        />
      );

    case 'TEXTAREA':
      return (
        <Textarea
          placeholder={placeholder}
          value={fieldValue.value || ''}
          onChange={(e) => handleChange(e.target.value)}
          rows={3}
          className="text-sm resize-none"
        />
      );

    case 'NUMBER':
      return (
        <Input
          type="number"
          placeholder={placeholder}
          value={fieldValue.value || ''}
          onChange={(e) => handleChange(e.target.value)}
          className="h-8 text-sm"
        />
      );

    case 'SELECT': {
      const options = Array.isArray(field.options) ? field.options : [];
      const optionLabels = translation?.option_labels || {};
      return (
        <select
          value={fieldValue.value || ''}
          onChange={(e) => handleChange(e.target.value)}
          className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">{placeholder || tc('select')}</option>
          {options.map((opt: string) => (
            <option key={opt} value={opt}>
              {optionLabels[opt] || opt}
            </option>
          ))}
        </select>
      );
    }

    case 'COLOR':
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={fieldValue.value || '#000000'}
            onChange={(e) => handleChange(e.target.value)}
            className="w-8 h-8 rounded border cursor-pointer"
          />
          <Input
            type="text"
            value={fieldValue.value || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="#000000"
            className="h-8 text-sm w-28 font-mono"
          />
        </div>
      );

    case 'DATE':
      return (
        <Input
          type="date"
          value={fieldValue.value || ''}
          onChange={(e) => handleChange(e.target.value)}
          className="h-8 text-sm"
        />
      );

    case 'IMAGE':
    case 'FILE':
    case 'MULTI_IMAGE':
      return (
        <FileUploadField
          field={field}
          fieldValue={fieldValue}
          onChange={onChange}
          token={token}
        />
      );

    case 'FONT':
      return (
        <Input
          type="text"
          placeholder={placeholder || t('fontNamePlaceholder')}
          value={fieldValue.value || ''}
          onChange={(e) => handleChange(e.target.value)}
          className="h-8 text-sm"
        />
      );

    default:
      return (
        <Input
          type="text"
          placeholder={placeholder}
          value={fieldValue.value || ''}
          onChange={(e) => handleChange(e.target.value)}
          className="h-8 text-sm"
        />
      );
  }
}

// ─── File Upload Field ──────────────────────────────────────────────────────
function FileUploadField({
  field,
  fieldValue,
  onChange,
  token,
}: {
  field: CustomField;
  fieldValue: { value?: string; file_url?: string };
  onChange: (fieldId: string, data: { value?: string; file_url?: string }) => void;
  token?: string | null;
}) {
  const t = useTranslations('components');
  const tc = useTranslations('common');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const isImage = field.type === 'IMAGE' || field.type === 'MULTI_IMAGE';

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_URL}/uploads?folder=custom-fields`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json();
      const url = json?.data?.url;
      if (!url) throw new Error(json?.message || t('uploadFailed'));
      const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
      onChange(field.id, { ...fieldValue, file_url: fullUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('uploadFailed'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemove = () => {
    onChange(field.id, { ...fieldValue, file_url: undefined });
  };

  if (fieldValue.file_url) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          {isImage ? (
            <div className="relative shrink-0 group">
              <img
                src={fieldValue.file_url}
                alt={field.name}
                className="w-20 h-20 object-cover rounded-md border border-zinc-200"
              />
              <button
                type="button"
                onClick={handleRemove}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity shadow-sm"
                title={tc('remove')}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-md border border-zinc-200 bg-zinc-50 text-xs text-zinc-700 truncate">
              <ImageIcon className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
              <a href={fieldValue.file_url} target="_blank" rel="noreferrer" className="truncate hover:underline">
                {fieldValue.file_url.split('/').pop() || t('file')}
              </a>
              <button
                type="button"
                onClick={handleRemove}
                className="ml-auto text-zinc-400 hover:text-red-500 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        {error && <p className="text-[10px] text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className="flex items-center justify-center gap-2 h-8 px-3 rounded-md border border-dashed border-zinc-300 bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-400 cursor-pointer transition-colors text-xs text-zinc-600">
        <input
          type="file"
          accept={isImage ? 'image/*' : undefined}
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />
        {uploading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{t('uploading')}</span>
          </>
        ) : (
          <>
            <Upload className="w-3.5 h-3.5" />
            <span>{isImage ? t('uploadImage') : t('uploadFile')}</span>
          </>
        )}
      </label>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  );
}
