/** One CSV cell: strings are escaped, numbers written as-is, empty for null. */
export type CsvCell = string | number | null | undefined;

// Spreadsheet apps execute cells starting with these as formulas (CSV
// injection), so string cells that start with one are prefixed with a quote.
const FORMULA_START = /^[=+\-@\t\r]/;

/** Separator + decimal mark a spreadsheet app in this locale expects. */
export interface CsvDialect {
  separator: ',' | ';';
  decimal: '.' | ',';
}

const DEFAULT_DIALECT: CsvDialect = { separator: ',', decimal: '.' };

/**
 * Excel uses ";" as the list separator (and "," as decimal mark) where the
 * locale writes decimals with a comma (sv, de, fr, tr, ...). Detect it from
 * the browser locale so the file opens in columns without an import wizard.
 */
export function detectCsvDialect(locale?: string): CsvDialect {
  try {
    const lang = locale ?? (typeof navigator !== 'undefined' ? navigator.language : undefined);
    const commaDecimal = new Intl.NumberFormat(lang).format(1.5).includes(',');
    return commaDecimal ? { separator: ';', decimal: ',' } : DEFAULT_DIALECT;
  } catch {
    return DEFAULT_DIALECT;
  }
}

function escapeCell(cell: CsvCell, dialect: CsvDialect): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'number') {
    if (!Number.isFinite(cell)) return '';
    const s = String(cell);
    return dialect.decimal === ',' ? s.replace('.', ',') : s;
  }
  let value = cell;
  if (FORMULA_START.test(value)) value = `'${value}`;
  if (/[",;\r\n]/.test(value) || value !== value.trim()) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Serialize rows (the first row is usually the header) as RFC 4180 CSV. */
export function toCsv(rows: CsvCell[][], dialect: CsvDialect = DEFAULT_DIALECT): string {
  return rows.map((row) => row.map((c) => escapeCell(c, dialect)).join(dialect.separator)).join('\r\n');
}

/** `<prefix>-YYYY-MM-DD.csv` using the viewer's local date. */
export function datedCsvFilename(prefix: string, date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${prefix}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.csv`;
}

/**
 * Download rows as a CSV file. Prefixed with a UTF-8 BOM so Excel detects
 * the encoding and shows non-Latin text (Arabic, Swedish, ...) correctly.
 */
export function downloadCsv(
  filename: string,
  rows: CsvCell[][],
  dialect: CsvDialect = detectCsvDialect(),
): void {
  const blob = new Blob(['﻿', toCsv(rows, dialect)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the click has been handled so the download can start.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
