import type { TrademarkMatchScores } from '@merkwacht/domain';

/**
 * A versioned set of weights (summing to 100) used to combine
 * {@link TrademarkMatchScores} components into a single `totalScore`. See
 * `docs/scoring/weights.md`.
 */
export interface ScoringWeightProfile {
  readonly id: string;
  readonly weights: Readonly<Record<keyof TrademarkMatchScores, number>>;
}

/**
 * Default (`v1`) weight profile: 25/22/13/8/17/8/4/3, summing to 100. See
 * `docs/scoring/weights.md` for the rationale behind each weight.
 */
export const DEFAULT_WEIGHT_PROFILE: ScoringWeightProfile = {
  id: 'v1',
  weights: {
    textualSimilarity: 25,
    phoneticSimilarity: 22,
    niceClassOverlap: 17,
    visualSimilarity: 13,
    goodsServicesOverlap: 8,
    semanticSimilarity: 8,
    geographicOverlap: 4,
    aiPlausibilityAdjustment: 3,
  },
};

/** Every weight profile Merkwacht has ever shipped, keyed by `id`. New profiles are additive — never mutate an existing one. */
export const WEIGHT_PROFILES: Readonly<Record<string, ScoringWeightProfile>> = {
  v1: DEFAULT_WEIGHT_PROFILE,
};

function sumWeights(profile: ScoringWeightProfile): number {
  return Object.values(profile.weights).reduce((sum, weight) => sum + weight, 0);
}

/** Asserts a weight profile's weights sum to exactly 100. Used in tests for every exported profile. */
export function assertValidWeightProfile(profile: ScoringWeightProfile): void {
  const total = sumWeights(profile);
  if (Math.abs(total - 100) > 1e-9) {
    throw new Error(`weight profile "${profile.id}" weights sum to ${total}, expected 100`);
  }
}
