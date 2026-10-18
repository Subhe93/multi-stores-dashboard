// GTIN-8/12/13/14 check-digit validation (mirror of the API's
// src/modules/feeds/gtin.ts) so the product form can flag a typo before
// the save round-trip.
const LENGTHS = [8, 12, 13, 14];

export function isValidGtin(value: string): boolean {
  if (!/^\d+$/.test(value) || !LENGTHS.includes(value.length) || /^0+$/.test(value)) return false;
  const digits = value.split('').map(Number);
  const check = digits.pop() as number;
  let sum = 0;
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += (digits[i] as number) * w;
  return (10 - (sum % 10)) % 10 === check;
}
