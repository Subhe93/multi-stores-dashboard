export interface BulkResult<T> {
  ok: T[];
  failed: { item: T; error: string }[];
}

/**
 * Run `fn` for every item with limited concurrency (default 4) and collect
 * which items succeeded and which failed. Never throws.
 */
export async function runBulk<T>(
  items: T[],
  fn: (item: T) => Promise<unknown>,
  concurrency = 4,
): Promise<BulkResult<T>> {
  const result: BulkResult<T> = { ok: [], failed: [] };
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await fn(item);
        result.ok.push(item);
      } catch (err) {
        const message = (err as { message?: string })?.message || String(err);
        result.failed.push({ item, error: message });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return result;
}
