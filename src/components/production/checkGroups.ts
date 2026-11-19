import type { ProductionCheck } from './production.api';

// Repeater instances ("Artikel 1", "Artikel 2", …) of a production line as
// framed groups: shared by the checklist card, the workspace and the sheet.

export type CheckBlock =
  | { kind: 'single'; check: ProductionCheck }
  | {
      kind: 'group';
      index: number;
      label: string;
      checks: { check: ProductionCheck; fieldLabel: string }[];
      done: number;
      total: number;
    };

/** Field part of a grouped check label ("Artikel 2 – Namn" → "Namn"). */
export function fieldLabelOf(c: ProductionCheck): string {
  const prefix = c.group_label ? `${c.group_label} – ` : null;
  if (prefix && c.label.startsWith(prefix)) return c.label.slice(prefix.length);
  const dash = c.label.indexOf(' – ');
  return dash > 0 ? c.label.slice(dash + 3) : c.label;
}

/**
 * Checks of one line as render blocks: every repeater instance ("Artikel 2")
 * becomes one framed group at the place of its first check, ordered by
 * instance number; other checks stay single rows. Inside a group the fields
 * follow one order for every instance (first seen across the instances), so
 * each article reads Namn, Färg the same way. Stale checks go last.
 */
export function groupChecks(sorted: ProductionCheck[]): CheckBlock[] {
  const grouped = sorted.filter((c) => c.group_index !== null && c.group_index !== undefined);
  if (grouped.length === 0) return sorted.map((check) => ({ kind: 'single', check }));

  const byIndex = new Map<number, ProductionCheck[]>();
  for (const c of grouped) {
    const list = byIndex.get(c.group_index!) ?? [];
    list.push(c);
    byIndex.set(c.group_index!, list);
  }
  const indexes = [...byIndex.keys()].sort((a, b) => a - b);
  const rank = new Map<string, number>();
  for (const i of indexes) {
    for (const c of byIndex.get(i)!) {
      const key = fieldLabelOf(c);
      if (!rank.has(key)) rank.set(key, rank.size);
    }
  }

  const groups = new Map<number, CheckBlock>();
  for (const i of indexes) {
    const checks = byIndex
      .get(i)!
      .map((check) => ({ check, fieldLabel: fieldLabelOf(check) }))
      .sort(
        (a, b) =>
          Number(a.check.stale) - Number(b.check.stale) ||
          (rank.get(a.fieldLabel) ?? 0) - (rank.get(b.fieldLabel) ?? 0) ||
          a.check.sort_order - b.check.sort_order,
      );
    const live = checks.filter((g) => !g.check.stale);
    const first = checks[0].check;
    groups.set(i, {
      kind: 'group',
      index: i,
      label: first.group_label || first.label.slice(0, Math.max(0, first.label.indexOf(' – '))) || `#${i}`,
      checks,
      done: live.filter((g) => g.check.done).length,
      total: live.length,
    });
  }

  // The groups take the place of the first grouped check, in number order.
  const out: CheckBlock[] = [];
  let placed = false;
  for (const c of sorted) {
    if (c.group_index === null || c.group_index === undefined) {
      out.push({ kind: 'single', check: c });
    } else if (!placed) {
      placed = true;
      for (const i of indexes) out.push(groups.get(i)!);
    }
  }
  return out;
}

