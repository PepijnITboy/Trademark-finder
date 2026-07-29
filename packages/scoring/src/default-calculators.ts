import type { ScoreComponentCalculator } from './score-component-calculator.js';
import type { ScoringContext } from './scoring-context.js';
import { jaccardSimilarity, normalizedStringSimilarity } from './text-distance.js';
import { calculateGoodsServicesOverlap } from './goods/goods-services-overlap.js';
import { conceptualSimilarity } from './conceptual/lexicon.js';
import {
  canComputeNiceClassOverlap,
  classificationSchemeForRegister,
  DEFAULT_REGISTER_CATALOG,
} from '@merkwacht/domain';

/**
 * Literal/orthographic closeness: a blend of normalized edit-distance
 * similarity and token overlap over `significantTokens`. See
 * `docs/scoring/overview.md`.
 */
export const textualSimilarityCalculator: ScoreComponentCalculator = {
  component: 'textualSimilarity',
  calculate(context: ScoringContext): number {
    const editSimilarity = normalizedStringSimilarity(
      context.watchedNormalized.normalized,
      context.candidateNormalized.normalized,
    );
    const tokenSimilarity = jaccardSimilarity(
      context.watchedNormalized.significantTokens,
      context.candidateNormalized.significantTokens,
    );
    return editSimilarity * 0.6 + tokenSimilarity * 0.4;
  },
};

/**
 * Sound-alike closeness: best edit-distance similarity across
 * locale-matched phonetic codes (including alternate codes for ambiguous
 * spellings). See `docs/scoring/phonetics.md`.
 */
export const phoneticSimilarityCalculator: ScoreComponentCalculator = {
  component: 'phoneticSimilarity',
  calculate(context: ScoringContext): number {
    let best = 0;
    for (const watchedRep of context.watchedPhonetic) {
      const candidateRep = context.candidatePhonetic.find((rep) => rep.locale === watchedRep.locale);
      if (!candidateRep) continue;

      const watchedCodes = [watchedRep.code, watchedRep.alternateCode].filter(
        (code): code is string => code !== undefined,
      );
      const candidateCodes = [candidateRep.code, candidateRep.alternateCode].filter(
        (code): code is string => code !== undefined,
      );

      for (const watchedCode of watchedCodes) {
        for (const candidateCode of candidateCodes) {
          best = Math.max(best, normalizedStringSimilarity(watchedCode, candidateCode));
        }
      }
    }
    return best;
  },
};

/**
 * Structural/visual proxy: rewards shared prefixes/suffixes and similar
 * length, pending true image-based comparison for figurative marks. See
 * `docs/scoring/overview.md`.
 */
export const visualSimilarityCalculator: ScoreComponentCalculator = {
  component: 'visualSimilarity',
  calculate(context: ScoringContext): number {
    const a = context.watchedNormalized.foldedAscii;
    const b = context.candidateNormalized.foldedAscii;
    if (a.length === 0 || b.length === 0) return 0;

    let commonPrefix = 0;
    while (commonPrefix < a.length && commonPrefix < b.length && a[commonPrefix] === b[commonPrefix]) {
      commonPrefix += 1;
    }

    let commonSuffix = 0;
    while (
      commonSuffix < a.length &&
      commonSuffix < b.length &&
      a[a.length - 1 - commonSuffix] === b[b.length - 1 - commonSuffix]
    ) {
      commonSuffix += 1;
    }

    const maxLength = Math.max(a.length, b.length);
    const affixScore = Math.min(1, (commonPrefix + commonSuffix) / maxLength);
    const lengthScore = 1 - Math.abs(a.length - b.length) / maxLength;

    return affixScore * 0.7 + lengthScore * 0.3;
  },
};

/**
 * Conceptual/meaning closeness via deterministic lexicon when enabled.
 * Legacy default remains 0 for weight-profile parity unless flag/text forces it.
 */
export const semanticSimilarityCalculator: ScoreComponentCalculator = {
  component: 'semanticSimilarity',
  calculate(context: ScoringContext): number {
    if (context.engineFlags?.shared_comparison_engine !== true) return 0;
    const result = conceptualSimilarity(
      context.watchedNormalized.normalized,
      context.candidateNormalized.normalized,
    );
    return Math.max(result.exactTranslation, result.synonym, result.taxonomyRelation);
  },
};

/** Overlap between the watched mark's and candidate's Nice classification classes. */
export const niceClassOverlapCalculator: ScoreComponentCalculator = {
  component: 'niceClassOverlap',
  calculate(context: ScoringContext): number {
    const watchedScheme =
      context.watchedClassificationSchemeId ??
      classificationSchemeForRegister(DEFAULT_REGISTER_CATALOG, context.watched.snapshot.registryCode);
    const candidateScheme =
      context.candidateClassificationSchemeId ??
      classificationSchemeForRegister(DEFAULT_REGISTER_CATALOG, context.candidate.registryCode);
    if (!canComputeNiceClassOverlap(watchedScheme, candidateScheme)) {
      // Cross-scheme pairs are incomparable — never invent Nice overlap.
      return 0;
    }
    return jaccardSimilarity(context.watched.snapshot.niceClasses, context.candidate.niceClasses);
  },
};

/**
 * Finer-grained goods/services description overlap.
 * When `goods_services_engine` is enabled (or goods text is present on context),
 * uses {@link calculateGoodsServicesOverlap}. Otherwise returns 0 for legacy parity.
 */
export const goodsServicesOverlapCalculator: ScoreComponentCalculator = {
  component: 'goodsServicesOverlap',
  calculate(context: ScoringContext): number {
    const enabled =
      context.engineFlags?.goods_services_engine === true ||
      (context.watchedGoodsServices?.length ?? 0) > 0 ||
      (context.candidateGoodsServices?.length ?? 0) > 0;
    if (!enabled) return 0;

    const result = calculateGoodsServicesOverlap({
      leftEntries: context.watchedGoodsServices ?? [],
      rightEntries: context.candidateGoodsServices ?? [],
      leftNiceClasses: context.watched.snapshot.niceClasses,
      rightNiceClasses: context.candidate.niceClasses,
    });
    return result.overallSimilarity;
  },
};

/**
 * Territory/market overlap. At BOIP-only launch, any two matched
 * applications are both Benelux-registered, so overlap is always full.
 * Becomes meaningful once multiple registers are supported. See
 * `docs/scoring/overview.md`.
 */
export const geographicOverlapCalculator: ScoreComponentCalculator = {
  component: 'geographicOverlap',
  calculate(context: ScoringContext): number {
    return context.watched.snapshot.registryCode === context.candidate.registryCode ? 1 : 0;
  },
};

/** Every rule-based calculator, in the order components are documented in `docs/scoring/weights.md`. */
export const DEFAULT_SCORE_COMPONENT_CALCULATORS: readonly ScoreComponentCalculator[] = [
  textualSimilarityCalculator,
  phoneticSimilarityCalculator,
  niceClassOverlapCalculator,
  visualSimilarityCalculator,
  goodsServicesOverlapCalculator,
  semanticSimilarityCalculator,
  geographicOverlapCalculator,
];
