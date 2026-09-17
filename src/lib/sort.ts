// The one comparator every sortable table in the app uses, so "unscored" or
// "undated" rows sorting last is a rule enforced once rather than a habit
// each table has to remember to repeat.

/**
 * Sorts `rows` by `key`, ascending or descending. A `null` value always
 * sorts to the end regardless of direction — "worst first" on a Score or
 * Weight column should not just surface every blank row, and the same holds
 * for a null date. Numbers compare numerically; everything else compares as
 * a locale-aware, numeric-aware string (so "KPI 2" sorts before "KPI 10").
 */
export function sortRows<T, K extends keyof T>(
  rows: T[],
  key: K,
  direction: "asc" | "desc"
): T[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * factor;
  });
}
