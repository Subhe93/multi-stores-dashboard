/**
 * Page buttons to show: first, last, and the current page with one neighbour
 * on each side; null marks a gap ("…"). A gap of a single page is shown as
 * that page instead.
 */
export function pageWindow(page: number, totalPages: number): (number | null)[] {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const p of pages) {
    const prev = out[out.length - 1];
    if (typeof prev === 'number' && p - prev === 2) out.push(prev + 1);
    else if (typeof prev === 'number' && p - prev > 2) out.push(null);
    out.push(p);
  }
  return out;
}
