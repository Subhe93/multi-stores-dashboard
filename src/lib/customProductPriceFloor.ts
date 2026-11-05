/**
 * Minimum customer price of a creator's custom product (marketplace).
 * Mirrors the API check (custom-products/price-floor.ts): provider base
 * prices are net, so when the store's prices include VAT the customer price
 * must be at least (base + variant adjustment) x (1 + VAT rate), rounded up
 * to the cent. Prices excl. VAT only need the base.
 */

export interface PriceFloorInfo {
  prices_include_vat: boolean;
  vat_rate_bp: number;
  currency: string;
}

export type FloorPricingType = 'SINGLE' | 'PER_VARIANT' | 'MARGIN';

export interface FloorVariant {
  id: string;
  price_adjustment: number;
}

export interface FloorViolation {
  minimum: number;
  variantId?: string;
  /** MARGIN only: the smallest margin reaching every variant's minimum. */
  minimumMargin?: number;
}

const toMinor = (major: number) => Math.round((Number(major) || 0) * 100);

/** Minimum customer price (major units) for one net provider base. */
export function minimumPrice(baseNet: number, floor: PriceFloorInfo): number {
  const base = Math.max(0, toMinor(baseNet));
  if (!floor.prices_include_vat || floor.vat_rate_bp <= 0) return base / 100;
  return Math.ceil((base * (10000 + floor.vat_rate_bp)) / 10000) / 100;
}

/** Highest minimum among the variants sold (SINGLE pricing's floor). */
export function highestMinimum(basePrice: number, variants: FloorVariant[], floor: PriceFloorInfo): number {
  const costs = variants.length ? variants.map((v) => basePrice + (Number(v.price_adjustment) || 0)) : [basePrice];
  return Math.max(...costs.map((c) => minimumPrice(c, floor)));
}

/** Smallest margin that lifts every variant to its minimum (MARGIN pricing). */
export function minimumMargin(basePrice: number, variants: FloorVariant[], floor: PriceFloorInfo): number {
  const costs = variants.length ? variants.map((v) => basePrice + (Number(v.price_adjustment) || 0)) : [basePrice];
  return Math.max(...costs.map((c) => toMinor(minimumPrice(c, floor)) - toMinor(c))) / 100;
}

/** The first price below its minimum, or null (no floor = never). */
export function findFloorViolation(input: {
  floor: PriceFloorInfo | null | undefined;
  pricingType: FloorPricingType;
  basePrice: number;
  variants: FloorVariant[];
  finalPrice: string;
  marginAmount: string;
  variantPrices: Record<string, string>;
}): FloorViolation | null {
  const { floor, basePrice, variants } = input;
  if (!floor) return null;
  if (input.pricingType === 'SINGLE') {
    const min = highestMinimum(basePrice, variants, floor);
    return toMinor(parseFloat(input.finalPrice || '0')) < toMinor(min) ? { minimum: min } : null;
  }
  if (input.pricingType === 'MARGIN') {
    const needed = minimumMargin(basePrice, variants, floor);
    if (toMinor(parseFloat(input.marginAmount || '0')) >= toMinor(needed)) return null;
    return { minimum: highestMinimum(basePrice, variants, floor), minimumMargin: needed };
  }
  for (const v of variants) {
    const min = minimumPrice(basePrice + (Number(v.price_adjustment) || 0), floor);
    const raw = input.variantPrices[v.id];
    if (!raw) continue; // an empty price is caught by the required check
    if (toMinor(parseFloat(raw)) < toMinor(min)) return { minimum: min, variantId: v.id };
  }
  return null;
}
