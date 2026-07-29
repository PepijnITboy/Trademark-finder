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

/** Damerau-Levenshtein distance (includes adjacent transposition). */
export function damerauLevenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const matrix: number[][] = Array.from({ length: al + 1 }, () =>
    Array.from({ length: bl + 1 }, () => 0),
  );
  for (let i = 0; i <= al; i += 1) matrix[i]![0] = i;
  for (let j = 0; j <= bl; j += 1) matrix[0]![j] = j;

  for (let i = 1; i <= al; i += 1) {
    for (let j = 1; j <= bl; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        matrix[i]![j] = Math.min(matrix[i]![j]!, matrix[i - 2]![j - 2]! + cost);
      }
    }
  }
  return matrix[al]![bl]!;
}

export function damerauLevenshteinSimilarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - damerauLevenshteinDistance(a, b) / maxLength;
}

/** Jaro similarity. */
export function jaroSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = Array.from({ length: a.length }, () => false);
  const bMatches = Array.from({ length: b.length }, () => false);

  let matches = 0;
  for (let i = 0; i < a.length; i += 1) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j += 1) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches += 1;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k += 1;
    if (a[i] !== b[k]) transpositions += 1;
    k += 1;
  }

  return (
    (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3
  );
}

/** Jaro-Winkler similarity with standard p=0.1 prefix scaling. */
export function jaroWinklerSimilarity(a: string, b: string, prefixScale = 0.1): number {
  const jaro = jaroSimilarity(a, b);
  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);
  while (prefix < maxPrefix && a[prefix] === b[prefix]) prefix += 1;
  return jaro + prefix * prefixScale * (1 - jaro);
}

function characterNgrams(value: string, n: number): string[] {
  if (value.length < n) return value.length === 0 ? [] : [value];
  const grams: string[] = [];
  for (let i = 0; i <= value.length - n; i += 1) {
    grams.push(value.slice(i, i + n));
  }
  return grams;
}

export function trigramJaccardSimilarity(a: string, b: string): number {
  return jaccardSimilarity(characterNgrams(a, 3), characterNgrams(b, 3));
}

export function longestCommonSubstringRatio(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  let best = 0;
  const row = Array.from({ length: b.length + 1 }, () => 0);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = 0;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = row[j]!;
      if (a[i - 1] === b[j - 1]) {
        row[j] = prev + 1;
        best = Math.max(best, row[j]!);
      } else {
        row[j] = 0;
      }
      prev = temp;
    }
  }
  return best / Math.max(a.length, b.length);
}

export type EditCostLocale = 'nl' | 'en' | 'de' | 'fr' | 'es' | 'it';

/** Single-character and multi-character substitution costs (lower = more similar). */
const SUBSTITUTION_GROUPS: ReadonlyArray<readonly string[]> = [
  ['s', 'z'],
  ['c', 'k'],
  ['c', 's'],
  ['f', 'v'],
  ['i', 'y'],
  ['q', 'k'],
  ['j', 'y'],
  ['u', 'v'],
  ['o', '0'],
  ['i', '1'],
  ['l', '1'],
];

const MULTI_SUBSTITUTIONS: ReadonlyArray<readonly [string, string]> = [
  ['ph', 'f'],
  ['ck', 'k'],
  ['qu', 'kw'],
  ['ks', 'x'],
  ['sch', 'sh'],
  ['ij', 'y'],
  ['aa', 'a'],
  ['ee', 'i'],
  ['oo', 'u'],
];

function substitutionCost(left: string, right: string): number {
  if (left === right) return 0;
  for (const group of SUBSTITUTION_GROUPS) {
    if (group.includes(left) && group.includes(right)) return 0.35;
  }
  return 1;
}

/**
 * Approximate weighted edit similarity using multi-char rewrites then Levenshtein
 * with cheap substitutions for confusable letters. Locale reserved for future profiles.
 */
export function weightedEditSimilarity(a: string, b: string, _locale: EditCostLocale = 'nl'): number {
  void _locale;
  let left = a;
  let right = b;
  for (const [from, to] of MULTI_SUBSTITUTIONS) {
    left = left.split(from).join(to);
    right = right.split(from).join(to);
  }

  const al = left.length;
  const bl = right.length;
  if (al === 0 && bl === 0) return 1;
  if (al === 0 || bl === 0) return 0;

  const matrix: number[][] = Array.from({ length: al + 1 }, () =>
    Array.from({ length: bl + 1 }, () => 0),
  );
  for (let i = 0; i <= al; i += 1) matrix[i]![0] = i;
  for (let j = 0; j <= bl; j += 1) matrix[0]![j] = j;

  for (let i = 1; i <= al; i += 1) {
    for (let j = 1; j <= bl; j += 1) {
      const cost = substitutionCost(left[i - 1]!, right[j - 1]!);
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }

  const distance = matrix[al]![bl]!;
  const maxLength = Math.max(al, bl);
  return 1 - distance / maxLength;
}
