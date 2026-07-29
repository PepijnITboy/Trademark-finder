/**
 * Deterministic multilingual concept lexicon for trademark conceptual similarity.
 * Layer 1 only — translations/synonyms; not a legal judgment.
 */

const CONCEPT_GROUPS: ReadonlyArray<readonly string[]> = [
  ['lion', 'lowe', 'löwe', 'leeuw'],
  ['sun', 'sol', 'zon', 'soleil'],
  ['moon', 'luna', 'maan', 'lune'],
  ['fox', 'vos', 'fuchs'],
  ['red', 'rood', 'rode', 'rot', 'rouge', 'rojo'],
  ['king', 'konig', 'könig', 'koning', 'roi', 'rey'],
  ['wolf', 'wolves', 'loup', 'lobo'],
  ['star', 'ster', 'etoile', 'estrella', 'stern'],
];

function fold(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value: string): string[] {
  return fold(value).split(' ').filter(Boolean);
}

function conceptIdsForToken(token: string): number[] {
  const ids: number[] = [];
  CONCEPT_GROUPS.forEach((group, index) => {
    if (group.includes(token)) ids.push(index);
  });
  return ids;
}

export function conceptualSimilarity(
  left: string,
  right: string,
): { exactTranslation: number; synonym: number; taxonomyRelation: number } {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return { exactTranslation: 0, synonym: 0, taxonomyRelation: 0 };
  }

  const leftConcepts = new Set(leftTokens.flatMap(conceptIdsForToken));
  const rightConcepts = new Set(rightTokens.flatMap(conceptIdsForToken));
  let shared = 0;
  for (const id of leftConcepts) {
    if (rightConcepts.has(id)) shared += 1;
  }

  if (shared === 0) {
    return { exactTranslation: 0, synonym: 0, taxonomyRelation: 0 };
  }

  const coverage = shared / Math.max(leftConcepts.size, rightConcepts.size, 1);
  return {
    exactTranslation: coverage >= 0.99 ? 1 : coverage,
    synonym: coverage,
    taxonomyRelation: coverage,
  };
}
