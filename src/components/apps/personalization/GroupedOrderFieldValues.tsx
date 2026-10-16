'use client';

import { useTranslations } from 'next-intl';
import { OrderFieldValues } from '@/components/common/OrderFieldValues';
import { snapshotLabel, sortValueRows, isFileValueRow } from '@/lib/customFields';
import {
  buildPersonalizationGroups,
  hasGroupedRows,
  snapshotGroupLabel,
  type PersonalizationOrderRow,
} from '@/lib/personalization';

export interface GroupedOrderFieldValuesProps {
  /** `custom_field_values` of one order item (M4.0 snapshot + M4.1 group columns). */
  values?: readonly PersonalizationOrderRow[] | null;
  /** Locale to show labels in (dashboard UI locale). */
  locale: string;
  /** Store primary locale (second choice in the snapshot chain). */
  primaryLocale: string;
  /** Needed for the "Download original" button of customer files. */
  token?: string | null;
  className?: string;
}

/**
 * Personalization values of an order item, grouped by repeater instance
 * ("Artikel 2: ● KARIN · Röd") when the rows carry `group_index` (written only
 * while the personalization app is on). Rows without a group are rendered by
 * the M4.0 `OrderFieldValues` unchanged, so orders without groups look exactly
 * as before; `source='OPTION'` rows only appear inside their group.
 *
 * Drop-in replacement for `OrderFieldValues` on the creator, admin and
 * provider order pages (same props).
 */
export function GroupedOrderFieldValues({ values, locale, primaryLocale, token, className }: GroupedOrderFieldValuesProps) {
  const t = useTranslations('creator.personalization.order');

  if (!hasGroupedRows(values)) {
    return (
      <OrderFieldValues values={values} locale={locale} primaryLocale={primaryLocale} token={token} className={className} />
    );
  }

  const rows = sortValueRows(values);
  const { groups, flat } = buildPersonalizationGroups(
    rows,
    (row) => snapshotLabel(row, locale, primaryLocale),
    (row) => snapshotGroupLabel(row, locale, primaryLocale, t('itemN', { i: '{i}' })),
  );

  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      {flat.length > 0 && (
        <OrderFieldValues values={flat} locale={locale} primaryLocale={primaryLocale} token={token} />
      )}
      <div className="ms-17 ps-3 border-s-2 border-muted space-y-1.5">
        {groups.map((group) => {
          const textEntries = group.entries.filter((e) => !isFileValueRow(e.row) && e.value);
          const fileRows = group.entries.filter((e) => isFileValueRow(e.row)).map((e) => e.row);
          return (
            <div key={group.key} className="text-xs">
              <p className="font-semibold text-foreground">{group.label}</p>
              {textEntries.length > 0 && (
                <ul className="mt-0.5 space-y-0.5">
                  {textEntries.map((entry, i) => (
                    <li key={entry.row.id ?? `${group.key}-${i}`} className="flex items-center gap-1.5 text-muted-foreground">
                      {entry.hex && (
                        <span
                          aria-hidden
                          className="inline-block size-2.5 shrink-0 rounded-full border border-zinc-300"
                          style={{ backgroundColor: entry.hex }}
                        />
                      )}
                      <span className="font-medium text-foreground">{entry.label}:</span>
                      <span className="whitespace-pre-wrap break-words" dir="auto">{entry.value}</span>
                    </li>
                  ))}
                </ul>
              )}
              {fileRows.length > 0 && (
                <OrderFieldValues
                  values={fileRows}
                  locale={locale}
                  primaryLocale={primaryLocale}
                  token={token}
                  className="ms-0! ps-0! border-s-0! mt-1"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
