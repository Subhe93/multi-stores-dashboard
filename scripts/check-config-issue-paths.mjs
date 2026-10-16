#!/usr/bin/env node
/**
 * Checks `locateConfigIssue` (src/lib/configIssuePath.ts) against the path
 * shapes the API produces (M4.1 §4.3). The dashboard has no test runner, so
 * the module is transpiled with the project's TypeScript and imported here.
 *
 * Usage: `npm run check:config-issue-paths` (exits 1 on any mismatch).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deepStrictEqual } from 'node:assert';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'src/lib/configIssuePath.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { locateConfigIssue } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const cases = [
  // Field write (no prefix)
  ['pricing.amount', { area: 'pricing' }],
  ['conditions.rules[0].key', { area: 'visibility' }],
  ['repeat.lead.fields[0]', { area: 'repeat' }],
  ['ui.palette_hex.Red', { area: 'display' }],
  ['translations[0].label', { area: 'basics' }],
  ['translations[1].help_text', { area: 'display' }],
  ['name', { area: 'basics' }],
  [undefined, { area: 'basics' }],
  ['', { area: 'basics' }],
  ['children[1].conditions', { area: 'visibility', child: 1 }],
  // Preset apply (field-name prefix)
  ['name_1.pricing.amount', { area: 'pricing', field: 'name_1' }],
  ['dnc_items.repeat.count.map.3', { area: 'repeat', field: 'dnc_items' }],
  ['dnc_items.children[0].conditions', { area: 'visibility', field: 'dnc_items', child: 0 }],
  ['dnc_items.children[1].translations[0].note', { area: 'display', field: 'dnc_items', child: 1 }],
  ['dnc_items.children', { area: 'basics', field: 'dnc_items' }],
  // Library save (`definition.` prefix; `field` / `children[i]` are not names)
  ['definition', { area: 'basics' }],
  ['definition.field', { area: 'basics' }],
  ['definition.field.translations[0].label', { area: 'basics' }],
  ['definition.field.ui.placement', { area: 'display' }],
  ['definition.field.pricing', { area: 'pricing' }],
  ['definition.children', { area: 'basics' }],
  ['definition.children[0].name', { area: 'basics', child: 0 }],
  ['definition.children[2].conditions', { area: 'visibility', child: 2 }],
  ['definition.children[1].translations[0].sublabel', { area: 'display', child: 1 }],
  // Product option config
  ['variant_option_config', { area: 'productOptions' }],
  ['variant_option_config[2].valueMeta', { area: 'productOptions', option: 2 }],
  ['variant_option_config[0].valueMeta.Röd', { area: 'productOptions', option: 0, value: 'Röd' }],
  ['variant_option_config[1].valueMeta.2 st.count', { area: 'productOptions', option: 1, value: '2 st' }],
  ['variant_option_config[1].valueMeta.1.5 m.badge_color', { area: 'productOptions', option: 1, value: '1.5 m' }],
  ['variant_option_config[0].valueMeta.Blå.i18n', { area: 'productOptions', option: 0, value: 'Blå' }],
];

let failed = 0;
for (const [path, expected] of cases) {
  try {
    deepStrictEqual(locateConfigIssue(path), expected);
  } catch {
    failed += 1;
    console.error(`✗ ${JSON.stringify(path)} → ${JSON.stringify(locateConfigIssue(path))}, expected ${JSON.stringify(expected)}`);
  }
}
if (failed > 0) {
  console.error(`${failed} of ${cases.length} config issue path cases failed`);
  process.exit(1);
}
console.log(`All ${cases.length} config issue path cases pass`);
