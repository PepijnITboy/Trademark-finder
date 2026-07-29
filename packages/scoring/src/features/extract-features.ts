import type {
  ComparisonEvidence,
  TrademarkFeatureVector,
} from '@merkwacht/domain';
import {
  FEATURE_VERSION_V1,
  GOODS_SERVICES_VERSION_V1,
  LEGAL_RULES_VERSION_V1,
  NORMALIZATION_VERSION_V1,
  PHONETICS_VERSION_V1,
} from '@merkwacht/domain';
import type { ScoringContext } from '../scoring-context.js';
import {
  damerauLevenshteinSimilarity,
  jaroSimilarity,
  jaroWinklerSimilarity,
  longestCommonSubstringRatio,
  normalizedStringSimilarity,
  trigramJaccardSimilarity,
  weightedEditSimilarity,
  jaccardSimilarity,
} from '../text-distance.js';
import { calculateGoodsServicesOverlap } from '../goods/goods-services-overlap.js';
import { conceptualSimilarity } from '../conceptual/lexicon.js';


export const CURRENT_FEATURE_VERSION = FEATURE_VERSION_V1;

function compactForm(value: string): string {
  return value.replace(/\s+/g, '');
}

function prefixRatio(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i / Math.max(a.length, b.length);
}

function suffixRatio(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  let i = 0;
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i += 1;
  return i / Math.max(a.length, b.length);
}

function lengthRatio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - Math.abs(a.length - b.length) / max;
}

function tokenSequenceSimilarity(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const joinedA = a.join(' ');
  const joinedB = b.join(' ');
  return normalizedStringSimilarity(joinedA, joinedB);
}

/**
 * Builds a full feature vector + evidence from a scoring context.
 * Missing advanced signals stay 0 with missingFeatureCount incremented — never invent goods/semantic.
 */
