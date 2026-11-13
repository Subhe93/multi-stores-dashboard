// Unit tests of the Classic product page preset and the "Convert to blocks"
// helpers (product layout wave 4, D2).
// Run: node --experimental-strip-types --test src/lib/productBlocksPreset.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSIC_DIVIDER_SETTINGS,
  CLASSIC_PRODUCT_PRESET_SECTIONS,
  canConvertToBlocks,
  createPresetTree,
  presetIsNested,
  presetLeafKeys,
  presetNodeBodies,
  visibleSectionsWithKeys,
} from './productBlocksPreset.ts';
import { findSectionSchema } from './section-schemas.ts';
import { isAvailableForPageType } from './sectionAvailability.ts';
import { CONTAINER_KEYS, MAX_SECTION_DEPTH } from './sectionTree.ts';

// Same tree as the API's convert (product-blocks-convert.ts) with shipping + tabs shown.
const CLASSIC_SHAPE = [
  'product-breadcrumb',
  'layout-row(layout-column(product-gallery),layout-column(product-title,product-price,product-short-description,product-promotions,product-bundles,spacer,product-personalization,product-variants,product-personalization,spacer,product-buy,product-trust,product-shipping))',
  'product-tabs',
];

const shapeOf = (nodes) =>
  nodes.map((n) => (n.children?.length ? `${n.section_key}(${shapeOf(n.children).join(',')})` : n.section_key));

const rowOf = (nodes) => nodes.find((n) => n.section_key === 'layout-row');

test('the Classic preset has the agreed tree', () => {
  assert.deepEqual(shapeOf(CLASSIC_PRODUCT_PRESET_SECTIONS), CLASSIC_SHAPE);
});

// Geometry of the monolith (ProductPageMagic + ProductDetailClient), same
// values as the API's convert (product-blocks-convert.ts).
test('the Classic preset reproduces the monolith geometry', () => {
  const [crumb, row, tabs] = CLASSIC_PRODUCT_PRESET_SECTIONS;
  // md:grid-cols-2 gap-8 lg:gap-14: side by side from 768px.
  assert.equal(row.settings.stack_on, 'mobile');
  assert.equal(row.settings.gap_px, 56);
  assert.equal(row.settings.gap_tablet_px, 32);
  assert.ok(!('gap_mobile_px' in row.settings));
  assert.equal(row.settings.child_width, 'fill');
  assert.equal(row.settings.align, 'stretch');
  const [galleryCol, infoCol] = row.children;
  // Equal columns; md:sticky md:top-24 on the gallery.
  assert.deepEqual(galleryCol.settings._layout, { span: { desktop: 1 } });
  assert.deepEqual(infoCol.settings._layout, { span: { desktop: 1 } });
  assert.equal(galleryCol.settings.sticky_desktop, true);
  assert.equal(galleryCol.settings.sticky_top_px, 96);
  assert.equal(galleryCol.settings.sticky_from, 'tablet');
  assert.equal(infoCol.settings.sticky_desktop, false);
  assert.equal(infoCol.settings.gap_px, 20);
  // Vertical spacing: py-8 lg:py-10, breadcrumb mb-6 lg:mb-8, tabs mt-12
  // lg:mt-16. The page bottom sits on the row (it stays when the storefront
  // hides empty tabs); row bottom + tabs top = 64 / 48.
  assert.deepEqual(crumb.settings._style, {
    padding: { desktop: { top: 40, bottom: 32 }, tablet: { top: 32, bottom: 24 } },
  });
  assert.deepEqual(row.settings._style, {
    padding: { desktop: { bottom: 40 }, tablet: { bottom: 32 } },
  });
  assert.deepEqual(tabs.settings._style, {
    padding: { desktop: { top: 24, bottom: 40 }, tablet: { top: 16, bottom: 32 } },
  });
  // Option values exist in the container schemas.
  const opt = (id, key) => findSectionSchema(id).schema.find((f) => f.key === key).options.map((o) => o.value);
  assert.ok(opt('layout-row', 'stack_on').includes(row.settings.stack_on));
  assert.ok(opt('layout-column', 'sticky_from').includes(galleryCol.settings.sticky_from));
});

