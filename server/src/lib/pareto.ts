/**
 * Pareto / ABC analysis utility.
 *
 * Finds the smallest subset of items whose cumulative value accounts for
 * at least `cumulativeThreshold` of the total value.
 *
 * Decision rules (from PLAN_codex / plan file):
 *  - < 5  items → return null (not enough data to show concentration)
 *  - < 10 items → use top 3 absolute
 *  - ≥ 10 items → top N where N ≤ 10 AND cumulative LTV ≥ threshold × total
 */

export interface ParetoResult {
  topN: number;     // absolute count in top subset
  topPct: number;   // topN / total × 100   (integer)
  valuePct: number; // cumulative value of topN / total × 100  (integer)
}

export function computePareto<T>(
  items: T[],
  valueFn: (x: T) => number,
  cumulativeThreshold = 0.7,
): ParetoResult | null {
  if (items.length < 5) return null;

  const sorted = [...items].sort((a, b) => valueFn(b) - valueFn(a));
  const totalValue = sorted.reduce((s, x) => s + valueFn(x), 0);

  if (totalValue <= 0) return null;

  let topN: number;
  let cumSum: number;

  if (items.length < 10) {
    // Too few leads for % analysis — use top 3 absolute
    topN = Math.min(3, sorted.length);
    cumSum = sorted.slice(0, topN).reduce((s, x) => s + valueFn(x), 0);
  } else {
    // Find smallest N where N ≤ 10 and cumulative value ≥ threshold
    topN = Math.min(10, sorted.length); // default to cap
    cumSum = 0;
    for (let n = 1; n <= Math.min(10, sorted.length); n++) {
      cumSum += valueFn(sorted[n - 1]);
      if (cumSum / totalValue >= cumulativeThreshold) {
        topN = n;
        break;
      }
    }
    // Ensure cumSum is accurate for the final topN
    if (topN === Math.min(10, sorted.length)) {
      cumSum = sorted.slice(0, topN).reduce((s, x) => s + valueFn(x), 0);
    }
  }

  return {
    topN,
    topPct: Math.round((topN / items.length) * 100),
    valuePct: Math.round((cumSum / totalValue) * 100),
  };
}
