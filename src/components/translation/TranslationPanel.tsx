'use client';

interface TranslationField {
  key: string;
  label: string;
  type: 'text' | 'textarea';
}

interface TranslationPanelProps {
  locales: string[];
  fields: TranslationField[];
  values: Record<string, Record<string, string>>; // { en: { title: "..." }, ar: { title: "..." } }
  onChange: (locale: string, key: string, value: string) => void;
}

const localeNames: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
  tr: 'Türkçe',
  de: 'Deutsch',
  fr: 'Français',
  sv: 'Svenska',
};

export function TranslationPanel({
  locales,
  fields,
  values,
  onChange,
}: TranslationPanelProps) {
  return (
    <div className="space-y-6">
      {locales.map((locale) => (
        <div
          key={locale}
          className="bg-gray-50 rounded-lg p-4 border"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold uppercase bg-blue-100 text-blue-700 px-2 py-1 rounded">
              {locale}
            </span>
            <span className="text-sm text-gray-500">
              {localeNames[locale] || locale}
            </span>
          </div>

          <div className="space-y-3">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {field.label}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    rows={3}
                    value={values[locale]?.[field.key] || ''}
                    onChange={(e) => onChange(locale, field.key, e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    dir={locale === 'ar' ? 'rtl' : 'ltr'}
                  />
                ) : (
                  <input
                    type="text"
                    value={values[locale]?.[field.key] || ''}
                    onChange={(e) => onChange(locale, field.key, e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    dir={locale === 'ar' ? 'rtl' : 'ltr'}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