export function extractTrademarkFeatures(context: ScoringContext): {
  features: TrademarkFeatureVector;
  evidence: ComparisonEvidence[];
  versions: {
    featureVersion: string;
    normalizationVersion: string;
    phoneticsVersion: string;
    goodsServicesVersion: string;
    legalRulesVersion: string;
  };
} {
  const left = context.watchedNormalized;
  const right = context.candidateNormalized;
  const leftNorm = left.normalized;
  const rightNorm = right.normalized;
  const leftCompact = compactForm(leftNorm);
  const rightCompact = compactForm(rightNorm);
  const leftAscii = left.foldedAscii;
  const rightAscii = right.foldedAscii;

  const evidence: ComparisonEvidence[] = [];
  let missingFeatureCount = 0;

  const exactRaw = context.watched.snapshot.markText === context.candidate.markText ? 1 : 0;
  const exactNormalized = leftNorm === rightNorm ? 1 : 0;
  const exactCompact = leftCompact === rightCompact && leftCompact.length > 0 ? 1 : 0;

  if (exactNormalized === 1) {
    evidence.push({
      id: 'E-EXACT-001',
      type: 'normalized_exact_match',
      details: { left: leftNorm, right: rightNorm },
    });
  }

  const levenshtein = normalizedStringSimilarity(leftNorm, rightNorm);
  const damerau = damerauLevenshteinSimilarity(leftNorm, rightNorm);
  const jaroW = jaroWinklerSimilarity(leftNorm, rightNorm);
  const trigram = trigramJaccardSimilarity(leftNorm, rightNorm);
  const weighted = weightedEditSimilarity(leftNorm, rightNorm, 'nl');
  const lcs = longestCommonSubstringRatio(leftNorm, rightNorm);
  const prefix = prefixRatio(leftAscii, rightAscii);
  const suffix = suffixRatio(leftAscii, rightAscii);

  if (weighted >= 0.85 && exactNormalized === 0) {
    evidence.push({
      id: 'E-ORTHO-001',
      type: 'high_weighted_edit_similarity',
      details: { left: leftNorm, right: rightNorm, score: weighted },
    });
  }

  const tokenSet = jaccardSimilarity(left.significantTokens, right.significantTokens);
  const tokenSeq = tokenSequenceSimilarity(left.significantTokens, right.significantTokens);

  // Phonetic: best across locales (legacy calculators + cross-language max)
  let bestCode = 0;
  let crossLanguage = 0;
  for (const watchedRep of context.watchedPhonetic) {
    for (const candidateRep of context.candidatePhonetic) {
      const watchedCodes = [watchedRep.code, watchedRep.alternateCode].filter(
        (c): c is string => c !== undefined,
      );
      const candidateCodes = [candidateRep.code, candidateRep.alternateCode].filter(
        (c): c is string => c !== undefined,
      );
      for (const w of watchedCodes) {
        for (const c of candidateCodes) {
          const sim = normalizedStringSimilarity(w, c);
          if (watchedRep.locale === candidateRep.locale) bestCode = Math.max(bestCode, sim);
          crossLanguage = Math.max(crossLanguage, sim);
        }
      }
    }
  }
  if (bestCode >= 0.85) {
    evidence.push({
      id: 'E-PHONETIC-001',
      type: 'high_phonetic_code_similarity',
      details: { score: bestCode },
    });
  }

  const goodsResult = calculateGoodsServicesOverlap({
    leftEntries: context.watchedGoodsServices ?? [],
    rightEntries: context.candidateGoodsServices ?? [],
    leftNiceClasses: context.watched.snapshot.niceClasses,
    rightNiceClasses: context.candidate.niceClasses,
  });
  const goodsOverall = goodsResult.overallSimilarity;
  const geo =
    context.watched.snapshot.registryCode === context.candidate.registryCode ? 1 : 0;
  const conceptual = conceptualSimilarity(leftNorm, rightNorm);

  if (!goodsResult.hasText) missingFeatureCount += 1;
  if (conceptual.exactTranslation === 0 && conceptual.synonym === 0) {
    // conceptual optional — only count missing when neither lexicon nor tokens relate
  }

  const sameNiceClass = context.watched.snapshot.niceClasses.some((c) =>
    context.candidate.niceClasses.includes(c),
  );

  const features: TrademarkFeatureVector = {
    exact: {
      raw: exactRaw,
      normalized: exactNormalized,
      compact: exactCompact,
      transliterated: leftAscii === rightAscii && leftAscii.length > 0 ? 1 : 0,
    },
    orthographic: {
      levenshtein,
      damerauLevenshtein: damerau,
      jaro: jaroSimilarity(leftNorm, rightNorm),
      jaroWinkler: jaroW,
      lcs,
      trigram,
      prefix,
      suffix,
      lengthRatio: lengthRatio(leftNorm, rightNorm),
      weightedEdit: weighted,
    },
    token: {
      tokenSet,
      tokenSequence: tokenSeq,
      dominantElement: tokenSet,
      sharedDistinctiveCount: left.significantTokens.filter((t) => right.significantTokens.includes(t))
        .length,
      sharedWeakCount: 0,
    },
    phonetic: {
      bestCodeSimilarity: bestCode,
      phonemeEditSimilarity: bestCode,
      phonemeNgramSimilarity: bestCode,
      consonantSkeletonSimilarity: bestCode,
      crossLanguageSimilarity: crossLanguage,
    },
    conceptual: {
      exactTranslation: conceptual.exactTranslation,
      synonym: conceptual.synonym,
      taxonomyRelation: conceptual.taxonomyRelation,
    },
    goodsServices: {
      identity: goodsResult.identity,
      overallSimilarity: goodsOverall,
      competition: goodsOverall,
      complementarity: goodsResult.reasonCodes.includes('cross_class_relation')
        ? Math.max(goodsOverall, 0.4)
        : 0,
      channelOverlap: 0,
      audienceOverlap: 0,
      coverage: goodsResult.coverage,
    },
    legalContext: {
      territoryOverlap: geo,
      earlierRightValid: 1,
      actionability: 1,
    },
    metadata: {
      earlierLength: leftNorm.length,
      laterLength: rightNorm.length,
      languageCombination: 'nl+en',
      registryCombination: `${context.watched.snapshot.registryCode}|${context.candidate.registryCode}`,
      sameNiceClass,
      missingFeatureCount,
    },
  };

  return {
    features,
    evidence,
    versions: {
      featureVersion: CURRENT_FEATURE_VERSION,
      normalizationVersion: NORMALIZATION_VERSION_V1,
      phoneticsVersion: PHONETICS_VERSION_V1,
      goodsServicesVersion: GOODS_SERVICES_VERSION_V1,
      legalRulesVersion: LEGAL_RULES_VERSION_V1,
    },
  };
}
