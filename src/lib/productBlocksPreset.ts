// Block-based product page helpers (product layout wave 4, D2):
// - the nested "Classic product page" preset (same tree as the API's
//   "Convert to blocks": multi-stores-api/src/modules/pages-v2/product-blocks-convert.ts);
// - inserting a nested preset parent-first through a create callback;
// - when the inspector offers "Convert to blocks".
// Pure (no runtime imports) so the node test runner can load it.

/** A preset section; `children` only on layout containers. */
export interface PresetNode {
  section_key: string;
  settings: Record<string, unknown>;
  // Content variants per locale; the inserted translation uses the store's
  // primary locale's variant when it exists, else `en`.
  content: Record<string, Record<string, unknown>>;
  children?: PresetNode[];
}

/** Body of one POST /v2/pages/:id/sections, with the children to create under it. */
export interface PresetNodeBody {
  section_key: string;
  settings: Record<string, unknown>;
  content: Record<string, unknown>;
  children: PresetNodeBody[];
}

export const PRODUCT_PAGE_SECTION_KEY = 'product-page';

/**
 * Sections that must not share a page with a new set of product blocks: the
 * monolith and the add-to-cart composite each keep their own buy form, and a
 * second variants / personalization / buy set would show two.
 */
export const PRODUCT_BLOCK_CONFLICT_KEYS: readonly string[] = [
  PRODUCT_PAGE_SECTION_KEY,
  'add-to-cart',
  'product-variants',
  'product-personalization',
  'product-buy',
];

const leaf = (section_key: string, settings: Record<string, unknown> = {}): PresetNode => ({
  section_key,
  settings,
  content: {},
});

/**
 * The monolith's vertical spacing as section padding (desktop >= 1024px,
 * tablet = below 1024px = below Tailwind's lg, mobile inherits tablet).
 * Same values as the API's convert (CLASSIC_*_PADDING there).
 */
// Page top (py-8 lg:py-10) + breadcrumb bottom margin (mb-6 lg:mb-8).
export const CLASSIC_BREADCRUMB_PADDING = {
  desktop: { top: 40, bottom: 32 },
  tablet: { top: 32, bottom: 24 },
};
// Page bottom (py-8 lg:py-10), always on the row: the storefront hides a root
// product block that renders nothing (tabs of a product without description,
// specifications or FAQs), and the page must then still end like the
// monolith's.
export const CLASSIC_ROW_PADDING = {
  desktop: { bottom: 40 },
  tablet: { bottom: 32 },
};
// Tabs top margin (mt-12 lg:mt-16) minus the row's page bottom above it, then
// the page bottom again: 40 + 24 = 64 and 32 + 16 = 48 between the columns
// and the tabs, like the monolith.
export const CLASSIC_TABS_PADDING = {
  desktop: { top: 24, bottom: 40 },
  tablet: { top: 16, bottom: 32 },
};

/**
 * The monolith's thin info-column divider (`border-t border-gray-100`: a 1px
 * box whose top border is the line) as a `spacer` section: 1px tall with its
 * 1px rule centred, so it takes the same room and draws the same line at the
 * same spot. #f3f4f6 = Tailwind v4 gray-100. Same settings as the API's
 * convert (CLASSIC_DIVIDER_SETTINGS there).
 */
export const CLASSIC_DIVIDER_SETTINGS = {
  height_px: 1,
  show_divider: true,
  divider_style: 'solid',
  divider_color: '#f3f4f6',
};

/**
 * Breadcrumb + Row [ Column(gallery, sticky) | Column(title … shipping) ] +
 * tabs, with the geometry of today's product page (ProductPageMagic +
 * ProductDetailClient): breadcrumb full width above both columns; equal
 * columns side by side from 768px (md:grid-cols-2), gap 32px below 1024px
 * and 56px above (gap-8 lg:gap-14); gallery sticky 96px from the top
 * wherever the columns sit side by side (md:sticky md:top-24); 20px between
 * the info blocks (gap-5), with its two thin dividers (1px spacers, see
 * CLASSIC_DIVIDER_SETTINGS). Personalization always sits next to variants and
 * buy: it holds the piece-one option and the designer form.
 */
