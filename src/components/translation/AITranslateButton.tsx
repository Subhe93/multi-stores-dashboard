'use client';

import { useState } from 'react';

interface AITranslateButtonProps {
  entityType: string;
  entityId: string;
  sourceLocale: string;
  targetLocale: string;
  onTranslated?: (result: any) => void;
}

export function AITranslateButton({
  entityType,
  entityId,
  sourceLocale,
  targetLocale,
  onTranslated,
}: AITranslateButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleTranslate = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/translations/auto-translate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity_type: entityType,
            entity_id: entityId,
            source_locale: sourceLocale,
            target_locale: targetLocale,
          }),
        },
      );
      const data = await res.json();
      onTranslated?.(data.data);
    } catch (err) {
      console.error('Translation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleTranslate}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50"
    >
      {loading ? (
        <>
          <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          Translating...
        </>
      ) : (
        <>
          <span>AI</span>
          Translate to {targetLocale.toUpperCase()}
        </>
      )}
    </button>
  );
}
