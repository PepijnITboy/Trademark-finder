/**
 * Offline evaluation helpers (recall@K, nDCG stub) — used by golden/eval suites.
 * No automatic promotion of models.
 */

export function recallAtK(relevantIds: readonly string[], rankedIds: readonly string[], k: number): number {
  if (relevantIds.length === 0) return 1;
  const top = new Set(rankedIds.slice(0, k));
  let hit = 0;
  for (const id of relevantIds) {
    if (top.has(id)) hit += 1;
  }
  return hit / relevantIds.length;
}

export function meanAveragePrecision(
  relevantIds: readonly string[],
  rankedIds: readonly string[],
): number {
  if (relevantIds.length === 0) return 1;
  const relevant = new Set(relevantIds);
  let hits = 0;
  let sumPrecision = 0;
  rankedIds.forEach((id, index) => {
    if (!relevant.has(id)) return;
    hits += 1;
    sumPrecision += hits / (index + 1);
  });
  return hits === 0 ? 0 : sumPrecision / relevantIds.length;
}
