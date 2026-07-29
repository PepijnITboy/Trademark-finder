/**
 * Shared trademark comparison domain model used by monitoring and name research.
 * Features, evidence, legal actionability and risk stay separate — never one blended score.
 */

export type ComparisonProductMode = 'monitoring' | 'name_research';

export type LegalActionability =
  | 'opposition_open'
  | 'opposition_closed'
  | 'registration_conflict_possible'
  | 'historical_only'
  | 'inactive_right'
  | 'wrong_territory'
  | 'insufficient_data'
  | 'unknown';

export type ConflictRiskBand =
  | 'critical'
  | 'strong'
  | 'relevant'
  | 'borderline'
  | 'weak'
  | 'irrelevant';

export type TrademarkPairLabel =
  | 'critical'
  | 'strong'
  | 'relevant'
  | 'borderline'
  | 'weak'
  | 'irrelevant';

export interface ComparisonEvidence {
  readonly id: string;
  readonly type: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface TrademarkFeatureVector {
  readonly exact: {
    readonly raw: number;
    readonly normalized: number;
    readonly compact: number;
    readonly transliterated: number;
  };
  readonly orthographic: {
    readonly levenshtein: number;
    readonly damerauLevenshtein: number;
    readonly jaro: number;
    readonly jaroWinkler: number;
    readonly lcs: number;
    readonly trigram: number;
    readonly prefix: number;
    readonly suffix: number;
    readonly lengthRatio: number;
    readonly weightedEdit: number;
  };
  readonly token: {
    readonly tokenSet: number;
    readonly tokenSequence: number;
    readonly dominantElement: number;
    readonly sharedDistinctiveCount: number;
    readonly sharedWeakCount: number;
  };
  readonly phonetic: {
    readonly bestCodeSimilarity: number;
    readonly phonemeEditSimilarity: number;
    readonly phonemeNgramSimilarity: number;
    readonly consonantSkeletonSimilarity: number;
    readonly crossLanguageSimilarity: number;
  };
  readonly conceptual: {
    readonly exactTranslation: number;
    readonly synonym: number;
    readonly taxonomyRelation: number;
    readonly embeddingSimilarity?: number;
  };
  readonly goodsServices: {
    readonly identity: number;
    readonly overallSimilarity: number;
    readonly competition: number;
    readonly complementarity: number;
    readonly channelOverlap: number;
    readonly audienceOverlap: number;
    readonly coverage: number;
  };
  readonly legalContext: {
    readonly territoryOverlap: number;
    readonly earlierRightValid: number;
    readonly actionability: number;
  };
  readonly metadata: {
    readonly earlierLength: number;
    readonly laterLength: number;
    readonly languageCombination: string;
    readonly registryCombination: string;
    readonly sameNiceClass: boolean;
    readonly missingFeatureCount: number;
  };
}

export interface TrademarkComparisonContext {
  readonly productMode: ComparisonProductMode;
  readonly targetRegistries: readonly string[];
  readonly targetTerritories: readonly string[];
  readonly selectedNiceClasses?: readonly number[];
  readonly relevantLanguages: readonly string[];
  readonly evaluationDate: string;
  readonly retrievalProfileVersion: string;
  readonly normalizationVersion: string;
  readonly featureVersion: string;
  readonly goodsServicesVersion: string;
  readonly legalRulesVersion: string;
  readonly modelVersion?: string;
  readonly promptVersion?: string;
  readonly enableAiReview: boolean;
}

export interface TrademarkRiskAssessment {
  readonly riskBand: ConflictRiskBand;
  /** Internal ranking score 0-100 — not a calibrated probability unless stated. */
  readonly riskValue: number;
  readonly confidence: number;
  readonly actionability: LegalActionability;
  readonly reasonCodes: readonly string[];
  readonly rulesVersion: string;
}

export interface StoredTrademarkComparisonShadow {
  readonly productMode: ComparisonProductMode;
  readonly featureVersion: string;
  readonly normalizationVersion: string;
  readonly phoneticsVersion: string;
  readonly goodsServicesVersion: string;
  readonly legalRulesVersion: string;
  readonly features: TrademarkFeatureVector;
  readonly evidence: readonly ComparisonEvidence[];
  readonly risk: TrademarkRiskAssessment;
  readonly legacyTotalScore?: number;
  readonly createdAt: string;
}

/** Engine rollout flags (platform). */
export const COMPARISON_ENGINE_FLAGS = [
  'shared_comparison_engine',
  'new_normalization_engine',
  'multilingual_phonetics',
  'weighted_edit_distance',
  'goods_services_engine',
  'semantic_retrieval',
  'trained_ranking_model',
  'trained_risk_model',
  'ai_explanation_engine',
  'new_monitoring_retrieval',
  'new_name_research_engine',
  'comparison_shadow_mode',
  'manual_weight_fallback',
  'pipeline_funnel_kpi',
] as const;

export type ComparisonEngineFlag = (typeof COMPARISON_ENGINE_FLAGS)[number];

export const FEATURE_VERSION_V1 = 'features-v1';
export const NORMALIZATION_VERSION_V1 = 'normalization-v1';
export const NORMALIZATION_VERSION_V2 = 'normalization-v2';
export const PHONETICS_VERSION_V1 = 'phonetics-v1';
export const PHONETICS_VERSION_V2 = 'phonetics-v2';
export const GOODS_SERVICES_VERSION_V1 = 'goods-v1';
export const LEGAL_RULES_VERSION_V1 = 'legal-v1';
export const RULES_ENGINE_VERSION_V1 = 'rules-v1';
