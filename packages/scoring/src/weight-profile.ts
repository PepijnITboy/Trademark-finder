import type { TrademarkMatchScores } from '@merkwacht/domain';

/**
 * A versioned set of weights (summing to 100) used to combine
 * {@link TrademarkMatchScores} components into a single `totalScore`.
 */
export interface ScoringWeightProfile {
  readonly id: string;
  readonly weights: Readonly<Record<keyof TrademarkMatchScores, number>>;
}

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

export const WEIGHT_PROFILES: Record<string, ScoringWeightProfile> = {
  v1: DEFAULT_WEIGHT_PROFILE,
};

let activeProfileId = 'v1';

function sumWeights(profile: ScoringWeightProfile): number {
  return Object.values(profile.weights).reduce((sum, weight) => sum + weight, 0);
}

export function assertValidWeightProfile(profile: ScoringWeightProfile): void {
  const total = sumWeights(profile);
  if (Math.abs(total - 100) > 1e-9) {
    throw new Error(`weight profile "${profile.id}" weights sum to ${total}, expected 100`);
  }
}

export function createWeightProfile(
  id: string,
  weights: Readonly<Record<keyof TrademarkMatchScores, number>>,
): ScoringWeightProfile {
  const profile = { id, weights };
  assertValidWeightProfile(profile);
  return profile;
}

export function getActiveWeightProfile(): ScoringWeightProfile {
  return WEIGHT_PROFILES[activeProfileId] ?? DEFAULT_WEIGHT_PROFILE;
}

export function setActiveWeightProfile(profile: ScoringWeightProfile): ScoringWeightProfile {
  assertValidWeightProfile(profile);
  WEIGHT_PROFILES[profile.id] = profile;
  activeProfileId = profile.id;
  return profile;
}

export function listWeightProfiles(): readonly ScoringWeightProfile[] {
  return Object.values(WEIGHT_PROFILES);
}

/** Bumps to next version id (v2, v3, …) and activates. */
export function publishWeightProfile(
  weights: Readonly<Record<keyof TrademarkMatchScores, number>>,
): ScoringWeightProfile {
  const existing = Object.keys(WEIGHT_PROFILES)
    .map((id) => Number(/^v(\d+)$/.exec(id)?.[1] ?? 0))
    .filter((n) => n > 0);
  const next = (existing.length ? Math.max(...existing) : 1) + 1;
  return setActiveWeightProfile(createWeightProfile(`v${next}`, weights));
}
