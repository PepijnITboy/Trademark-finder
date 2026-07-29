import type {
  ConflictRiskBand,
  LegalActionability,
  TrademarkFeatureVector,
  TrademarkRiskAssessment,
} from '@merkwacht/domain';
import { RULES_ENGINE_VERSION_V1 } from '@merkwacht/domain';

function bandRank(band: ConflictRiskBand): number {
  switch (band) {
    case 'critical':
      return 5;
    case 'strong':
      return 4;
    case 'relevant':
      return 3;
    case 'borderline':
      return 2;
    case 'weak':
      return 1;
    case 'irrelevant':
      return 0;
  }
}

function maxBand(a: ConflictRiskBand, b: ConflictRiskBand): ConflictRiskBand {
  return bandRank(a) >= bandRank(b) ? a : b;
}

function minBand(a: ConflictRiskBand, b: ConflictRiskBand): ConflictRiskBand {
  return bandRank(a) <= bandRank(b) ? a : b;
}

function signStrength(features: TrademarkFeatureVector): number {
  return Math.max(
    features.exact.normalized,
    features.exact.compact,
    features.orthographic.weightedEdit,
    features.orthographic.jaroWinkler,
    features.phonetic.bestCodeSimilarity,
    features.token.dominantElement,
  );
}

function goodsStrength(features: TrademarkFeatureVector): number {
  if (features.goodsServices.coverage === 0 && features.metadata.missingFeatureCount > 0) {
    // Missing goods: do not treat as zero similarity for banding; use Nice proxy via coverage.
    return features.metadata.sameNiceClass ? 0.45 : 0.2;
  }
  return Math.max(features.goodsServices.overallSimilarity, features.goodsServices.coverage);
}

/**
 * Bootstrap rules engine — explainable, versioned, not calibrated probabilities.
 */
export function assessRiskFromFeatures(
  features: TrademarkFeatureVector,
  options: { actionability?: LegalActionability } = {},
): TrademarkRiskAssessment {
  const reasonCodes: string[] = [];
  let band: ConflictRiskBand = 'irrelevant';
  const sign = signStrength(features);
  const goods = goodsStrength(features);
  const actionability = options.actionability ?? 'unknown';

  if (features.exact.normalized === 1 || features.exact.compact === 1) {
    band = maxBand(band, goods >= 0.5 ? 'strong' : 'relevant');
    reasonCodes.push('exact_or_compact_match');
  }

  if (sign >= 0.9 && features.token.sharedDistinctiveCount > 0 && goods >= 0.55) {
    band = maxBand(band, 'relevant');
    reasonCodes.push('high_sign_shared_distinctive_high_goods');
  }

  if (features.phonetic.bestCodeSimilarity >= 0.9 && sign >= 0.75 && goods >= 0.5) {
    band = maxBand(band, 'relevant');
    reasonCodes.push('high_phonetic_and_goods');
  }

  if (sign >= 0.8 && goods >= 0.7) {
    band = maxBand(band, 'strong');
    reasonCodes.push('high_sign_high_goods');
  }

  if (sign >= 0.7 && goods >= 0.4) {
    band = maxBand(band, 'borderline');
    reasonCodes.push('moderate_sign_goods');
  }

  if (sign >= 0.55) {
    band = maxBand(band, 'weak');
    reasonCodes.push('moderate_sign');
  }

  // Shared only weak/descriptive-like: reduce when distinctive remainder differs hard
  if (
    features.token.sharedWeakCount > 0 &&
    features.token.sharedDistinctiveCount === 0 &&
    features.orthographic.levenshtein < 0.5
  ) {
    band = minBand(band, 'weak');
    reasonCodes.push('shared_weak_only_reduce');
  }

  if (features.metadata.missingFeatureCount > 0) {
    reasonCodes.push('missing_feature_data');
  }

  if (actionability === 'opposition_closed' || actionability === 'inactive_right') {
    reasonCodes.push(`actionability_${actionability}`);
    // Does not wipe sign similarity — only noted; band stays for conflict signal
  }

  const riskValue = Math.round(
    (bandRank(band) / 5) * 70 + sign * 20 + goods * 10,
  );

  const confidence =
    features.metadata.missingFeatureCount > 0
      ? Math.max(0.35, 0.85 - features.metadata.missingFeatureCount * 0.15)
      : 0.85;

  return {
    riskBand: band,
    riskValue: Math.min(100, Math.max(0, riskValue)),
    confidence: Math.round(confidence * 100) / 100,
    actionability,
    reasonCodes,
    rulesVersion: RULES_ENGINE_VERSION_V1,
  };
}
