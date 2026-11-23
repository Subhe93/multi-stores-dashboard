// Rollout flag of the M165 product link picker. The storefront must resolve
// `product:<id>` references before owners can store them, so production
// turns it on (NEXT_PUBLIC_PRODUCT_LINK_PICKER=1) only after the web deploy.
// Default: on in development, off in a production build.

export function productLinkPickerFlag(raw: string | undefined, nodeEnv: string | undefined): boolean {
  if (raw !== undefined && raw !== '') return raw === '1' || raw.toLowerCase() === 'true';
  return nodeEnv !== 'production';
}

export function productLinkPickerEnabled(): boolean {
  // Inlined by Next at build time (NEXT_PUBLIC_*).
  return productLinkPickerFlag(process.env.NEXT_PUBLIC_PRODUCT_LINK_PICKER, process.env.NODE_ENV);
}
