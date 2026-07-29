import type { CandidateApplication, ClassificationSchemeId, WatchedTrademark } from '@merkwacht/domain';
import type { NormalizedMarkRepresentations } from '@merkwacht/normalization';
import type { PhoneticRepresentation } from '@merkwacht/phonetics';
import type { GoodsServiceTextEntry } from './goods/goods-services-overlap.js';

/**
 * Everything a {@link ScoreComponentCalculator} or {@link AiEnrichmentPort}
 * needs to evaluate a single `(watched, candidate)` pair. Assembled once per
 * pair by the caller (`apps/worker`) before invoking `scoreMatch`, so
 * normalization/phonetic generation is never repeated per component.
 */
export interface ScoringContext {
  readonly watched: WatchedTrademark;
  readonly candidate: CandidateApplication;
  readonly watchedNormalized: NormalizedMarkRepresentations;
  readonly candidateNormalized: NormalizedMarkRepresentations;
  readonly watchedPhonetic: readonly PhoneticRepresentation[];
  readonly candidatePhonetic: readonly PhoneticRepresentation[];
  /** Optional override; defaults from register catalog when omitted. */
  readonly watchedClassificationSchemeId?: ClassificationSchemeId;
  readonly candidateClassificationSchemeId?: ClassificationSchemeId;
  /** Free-text goods/services for goodsServicesOverlap (phase 4). */
  readonly watchedGoodsServices?: readonly GoodsServiceTextEntry[];
  readonly candidateGoodsServices?: readonly GoodsServiceTextEntry[];
  /** Feature flags influencing calculators (optional). */
  readonly engineFlags?: Readonly<Record<string, boolean>>;
}
