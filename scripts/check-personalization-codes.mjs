#!/usr/bin/env node
/**
 * Personalization checks of the dashboard (M4.0 K6/W23, reworked in M5.3).
 *
 * The rules live only in `@multi-stores/core/personalization/rules`
 * (multi-stores-shared/packages/core); `src/lib/customFields.ts` re-exports
 * them. This script
 *   1. verifies that every error code of the package's `*_CODES` arrays has an
 *      `errors.<code>` message in all six dashboard locales, and
 *   2. runs the package's mirror guard on this repo, so nobody re-adds a copy
 *      of a package module (it used to be a byte-copied block).
 *
 * Usage: `npm run check:personalization-codes` (exits 1 on any problem).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CUSTOMER_UPLOAD_ERROR_CODES,
  CUSTOM_FIELD_DEFINITION_ERROR_CODES,
  CUSTOM_FIELD_ISSUE_CODES,
} from '@multi-stores/core/personalization/rules';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const messagesDir = resolve(root, 'src/i18n/messages');
const LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];

const failures = [];

const codes = new Set([
  ...CUSTOM_FIELD_ISSUE_CODES,
  ...CUSTOM_FIELD_DEFINITION_ERROR_CODES,
  ...CUSTOMER_UPLOAD_ERROR_CODES,
]);
if (codes.size === 0) failures.push('no error codes exported by @multi-stores/core/personalization/rules');

for (const locale of LOCALES) {
  const messages = JSON.parse(readFileSync(resolve(messagesDir, `${locale}.json`), 'utf8'));
  const errors = messages.errors ?? {};
  for (const code of codes) {
    if (typeof errors[code] !== 'string' || errors[code].trim() === '') {
      failures.push(`${locale}.json: missing errors.${code}`);
    }
  }
}

const coreDir = dirname(createRequire(import.meta.url).resolve('@multi-stores/core/package.json'));
try {
  execFileSync(process.execPath, [resolve(coreDir, 'tools/check-no-copies.mjs'), root], { stdio: 'pipe' });
} catch (e) {
  failures.push(String(e.stderr ?? e).trim());
}

if (failures.length > 0) {
  console.error(`Personalization check failed (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `Personalization OK: ${codes.size} error codes translated in ${LOCALES.length} locales; ` +
    'no copies of @multi-stores/core modules.',
);
