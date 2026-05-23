'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { ChevronsUpDown, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Country data ---
export interface Country {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  region: string;
}

/** Convert ISO alpha-2 code to flag emoji */
export function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '🌐';
  return String.fromCodePoint(
    0x1f1e6 + (code.toUpperCase().charCodeAt(0) - 65),
    0x1f1e6 + (code.toUpperCase().charCodeAt(1) - 65),
  );
}

export const COUNTRIES: Country[] = [
  // Gulf (GCC)
  { code: 'SA', name: 'Saudi Arabia',       region: 'Gulf' },
  { code: 'AE', name: 'UAE',                region: 'Gulf' },
  { code: 'KW', name: 'Kuwait',             region: 'Gulf' },
  { code: 'QA', name: 'Qatar',              region: 'Gulf' },
  { code: 'BH', name: 'Bahrain',            region: 'Gulf' },
  { code: 'OM', name: 'Oman',               region: 'Gulf' },
  // Arab World (non-Gulf)
  { code: 'EG', name: 'Egypt',              region: 'Arab World' },
  { code: 'JO', name: 'Jordan',             region: 'Arab World' },
  { code: 'LB', name: 'Lebanon',            region: 'Arab World' },
  { code: 'SY', name: 'Syria',              region: 'Arab World' },
  { code: 'IQ', name: 'Iraq',               region: 'Arab World' },
  { code: 'YE', name: 'Yemen',              region: 'Arab World' },
  { code: 'PS', name: 'Palestine',          region: 'Arab World' },
  { code: 'LY', name: 'Libya',              region: 'Arab World' },
  { code: 'TN', name: 'Tunisia',            region: 'Arab World' },
  { code: 'DZ', name: 'Algeria',            region: 'Arab World' },
  { code: 'MA', name: 'Morocco',            region: 'Arab World' },
  { code: 'SD', name: 'Sudan',              region: 'Arab World' },
  { code: 'SO', name: 'Somalia',            region: 'Arab World' },
  // Turkey & Near East
  { code: 'TR', name: 'Turkey',             region: 'Near East' },
  { code: 'IR', name: 'Iran',               region: 'Near East' },
  { code: 'PK', name: 'Pakistan',           region: 'Near East' },
  // Western Europe
  { code: 'DE', name: 'Germany',            region: 'Europe' },
  { code: 'FR', name: 'France',             region: 'Europe' },
  { code: 'GB', name: 'United Kingdom',     region: 'Europe' },
  { code: 'IT', name: 'Italy',              region: 'Europe' },
  { code: 'ES', name: 'Spain',              region: 'Europe' },
  { code: 'NL', name: 'Netherlands',        region: 'Europe' },
  { code: 'BE', name: 'Belgium',            region: 'Europe' },
  { code: 'AT', name: 'Austria',            region: 'Europe' },
  { code: 'CH', name: 'Switzerland',        region: 'Europe' },
  { code: 'SE', name: 'Sweden',             region: 'Europe' },
  { code: 'NO', name: 'Norway',             region: 'Europe' },
  { code: 'DK', name: 'Denmark',            region: 'Europe' },
  { code: 'FI', name: 'Finland',            region: 'Europe' },
  { code: 'PT', name: 'Portugal',           region: 'Europe' },
  { code: 'IE', name: 'Ireland',            region: 'Europe' },
  { code: 'GR', name: 'Greece',             region: 'Europe' },
  { code: 'PL', name: 'Poland',             region: 'Europe' },
  { code: 'CZ', name: 'Czech Republic',     region: 'Europe' },
  { code: 'HU', name: 'Hungary',            region: 'Europe' },
  { code: 'RO', name: 'Romania',            region: 'Europe' },
  { code: 'SK', name: 'Slovakia',           region: 'Europe' },
  { code: 'HR', name: 'Croatia',            region: 'Europe' },
  { code: 'RS', name: 'Serbia',             region: 'Europe' },
  { code: 'LU', name: 'Luxembourg',         region: 'Europe' },
  { code: 'MT', name: 'Malta',              region: 'Europe' },
  { code: 'CY', name: 'Cyprus',             region: 'Europe' },
  // North America
  { code: 'US', name: 'United States',      region: 'North America' },
  { code: 'CA', name: 'Canada',             region: 'North America' },
  { code: 'MX', name: 'Mexico',             region: 'North America' },
  // South America
  { code: 'BR', name: 'Brazil',             region: 'South America' },
  { code: 'AR', name: 'Argentina',          region: 'South America' },
  { code: 'CL', name: 'Chile',              region: 'South America' },
  { code: 'CO', name: 'Colombia',           region: 'South America' },
  { code: 'PE', name: 'Peru',               region: 'South America' },
  // East Asia
  { code: 'CN', name: 'China',              region: 'East Asia' },
  { code: 'JP', name: 'Japan',              region: 'East Asia' },
  { code: 'KR', name: 'South Korea',        region: 'East Asia' },
  { code: 'TW', name: 'Taiwan',             region: 'East Asia' },
  { code: 'HK', name: 'Hong Kong',          region: 'East Asia' },
  // Southeast Asia
  { code: 'SG', name: 'Singapore',          region: 'Southeast Asia' },
  { code: 'MY', name: 'Malaysia',           region: 'Southeast Asia' },
  { code: 'TH', name: 'Thailand',           region: 'Southeast Asia' },
  { code: 'ID', name: 'Indonesia',          region: 'Southeast Asia' },
  { code: 'PH', name: 'Philippines',        region: 'Southeast Asia' },
  { code: 'VN', name: 'Vietnam',            region: 'Southeast Asia' },
  // South Asia
  { code: 'IN', name: 'India',              region: 'South Asia' },
  { code: 'BD', name: 'Bangladesh',         region: 'South Asia' },
  { code: 'LK', name: 'Sri Lanka',          region: 'South Asia' },
  // Africa
  { code: 'NG', name: 'Nigeria',            region: 'Africa' },
  { code: 'ZA', name: 'South Africa',       region: 'Africa' },
  { code: 'KE', name: 'Kenya',              region: 'Africa' },
  { code: 'ET', name: 'Ethiopia',           region: 'Africa' },
  { code: 'GH', name: 'Ghana',              region: 'Africa' },
  { code: 'SN', name: 'Senegal',            region: 'Africa' },
  // Oceania
  { code: 'AU', name: 'Australia',          region: 'Oceania' },
  { code: 'NZ', name: 'New Zealand',        region: 'Oceania' },
];

