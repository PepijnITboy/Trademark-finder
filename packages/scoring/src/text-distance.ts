/** Classic Levenshtein edit distance between two strings. */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    const currentRow = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const deletionCost = (previousRow[j] ?? 0) + 1;
      const insertionCost = (currentRow[j - 1] ?? 0) + 1;
      const substitutionCost = (previousRow[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      currentRow.push(Math.min(deletionCost, insertionCost, substitutionCost));
    }
    previousRow = currentRow;
  }

  return previousRow[b.length] ?? Math.max(a.length, b.length);
}

/** Normalized string similarity in `[0, 1]`, derived from Levenshtein distance (`1` = identical). */
export function normalizedStringSimilarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLength;
}

/** Jaccard similarity (`|A ∩ B| / |A ∪ B|`) between two sets, `1` when both are empty. */
export function jaccardSimilarity<T>(a: readonly T[], b: readonly T[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 1;

  let intersectionSize = 0;
  for (const value of setA) {
    if (setB.has(value)) intersectionSize += 1;
  }
  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 1 : intersectionSize / unionSize;
}