test('every Classic preset section exists and is offered on the product template with the flag on', () => {
  const walk = (nodes, depth) => {
    for (const n of nodes) {
      const schema = findSectionSchema(n.section_key);
      assert.ok(schema, `${n.section_key} has a schema`);
      assert.ok(isAvailableForPageType(schema, 'PRODUCT_TEMPLATE', { layoutContainers: true }), n.section_key);
      const isContainer = CONTAINER_KEYS.includes(n.section_key);
      if (n.children?.length) assert.ok(isContainer, `${n.section_key} may hold children`);
      assert.ok(depth <= (isContainer ? MAX_SECTION_DEPTH - 1 : MAX_SECTION_DEPTH), `${n.section_key} depth ${depth}`);
      // Settings keys are schema fields (or the per-child _layout / section _style).
      const fieldKeys = new Set(schema.schema.map((f) => f.key));
      for (const key of Object.keys(n.settings)) {
        assert.ok(key === '_layout' || key === '_style' || fieldKeys.has(key), `${n.section_key}.${key} is a schema field`);
      }
      walk(n.children ?? [], depth + 1);
    }
  };
  walk(CLASSIC_PRODUCT_PRESET_SECTIONS, 1);
});

test('the Classic preset keeps personalization with variants + buy and never uses the add-to-cart composite', () => {
  const keys = presetLeafKeys(CLASSIC_PRODUCT_PRESET_SECTIONS);
  for (const k of ['product-variants', 'product-personalization', 'product-buy']) assert.ok(keys.includes(k), k);
  assert.ok(!keys.includes('add-to-cart'));
  assert.ok(!keys.includes('product-page'));
  assert.equal(presetIsNested(CLASSIC_PRODUCT_PRESET_SECTIONS), true);
  // Personalization is split around the variants like today's page: the
  // before-variants fields above the picker, the main block below it.
  const info = rowOf(CLASSIC_PRODUCT_PRESET_SECTIONS).children[1].children;
  const at = (i) => info[i];
  const vi = info.findIndex((n) => n.section_key === 'product-variants');
  assert.equal(at(vi - 1).section_key, 'product-personalization');
  assert.equal(at(vi - 1).settings.placement, 'before_variants');
  assert.equal(at(vi + 1).section_key, 'product-personalization');
  assert.equal(at(vi + 1).settings.placement, 'after_variants');
  const placements = findSectionSchema('product-personalization').schema.find((f) => f.key === 'placement');
  assert.deepEqual(placements.options.map((o) => o.value), ['all', 'before_variants', 'after_variants']);
  assert.equal(presetIsNested([{ section_key: 'hero-banner' }]), false);
});

// The monolith's two always-shown `border-t border-gray-100` dividers in the
// info column (gap-5): after promotions / bundles and above the buy block.
// Same settings as the API's convert (CLASSIC_DIVIDER_SETTINGS there).
test('the Classic preset reproduces the monolith dividers', () => {
  const info = rowOf(CLASSIC_PRODUCT_PRESET_SECTIONS).children[1].children;
  const keys = info.map((n) => n.section_key);
  assert.deepEqual(keys.slice(keys.indexOf('product-bundles'), keys.indexOf('product-buy') + 1), [
    'product-bundles',
    'spacer',
    'product-personalization',
    'product-variants',
    'product-personalization',
    'spacer',
    'product-buy',
  ]);
  const dividers = info.filter((n) => n.section_key === 'spacer');
  assert.equal(dividers.length, 2);
  for (const d of dividers) {
    assert.deepEqual(d.settings, { height_px: 1, show_divider: true, divider_style: 'solid', divider_color: '#f3f4f6' });
    assert.notEqual(d.settings, CLASSIC_DIVIDER_SETTINGS);
  }
  // 1px tall is inside the spacer schema's range; the default stays 48.
  const height = findSectionSchema('spacer').schema.find((f) => f.key === 'height_px');
  assert.ok(height.min <= 1);
  assert.equal(findSectionSchema('spacer').defaultSettings.height_px, 48);
});