// Region presets for quick selection. Labels are resolved via the translator
// at render time using `labelKey` so they localize with the dashboard UI.
const REGION_PRESETS: { labelKey: string; region: string }[] = [
  { labelKey: 'regionGulfGcc', region: 'Gulf' },
  { labelKey: 'regionArabWorld', region: 'Arab World' },
  { labelKey: 'regionEurope', region: 'Europe' },
  { labelKey: 'regionNorthAmerica', region: 'North America' },
  { labelKey: 'regionEastAsia', region: 'East Asia' },
  { labelKey: 'regionSoutheastAsia', region: 'Southeast Asia' },
];

// Group countries by region
function groupByRegion(countries: Country[]): Record<string, Country[]> {
  const groups: Record<string, Country[]> = {};
  for (const c of countries) {
    if (!groups[c.region]) groups[c.region] = [];
    groups[c.region].push(c);
  }
  return groups;
}

interface CountryMultiSelectProps {
  value: string[];   // array of ISO codes
  onChange: (codes: string[]) => void;
  placeholder?: string;
}

export function CountryMultiSelect({ value, onChange, placeholder }: CountryMultiSelectProps) {
  const t = useTranslations('components');
  const resolvedPlaceholder = placeholder ?? t('selectCountries');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const selected = value.map(code => COUNTRIES.find(c => c.code === code)).filter(Boolean) as Country[];

  const filtered = search
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.region.toLowerCase().includes(search.toLowerCase()),
      )
    : COUNTRIES;

  const grouped = groupByRegion(filtered);
  const regionOrder = ['Gulf', 'Arab World', 'Near East', 'Europe', 'North America', 'South America', 'East Asia', 'Southeast Asia', 'South Asia', 'Africa', 'Oceania'];
  const sortedRegions = regionOrder.filter(r => grouped[r]);

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 380) });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (code: string) => {
    if (value.includes(code)) {
      onChange(value.filter(c => c !== code));
    } else {
      onChange([...value, code]);
    }
  };

  const selectRegion = (region: string) => {
    const regionCodes = COUNTRIES.filter(c => c.region === region).map(c => c.code);
    const allSelected = regionCodes.every(c => value.includes(c));
    if (allSelected) {
      onChange(value.filter(c => !regionCodes.includes(c)));
    } else {
      const merged = Array.from(new Set([...value, ...regionCodes]));
      onChange(merged);
    }
  };

  return (
    <div className="relative" ref={triggerRef}>
      {/* Trigger */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={e => e.key === 'Enter' && setOpen(!open)}
        className={cn(
          'min-h-9 w-full flex items-center flex-wrap gap-1 px-2 py-1.5 rounded-md border border-input bg-background text-sm cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          open && 'ring-2 ring-ring ring-offset-1',
        )}
      >
        {selected.length === 0 ? (
          <span className="text-muted-foreground text-sm px-1">{resolvedPlaceholder}</span>
        ) : (
          selected.map(c => (
            <span
              key={c.code}
              className="inline-flex items-center gap-0.5 bg-zinc-100 border border-zinc-200 rounded px-1.5 py-0.5 text-[11px] font-medium"
            >
              <span>{countryFlag(c.code)}</span>
              <span>{c.code}</span>
              <button
                type="button"
                className="ms-0.5 text-zinc-400 hover:text-zinc-700"
                onClick={e => { e.stopPropagation(); toggle(c.code); }}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))
        )}
        <ChevronsUpDown className="w-3.5 h-3.5 opacity-40 ms-auto shrink-0" />
      </div>

      {/* Dropdown portal */}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] rounded-lg border bg-popover shadow-xl overflow-hidden"
          style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Search */}
          <div className="p-2 border-b">
            <input
              autoFocus
              type="text"
              placeholder={t('searchCountriesOrRegions')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Region presets (shown only when not searching) */}
          {!search && (
            <div className="flex flex-wrap gap-1 px-3 py-2 border-b bg-zinc-50/70">
              {REGION_PRESETS.map(rp => {
                const regionCodes = COUNTRIES.filter(c => c.region === rp.region).map(c => c.code);
                const allSel = regionCodes.every(c => value.includes(c));
                return (
                  <button
                    key={rp.region}
                    type="button"
                    onClick={() => selectRegion(rp.region)}
                    className={cn(
                      'px-2 py-0.5 rounded text-[11px] border transition',
                      allSel
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400',
                    )}
                  >
                    {t(rp.labelKey)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Country list grouped by region */}
          <div className="max-h-[280px] overflow-y-auto">
            {sortedRegions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">{t('noCountriesFound')}</p>
            ) : (
              sortedRegions.map(region => (
                <div key={region}>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-zinc-50/80 sticky top-0">
                    {region}
                  </div>
                  {grouped[region].map(c => {
                    const isSelected = value.includes(c.code);
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => toggle(c.code)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start transition',
                          isSelected ? 'bg-zinc-100' : 'hover:bg-zinc-50',
                        )}
                      >
                        <span className="text-base w-6 text-center shrink-0">{countryFlag(c.code)}</span>
                        <span className="flex-1">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{c.code}</span>
                        <Check className={cn('w-3.5 h-3.5 shrink-0', isSelected ? 'opacity-100 text-zinc-700' : 'opacity-0')} />
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {value.length > 0 && (
            <div className="px-3 py-2 border-t flex items-center justify-between bg-zinc-50/70">
              <span className="text-[11px] text-muted-foreground">{t('countriesSelectedCount', { count: value.length })}</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[11px] text-red-500 hover:underline"
              >
                {t('clearAll')}
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
