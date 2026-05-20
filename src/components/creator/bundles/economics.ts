// Client-side mirror of the API's bundle-economics util. Used to flag bundles
// that would push a product's effective price below the provider's base cost,
// before the user wastes time hitting Save and getting a server error.

import type { BundleOffer } from './types';

export interface ProductPricingForCheck {
  /** What the customer pays per unit (before bundle discount). */
  unitPrice: number;
  /** What the platform owes the provider per unit. 0 means creator-only. */
  providerBasePrice: number;
}

function computeEffectiveUnitPrice(unitPrice: number, offer: BundleOffer): number {
  const unit = Number(unitPrice) || 0;
  const q = Number(offer.quantity) || 0;
  const d = Number(offer.discount_value) || 0;
  if (q <= 0) return unit;

  if (offer.discount_type === 'PERCENTAGE') {
    const pct = Math.min(100, Math.max(0, d));
    return (unit * q * (1 - pct / 100)) / q;
  }
  if (offer.discount_type === 'FIXED') {
    return Math.max(0, unit * q - d) / q;
  }
  // ITEM: buy q get d free
  const cartQuantity = q + d;
  return cartQuantity > 0 ? (unit * q) / cartQuantity : unit;
}

/**
 * Returns true when ANY offer on the bundle would push the effective unit
 * price below the provider's base cost. Skips silently for creator-only
 * products (providerBasePrice === 0).
 */
export function bundleHasEconomicConflict(
  offers: BundleOffer[],
  product: ProductPricingForCheck,
): boolean {
  if (product.providerBasePrice <= 0) return false;
  for (const offer of offers) {
    const eff = computeEffectiveUnitPrice(product.unitPrice, offer);
    if (eff < product.providerBasePrice) return true;
  }
  return false;
}

export type CustomPricingType = 'SINGLE' | 'PER_VARIANT' | 'MARGIN';

interface VariantInfo {
  id: string;
  price_adjustment: number;
}

interface ComputeArgs {
  pricingType: CustomPricingType;
  baseProviderPrice: number;
  hasProvider: boolean;
  finalPrice: number;
  marginAmount: number;
  /** Variants the creator selected for this custom product. */
  selectedVariants: VariantInfo[];
  /** Per-variant custom prices the creator entered (PER_VARIANT only). */
  variantCustomPrices: Record<string, number>;
}

/**
 * Compute a single conservative (unitPrice, providerBasePrice) pair so the
 * bundle check can flag a conflict that affects ANY variant. Mirrors what
 * orders.service computes per cart line, but reduced to a worst case for
 * the UI:
 *  - SINGLE   : one price, used directly.
 *  - MARGIN   : per-variant price = base + adjustment + margin. Worst case
 *               is the variant with the smallest customer/provider gap.
 *  - PER_VARIANT: per-variant customer price = custom_price (fallback to
 *                 base + adjustment). Worst case as above.
 */
export function computeProductPricingForBundleCheck({
  pricingType,
  baseProviderPrice,
  hasProvider,
  finalPrice,
  marginAmount,
  selectedVariants,
  variantCustomPrices,
}: ComputeArgs): ProductPricingForCheck {
  if (pricingType === 'SINGLE') {
    return {
      unitPrice: finalPrice || baseProviderPrice,
      providerBasePrice: hasProvider ? baseProviderPrice : 0,
    };
  }

  // Without variants there's nothing to compare against — fall back to base.
  if (selectedVariants.length === 0) {
    const unit =
      pricingType === 'MARGIN'
        ? baseProviderPrice + marginAmount
        : finalPrice || baseProviderPrice;
    return {
      unitPrice: unit,
      providerBasePrice: hasProvider ? baseProviderPrice : 0,
    };
  }

  // Worst case for the creator: smallest gap between customer price and
  // provider cost. We flag the bundle if even one variant would be sold at
  // a loss, so we surface the riskiest variant.
  let worstUnit = Infinity;
  let worstProvider = 0;
  for (const v of selectedVariants) {
    const adj = Number(v.price_adjustment) || 0;
    const provider = hasProvider ? baseProviderPrice + adj : 0;
    let customer = 0;
    if (pricingType === 'MARGIN') {
      customer = baseProviderPrice + adj + marginAmount;
    } else {
      const cp = variantCustomPrices[v.id];
      customer = cp && cp > 0 ? cp : baseProviderPrice + adj;
    }
    // The riskiest variant has the smallest margin: pick the one whose
    // (customer - provider) is smallest.
    if (customer - provider < worstUnit - worstProvider) {
      worstUnit = customer;
      worstProvider = provider;
    }
  }
  if (!Number.isFinite(worstUnit)) {
    worstUnit = baseProviderPrice;
    worstProvider = hasProvider ? baseProviderPrice : 0;
  }
  return { unitPrice: worstUnit, providerBasePrice: worstProvider };
}
