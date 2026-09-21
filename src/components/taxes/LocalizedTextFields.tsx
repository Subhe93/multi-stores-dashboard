'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LocalizedTextFieldsProps {
  label: string;
  // Locales to offer one input for; the first one is treated as required.
  locales: string[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  placeholder?: string;
}

// One input per locale for JSON text columns such as TaxClass.name and
// TaxRate.label ({ en: "VAT", sv: "Moms" }).
export function LocalizedTextFields({ label, locales, value, onChange, placeholder }: LocalizedTextFieldsProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {locales.map((locale, index) => (
          <div key={locale} className="relative">
            <span className="pointer-events-none absolute inset-y-0 inset-s-0 flex items-center ps-2.5 text-[10px] font-semibold uppercase text-muted-foreground">
              {locale}
            </span>
            <Input
              className="h-8 text-sm ps-9"
              value={value[locale] || ''}
              placeholder={index === 0 ? placeholder : undefined}
              onChange={(e) => onChange({ ...value, [locale]: e.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