export const CLASSIC_PRODUCT_PRESET_SECTIONS: PresetNode[] = [
  leaf('product-breadcrumb', { show_current: true, _style: { padding: CLASSIC_BREADCRUMB_PADDING } }),
  {
    section_key: 'layout-row',
    settings: {
      gap_px: 56,
      gap_tablet_px: 32,
      align: 'stretch',
      child_width: 'fill',
      justify: 'start',
      wrap: false,
      stack_on: 'mobile',
      reverse_on_mobile: false,
      _style: { padding: CLASSIC_ROW_PADDING },
    },
    content: {},
    children: [
      {
        section_key: 'layout-column',
        settings: {
          gap_px: 16,
          align: 'stretch',
          sticky_desktop: true,
          sticky_top_px: 96,
          sticky_from: 'tablet',
          _layout: { span: { desktop: 1 } },
        },
        content: {},
        children: [leaf('product-gallery', { layout: 'classic', aspect: 'square', enable_zoom: true })],
      },
      {
        section_key: 'layout-column',
        settings: {
          gap_px: 20,
          align: 'stretch',
          sticky_desktop: false,
          sticky_top_px: 24,
          sticky_from: 'desktop',
          _layout: { span: { desktop: 1 } },
        },
        content: {},
        children: [
          leaf('product-title', { show_collection: true, show_vendor: true }),
          leaf('product-price', { show_compare_at: true, show_savings: true, show_unit_price: true, show_sku: true }),
          leaf('product-short-description'),
          leaf('product-promotions', { show_end_date: true }),
          leaf('product-bundles'),
          // The monolith's two always-shown dividers: after promotions /
          // bundles (empty for most products) and above the buy block.
          leaf('spacer', { ...CLASSIC_DIVIDER_SETTINGS }),
          // The app's before-variants fields sit above the picker, as today.
          leaf('product-personalization', { placement: 'before_variants', show_heading: true, button_style: 'solid' }),
          leaf('product-variants'),
          leaf('product-personalization', { placement: 'after_variants', show_heading: true, button_style: 'solid' }),
          leaf('spacer', { ...CLASSIC_DIVIDER_SETTINGS }),
          leaf('product-buy', { button_style: 'solid', show_quantity: true, sticky_on_mobile: false }),
          leaf('product-trust', { columns: '2' }),
          leaf('product-shipping', { show_heading: true }),
        ],
      },
    ],
  },
  leaf('product-tabs', {
    show_description: true,
    show_specifications: true,
    show_faqs: true,
    show_shipping: false,
    show_returns: false,
    _style: { padding: CLASSIC_TABS_PADDING },
  }),
];

/**
 * Resolve preset nodes into create bodies. Content picks the primary-locale
 * variant, else `en`. Nodes rejected by `keep` (e.g. an unknown schema) are
 * dropped with their children.
 */
export function presetNodeBodies(
  nodes: readonly PresetNode[],
  primaryLocale: string,
  keep: (sectionKey: string) => boolean = () => true,
): PresetNodeBody[] {
  return nodes
    .filter((n) => keep(n.section_key))
    .map((n) => ({
      section_key: n.section_key,
      settings: JSON.parse(JSON.stringify(n.settings)) as Record<string, unknown>,
      content: { ...(n.content[primaryLocale] ?? n.content.en ?? {}) },
      children: presetNodeBodies(n.children ?? [], primaryLocale, keep),
    }));
}

/** Leaf section keys of a preset in display order (the "Includes" line). */
export function presetLeafKeys(nodes: readonly { section_key: string; children?: readonly unknown[] }[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    const kids = (n.children ?? []) as { section_key: string; children?: readonly unknown[] }[];
    if (kids.length > 0) out.push(...presetLeafKeys(kids));
    else out.push(n.section_key);
  }
  return out;
}

/** True when any node of the preset has children (needs the tree endpoint). */
export function presetIsNested(nodes: readonly { children?: readonly unknown[] }[]): boolean {
  return nodes.some((n) => (n.children?.length ?? 0) > 0);
}

/**
 * Create a preset's sections parent-first: each root via `create(body, null)`,
 * then its children under the returned id, depth-first, in order. Every
 * created row is pushed onto `created` as soon as it exists, so a caller can
 * keep its state in sync with the server when a later create fails (the
 * error still propagates).
 */
export async function createPresetTree<T extends { id: string }>(
  bodies: readonly PresetNodeBody[],
  create: (body: PresetNodeBody, parentId: string | null) => Promise<T>,
  created: T[] = [],
  parentId: string | null = null,
): Promise<T[]> {
  for (const body of bodies) {
    const row = await create(body, parentId);
    created.push(row);
    if (body.children.length > 0) {
      await createPresetTree(body.children, create, created, row.id);
    }
  }
  return created;
}

interface SectionLike {
  id: string;
  section_key: string;
  parent_id?: string | null;
  is_hidden?: boolean;
}

/**
 * Visible sections of the page with one of `keys` (default: the sections that
 * conflict with a new set of product blocks, PRODUCT_BLOCK_CONFLICT_KEYS). A
 * section inside a hidden container counts as hidden.
 */
export function visibleSectionsWithKeys<T extends SectionLike>(
  sections: readonly T[],
  keys: readonly string[] = PRODUCT_BLOCK_CONFLICT_KEYS,
): T[] {
  const byId = new Map<string, SectionLike>(sections.map((s) => [s.id, s]));
  const hidden = (s: SectionLike): boolean => {
    const seen = new Set<string>();
    let cur: SectionLike | undefined = s;
    while (cur && !seen.has(cur.id)) {
      if (cur.is_hidden) return true;
      seen.add(cur.id);
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return false;
  };
  return sections.filter((s) => keys.includes(s.section_key) && !hidden(s));
}

/**
 * The inspector offers "Convert to blocks" for a visible, top-level
 * product-page section while the block-based product page is enabled.
 */
export function canConvertToBlocks(section: SectionLike | null | undefined, layoutContainers: boolean): boolean {
  return (
    !!section &&
    layoutContainers &&
    section.section_key === PRODUCT_PAGE_SECTION_KEY &&
    !section.is_hidden &&
    !section.parent_id
  );
}
