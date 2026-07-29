import { describe, expect, it } from 'vitest';
import type { TrademarkFeatureVector } from '@merkwacht/domain';
import { assessRiskFromFeatures } from './assess-risk.js';

function baseFeatures(overrides: Partial<TrademarkFeatureVector> = {}): TrademarkFeatureVector {
  const empty: TrademarkFeatureVector = {
    exact: { raw: 0, normalized: 0, compact: 0, transliterated: 0 },
    orthographic: {
      levenshtein: 0,
      damerauLevenshtein: 0,
      jaro: 0,
      jaroWinkler: 0,
      lcs: 0,
      trigram: 0,
      prefix: 0,
      suffix: 0,
      lengthRatio: 1,
      weightedEdit: 0,
    },
    token: {
      tokenSet: 0,
      tokenSequence: 0,
      dominantElement: 0,
      sharedDistinctiveCount: 0,
      sharedWeakCount: 0,
    },
    phonetic: {
      bestCodeSimilarity: 0,
      phonemeEditSimilarity: 0,
      phonemeNgramSimilarity: 0,
      consonantSkeletonSimilarity: 0,
      crossLanguageSimilarity: 0,
    },
    conceptual: { exactTranslation: 0, synonym: 0, taxonomyRelation: 0 },
    goodsServices: {
      identity: 0,
      overallSimilarity: 0,
      competition: 0,
      complementarity: 0,
      channelOverlap: 0,
      audienceOverlap: 0,
      coverage: 0,
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
  return { ...empty, ...overrides };
}

describe('assessRiskFromFeatures', () => {
  it('exact match + high goods => at least strong', () => {
    const risk = assessRiskFromFeatures(
      baseFeatures({
        exact: { raw: 1, normalized: 1, compact: 1, transliterated: 1 },
        goodsServices: {
          identity: 1,
          overallSimilarity: 1,
          competition: 1,
          complementarity: 0,
          channelOverlap: 0,
          audienceOverlap: 0,
          coverage: 1,
        },
      }),
    );
    expect(risk.riskBand).toBe('strong');
    expect(risk.reasonCodes).toContain('exact_or_compact_match');
  });

  it('missing goods lowers confidence instead of forcing irrelevant', () => {
    const risk = assessRiskFromFeatures(
      baseFeatures({
        orthographic: {
          levenshtein: 0.9,
          damerauLevenshtein: 0.9,
          jaro: 0.9,
          jaroWinkler: 0.92,
          lcs: 0.8,
          trigram: 0.7,
          prefix: 0.8,
          suffix: 0.8,
          lengthRatio: 1,
          weightedEdit: 0.95,
        },
        metadata: {
          earlierLength: 5,
          laterLength: 5,
          languageCombination: 'nl+en',
          registryCombination: 'BOIP|BOIP',
          sameNiceClass: true,
          missingFeatureCount: 2,
        },
      }),
    );
    expect(risk.confidence).toBeLessThan(0.85);
    expect(risk.reasonCodes).toContain('missing_feature_data');
    expect(risk.riskBand).not.toBe('irrelevant');
  });
});
