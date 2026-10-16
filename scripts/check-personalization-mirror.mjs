#!/usr/bin/env node
/**
 * Verifies the personalization rules mirror of the dashboard (M4.0 K6, W23).
 *
 * 1. Every chunk (blank-line separated) between the BEGIN/END MIRROR markers
 *    of `src/lib/customFields.ts` must appear verbatim in the single source of
 *    truth `../multi-stores-shared/src/personalization/rules.ts`. The dashboard
 *    mirrors a subset, so chunks are compared one by one instead of the whole
 *    block.
 * 2. Every error code listed in the mirrored `*_CODES` arrays must have an
 *    `errors.<code>` message in all six dashboard locales.
 *
 * Usage: `npm run check:personalization-mirror` (exits 1 on any mismatch).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mirrorFile = resolve(root, 'src/lib/customFields.ts');
const sourceFile = resolve(root, '../multi-stores-shared/src/personalization/rules.ts');
const messagesDir = resolve(root, 'src/i18n/messages');
const LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];

const read = (file) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const failures = [];

const mirror = read(mirrorFile);
const begin = mirror.indexOf('// BEGIN MIRROR');
const end = mirror.indexOf('// END MIRROR');
if (begin < 0 || end < 0 || end < begin) {
  console.error(`BEGIN/END MIRROR markers not found in ${mirrorFile}`);
  process.exit(1);
}

// Drop the marker lines and their `// ====` rules; keep the code in between.
const block = mirror
  .slice(mirror.indexOf('\n', begin) + 1, mirror.lastIndexOf('\n', end))
  .split('\n')
  .filter((line) => !/^\/\/ =+$/.test(line))
  .join('\n');

const chunks = block
  .split(/\n\s*\n/)
  .map((chunk) => chunk.replace(/\s+$/, ''))
  .filter((chunk) => chunk.trim() !== '');

const source = read(sourceFile);
for (const chunk of chunks) {
  if (!source.includes(chunk)) {
    const firstLine = chunk.split('\n').find((l) => l.trim() !== '') ?? '';
    failures.push(`mirror chunk not found in shared rules.ts: ${firstLine.trim()}`);
  }
}

// Error codes of the mirrored `*_CODES` arrays.
const codes = new Set();
for (const m of block.matchAll(/export const \w+_CODES = \[([\s\S]*?)\]/g)) {
  for (const c of m[1].matchAll(/'([A-Z0-9_]+)'/g)) codes.add(c[1]);
}
if (codes.size === 0) failures.push('no *_CODES arrays found in the mirror block');

for (const locale of LOCALES) {
  const messages = JSON.parse(read(resolve(messagesDir, `${locale}.json`)));
  const errors = messages.errors ?? {};
  for (const code of codes) {
    if (typeof errors[code] !== 'string' || errors[code].trim() === '') {
      failures.push(`${locale}.json: missing errors.${code}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Personalization mirror check failed (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `Personalization mirror OK: ${chunks.length} chunks match shared rules.ts; ` +
    `${codes.size} error codes translated in ${LOCALES.length} locales.`,
);
