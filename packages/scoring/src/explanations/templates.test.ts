import { describe, expect, it } from 'vitest';
import type { TrademarkFeatureVector } from '@merkwacht/domain';
import { buildDeterministicExplanation } from './templates.js';

const baseFeatures: TrademarkFeatureVector = {
  exact: { raw: 0, normalized: 1, compact: 1, transliterated: 1 },
  orthographic: {
    levenshtein: 1,
    damerauLevenshtein: 1,
    jaro: 1,
    jaroWinkler: 1,
    lcs: 1,
    trigram: 1,
    prefix: 1,
    suffix: 1,
    lengthRatio: 1,
    weightedEdit: 1,
  },
  token: {
    tokenSet: 1,
    tokenSequence: 1,
    dominantElement: 1,
    sharedDistinctiveCount: 1,
    sharedWeakCount: 0,
  },
  phonetic: {
    bestCodeSimilarity: 1,
    phonemeEditSimilarity: 1,
    phonemeNgramSimilarity: 1,
    consonantSkeletonSimilarity: 1,
    crossLanguageSimilarity: 1,
  },
  conceptual: { exactTranslation: 0, synonym: 0, taxonomyRelation: 0 },
  goodsServices: {
    identity: 1,
    overallSimilarity: 0.9,
    competition: 0.9,
    complementarity: 0,
    channelOverlap: 0,
    audienceOverlap: 0,
    coverage: 1,
  },
  legalContext: { territoryOverlap: 1, earlierRightValid: 1, actionability: 1 },
  metadata: {
    earlierLength: 5,
    laterLength: 5,
    languageCombination: 'nl+en',
    registryCombination: 'BOIP|BOIP',
    sameNiceClass: true,
    missingFeatureCount: 0,
  },
};

describe('buildDeterministicExplanation', () => {
  it('uses exact template for identical normalized names', () => {
    const result = buildDeterministicExplanation({
      earlierMark: 'ZENZO',
      laterMark: 'ZENZO',
      features: baseFeatures,
      evidence: [],
    });
    expect(result.usedTemplateIds).toContain('exact_normalized');
    expect(result.summaryNl.toLowerCase()).toContain('exact');
  });
});
