import { describe, expect, it } from 'vitest';
import {
  damerauLevenshteinSimilarity,
  jaroWinklerSimilarity,
  levenshteinDistance,
  normalizedStringSimilarity,
  trigramJaccardSimilarity,
  weightedEditSimilarity,
} from './text-distance.js';

describe('text-distance metrics', () => {
  it('levenshtein treats ZENZO/SENZO as one edit', () => {
    expect(levenshteinDistance('zenzo', 'senzo')).toBe(1);
    expect(normalizedStringSimilarity('zenzo', 'senzo')).toBeGreaterThan(0.75);
  });

  it('weighted edit treats S/Z and PH/F as cheap', () => {
    expect(weightedEditSimilarity('zenzo', 'senzo')).toBeGreaterThan(
      normalizedStringSimilarity('zenzo', 'senzo') - 0.01,
    );
    expect(weightedEditSimilarity('phlox', 'floks')).toBeGreaterThan(0.7);
  });

  it('damerau catches adjacent transposition', () => {
    expect(damerauLevenshteinSimilarity('abc', 'acb')).toBeGreaterThan(
      normalizedStringSimilarity('abc', 'acb'),
    );
  });

  it('jaro-winkler and trigram fire on close names', () => {
    expect(jaroWinklerSimilarity('zenzo', 'senzo')).toBeGreaterThan(0.85);
    expect(trigramJaccardSimilarity('zenzo', 'zenzoo')).toBeGreaterThan(0.4);
  });
});