test('presetNodeBodies picks the locale, copies settings and drops rejected nodes with their children', () => {
  const nodes = [
    {
      section_key: 'layout-row',
      settings: { _layout: { span: { desktop: 1 } } },
      content: { en: { a: 1 }, sv: { a: 2 } },
      children: [{ section_key: 'gone', settings: {}, content: {}, children: [{ section_key: 'x', settings: {}, content: {} }] }],
    },
  ];
  const sv = presetNodeBodies(nodes, 'sv', (k) => k !== 'gone');
  assert.deepEqual(sv, [{ section_key: 'layout-row', settings: { _layout: { span: { desktop: 1 } } }, content: { a: 2 }, children: [] }]);
  assert.deepEqual(presetNodeBodies(nodes, 'ar')[0].content, { a: 1 });
  // Deep copy: editing the body never touches the preset.
  sv[0].settings._layout.span.desktop = 9;
  assert.equal(nodes[0].settings._layout.span.desktop, 1);
});

test('createPresetTree creates parents first and passes their ids to the children', async () => {
  const bodies = presetNodeBodies(CLASSIC_PRODUCT_PRESET_SECTIONS, 'en');
  const calls = [];
  let n = 0;
  const created = await createPresetTree(bodies, async (body, parentId) => {
    const row = { id: `s${++n}`, section_key: body.section_key, parent_id: parentId };
    calls.push(row);
    return row;
  });
  assert.equal(created.length, 19);
  assert.deepEqual(created, calls);
  const byId = new Map(created.map((r) => [r.id, r]));
  for (const r of created) {
    if (r.parent_id) {
      assert.ok(created.indexOf(byId.get(r.parent_id)) < created.indexOf(r), 'parent created first');
    }
  }
  const row = created.find((r) => r.section_key === 'layout-row');
  assert.equal(row.section_key, 'layout-row');
  assert.equal(row.parent_id, null);
  const cols = created.filter((r) => r.parent_id === row.id);
  assert.deepEqual(cols.map((c) => c.section_key), ['layout-column', 'layout-column']);
  assert.deepEqual(created.filter((r) => r.parent_id === cols[0].id).map((r) => r.section_key), ['product-gallery']);
  assert.equal(created.filter((r) => r.parent_id === cols[1].id).length, 13);
  assert.deepEqual(created.filter((r) => r.parent_id === null).map((r) => r.section_key), [
    'product-breadcrumb',
    'layout-row',
    'product-tabs',
  ]);
});

test('createPresetTree reports what was created before a failure', async () => {
  const bodies = presetNodeBodies(CLASSIC_PRODUCT_PRESET_SECTIONS, 'en');
  const created = [];
  let n = 0;
  await assert.rejects(
    createPresetTree(
      bodies,
      async (body) => {
        if (body.section_key === 'product-title') throw new Error('nope');
        return { id: `s${++n}` };
      },
      created,
    ),
    /nope/,
  );
  // breadcrumb, row, gallery column, gallery, info column
  assert.equal(created.length, 5);
});

test('visibleSectionsWithKeys ignores hidden sections and sections in hidden containers', () => {
  const rows = [
    { id: 'm', section_key: 'product-page' },
    { id: 'r', section_key: 'layout-row', is_hidden: true },
    { id: 'b', section_key: 'product-buy', parent_id: 'r' },
    { id: 'a', section_key: 'add-to-cart', is_hidden: true },
    { id: 't', section_key: 'rich-text' },
  ];
  assert.deepEqual(visibleSectionsWithKeys(rows).map((r) => r.id), ['m']);
  assert.deepEqual(visibleSectionsWithKeys(rows, ['rich-text']).map((r) => r.id), ['t']);
});

test('canConvertToBlocks: visible top-level product page with the flag on', () => {
  const mono = { id: 'm', section_key: 'product-page' };
  assert.equal(canConvertToBlocks(mono, true), true);
  assert.equal(canConvertToBlocks(mono, false), false);
  assert.equal(canConvertToBlocks({ ...mono, is_hidden: true }, true), false);
  assert.equal(canConvertToBlocks({ ...mono, parent_id: 'r' }, true), false);
  assert.equal(canConvertToBlocks({ id: 'x', section_key: 'add-to-cart' }, true), false);
  assert.equal(canConvertToBlocks(null, true), false);
});
